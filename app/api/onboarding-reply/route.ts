import { desirePreservingSafetyReply } from "@/lib/already-ai";
import { beginBetaRequest, finishMemberRequest, settleBetaRequest } from "@/lib/beta-guard";
import { readClientInfo } from "@/lib/client-info";
import { OPENAI_BASE_URL, chatContent, chatUsage, type ChatCompletion } from "@/lib/openai-base";
import { isReplyStep, onboardingSystem, onboardingUser, sanitizeOnboardingReply } from "@/lib/onboarding-ai";
import { hasContrastFrame } from "@/lib/reply-guards";

// One short line from the companion during the opening questions.
// It can never block the opening: every failure returns an empty reply with status 200.

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

type Body = {
  sessionId?: unknown;
  lang?: unknown;
  step?: unknown;
  name?: unknown;
  answer?: unknown;
  context?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; } catch { return json({ reply: "" }); }
  const lang = body.lang === "en" ? "en" : "zh";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!sessionId || !answer || answer.length > 800 || !isReplyStep(body.step)) return json({ reply: "" });
  const step = body.step;
  const context = Array.isArray(body.context)
    ? body.context.slice(0, 8).filter((item): item is { label: string; value: string } => !!item && typeof (item as { label?: unknown }).label === "string" && typeof (item as { value?: unknown }).value === "string")
    : [];

  // Someone who writes about hurting herself gets the same careful reply as in the chat, never a stock line.
  const country = readClientInfo(request.headers, (request as Request & { cf?: Record<string, unknown> }).cf).country;
  const safety = desirePreservingSafetyReply(answer, lang, name || (lang === "zh" ? "你" : "you"), country);
  if (safety) return json({ reply: safety, safety: true });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ reply: "" });
  const gate = await beginBetaRequest(request, sessionId, "chat");
  if (!gate.ok) return json({ reply: "" });

  const model = process.env.OPENAI_CHAT_MODEL || "deepseek-v4-flash-0731";
  const startedAt = Date.now();
  try {
    const upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: onboardingSystem(lang, step) },
          { role: "user", content: onboardingUser({ lang, step, name, answer, context }) },
        ],
        max_tokens: 160,
        temperature: 0.8,
        enable_thinking: false,
      }),
    });
    const data = await upstream.json() as ChatCompletion;
    await settleBetaRequest(gate.ticket, chatUsage(data), { success: upstream.ok, latencyMs: Date.now() - startedAt });
    if (!upstream.ok) { await finishMemberRequest(gate.ticket, null, false); return json({ reply: "" }); }
    const reply = sanitizeOnboardingReply(chatContent(data), lang, name);
    const accepted = reply && !hasContrastFrame(reply) ? reply : "";
    await finishMemberRequest(gate.ticket, chatUsage(data), !!accepted);
    return json({ reply: accepted });
  } catch {
    await settleBetaRequest(gate.ticket, null, { success: false, latencyMs: Date.now() - startedAt }).catch(() => undefined);
    await finishMemberRequest(gate.ticket, null, false).catch(() => undefined);
    return json({ reply: "" });
  }
}
