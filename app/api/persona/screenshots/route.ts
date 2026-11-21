import { finishMemberRequest, settleBetaRequest } from "@/lib/beta-guard";
import { memberAccount } from "@/lib/member-auth";
import { membershipEnabled } from "@/lib/membership";
import { OPENAI_BASE_URL, chatContent, chatUsage, type ChatCompletion } from "@/lib/openai-base";
import type { PersonaLang } from "@/lib/persona";
import { beginPersonaRequest, personaError, personaModel } from "@/lib/persona-gate";
import { SCREENSHOT_LIMITS, releaseScreenshotUse, reserveScreenshotUse, screenshotAccess, type ScreenshotUse } from "@/lib/screenshot-import";

// Reads chat screenshots into "name：message" lines for her to check before 整理. The images and the text are not
// stored anywhere, here or in logs. One request is one use, however many pieces the browser cut the screenshots into.

const PER_CALL = 2;
const PARALLEL = 4;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function instructions(lang: PersonaLang, taName: string, herName: string) {
  return lang === "zh"
    ? `这些是和 TA 的聊天截图，按图片顺序从上到下转写成文字。几张图是同一段聊天按顺序切开的，接着往下写；交界处同一条消息只写一次。
右边的气泡是「${herName}」发的，左边的气泡是「${taName}」发的（群聊里左边气泡上方有名字时，用那个名字）。
每条消息一行，格式：名字：内容。一个气泡里折行的字合成一行。
居中的时间写成一行：—— 时间 ——
语音写 [语音]，图片写 [图片]，表情包写 [表情]，视频写 [视频]，链接或文件写 [链接] 或 [文件]；气泡里的小表情照原样保留。
气泡下面引用的灰色小字块不是新消息，跳过。系统提示（撤回、拍一拍、红包、转账）照原文写成一行，不加名字。
顶部标题栏、手机状态栏、底部输入框不写。
一个字都不要改，不要补全看不清的字，不要解释。截图里没有聊天就什么都不输出。`
    : `These are screenshots of a chat with TA. Transcribe them top to bottom, in image order. Several images may be one chat cut into pieces; carry on from one to the next and write a message cut across two images only once.
Bubbles on the right were sent by "${herName}", bubbles on the left by "${taName}" (in a group chat, use the name shown above a left bubble).
One message per line, as  name: text. Join a bubble's wrapped lines into one line.
A centred timestamp becomes its own line: —— time ——
Write [voice], [photo], [sticker], [video], [link] or [file] for those; keep emoji inside bubbles as they are.
A grey quoted block under a bubble is not a new message; skip it. System notices (recalled message, nudge, red packet, transfer) go on their own line as written, with no name.
Leave out the title bar, the phone status bar and the input box.
Do not change a single character, do not guess unreadable words, do not explain. If there is no chat in the images, output nothing.`;
}

type Usage = ReturnType<typeof chatUsage>;

async function readBatch(images: string[], prompt: string, apiKey: string): Promise<{ text: string | null; usage: Usage }> {
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SCREENSHOT_MODEL || personaModel(),
        messages: [{ role: "user", content: [...images.map((url) => ({ type: "image_url", image_url: { url } })), { type: "text", text: prompt }] }],
        temperature: 0,
        enable_thinking: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await response.json() as ChatCompletion;
    if (!response.ok) { console.error("persona screenshots: model error", response.status); return { text: null, usage: chatUsage(data) }; }
    return { text: chatContent(data).trim().replace(/^```\w*\s*|\s*```$/g, ""), usage: chatUsage(data) };
  } catch (error) {
    console.error("persona screenshots failed", String(error));
    return { text: null, usage: null };
  }
}

/** Runs the batches a few at a time and keeps their order. */
async function readAll(batches: string[][], prompt: string, apiKey: string) {
  const results: { text: string | null; usage: Usage }[] = new Array(batches.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, async () => {
    while (next < batches.length) {
      const index = next++;
      results[index] = await readBatch(batches[index], prompt, apiKey);
    }
  }));
  return results;
}

export async function GET(request: Request) {
  const account = membershipEnabled() ? await memberAccount(request) : null;
  const access = account ? await screenshotAccess(account) : { mode: "included" as const, credits: 0, weekLeft: null };
  return Response.json({ ...access, files: SCREENSHOT_LIMITS.files }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { lang?: unknown; sessionId?: unknown; taName?: unknown; herName?: unknown; images?: unknown };
  try { body = await request.json() as typeof body; } catch { return personaError("INVALID_JSON", "zh", 400); }
  const lang: PersonaLang = body.lang === "en" ? "en" : "zh";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  const taName = typeof body.taName === "string" ? body.taName.trim().slice(0, 40) : "";
  const herName = (typeof body.herName === "string" ? body.herName.trim().slice(0, 40) : "") || (lang === "zh" ? "我" : "Me");
  const images = Array.isArray(body.images) ? body.images : [];
  if (!sessionId || !taName) return personaError("INVALID_REQUEST", lang, 400);
  if (!images.length || images.length > SCREENSHOT_LIMITS.tiles
    || !images.every((image): image is string => typeof image === "string" && image.length <= SCREENSHOT_LIMITS.tileChars && IMAGE.test(image)))
    return personaError("INVALID_IMAGES", lang, 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return personaError("AI_PAUSED", lang, 503);
  const gate = await beginPersonaRequest(request, sessionId);
  if (!gate.ok) return personaError(gate.code, lang, gate.status);

  const accountId = gate.ticket.memberAccountId;
  let use: ScreenshotUse | null = null;
  if (accountId) {
    const reserved = await reserveScreenshotUse(accountId);
    if (!reserved.ok) {
      await settleBetaRequest(gate.ticket, null, { success: false, latencyMs: 0, feature: "persona_screenshots" });
      await finishMemberRequest(gate.ticket, null, false);
      return personaError(reserved.code, lang, 402);
    }
    use = reserved.use;
  }

  const startedAt = Date.now();
  const batches: string[][] = [];
  for (let i = 0; i < images.length; i += PER_CALL) batches.push(images.slice(i, i + PER_CALL));
  const results = await readAll(batches, instructions(lang, taName, herName), apiKey);
  const usage = results.reduce<{ input_tokens: number; output_tokens: number; total_tokens: number }>((sum, r) => ({
    input_tokens: sum.input_tokens + (r.usage?.input_tokens || 0),
    output_tokens: sum.output_tokens + (r.usage?.output_tokens || 0),
    total_tokens: sum.total_tokens + (r.usage?.total_tokens || 0),
  }), { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  const text = results.map((r) => r.text || "").filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const failed = results.every((r) => r.text === null);
  const ok = !failed && text.length > 0;

  await settleBetaRequest(gate.ticket, usage, { success: ok, latencyMs: Date.now() - startedAt, feature: "persona_screenshots" });
  // Counted as one reply in the chat allowance; the screenshot use itself is the real price.
  await finishMemberRequest(gate.ticket, null, ok);
  if (!ok && accountId && use) await releaseScreenshotUse(accountId, use);
  if (failed) return personaError("AI_REQUEST_FAILED", lang, 502);
  if (!text) return personaError("SCREENSHOTS_EMPTY", lang, 422);
  return Response.json({ text, herName, partial: results.some((r) => r.text === null) }, { headers: { "Cache-Control": "no-store" } });
}
