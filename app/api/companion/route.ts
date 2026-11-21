import {
  buildMessages,
  desirePreservingSafetyReply,
  type CompanionRequest,
} from "@/lib/already-ai";
import { beginBetaRequest, combineTokenUsage, type TokenUsage, finishMemberRequest, recordConversation, settleBetaRequest } from "@/lib/beta-guard";
import { cleanReply, coachSpecificityRetryNote, contrastRetryNote, dropStockSentences, exitReply, hasContrastFrame, hasStockCoachLine, isErrorEcho, isExitIntent } from "@/lib/reply-guards";
import { readClientInfo } from "@/lib/client-info";
import { crisisPause, mentionsSuicide } from "@/lib/crisis-signals";
import { crisisResources } from "@/lib/crisis-resources";
import { OPENAI_BASE_URL, chatContent, chatUsage, type ChatCompletion } from "@/lib/openai-base";
import { affirmLines, buildAffirmMessages } from "@/lib/affirm-prompt";
import { STORY_CATEGORIES, buildStoryMessages, storyCategoryFor, storyProblems, type StoryCategory } from "@/lib/story-prompt";

/** How long one model call may take before the request gives up (a stuck upstream would otherwise hold the Worker open). */
const CHAT_TIMEOUT_MS = 45_000;
const REWRITE_TIMEOUT_MS = 30_000;
const STORY_TIMEOUT_MS = 90_000;

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const REQUEST_WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 18;

function isRateLimited(sessionId: string) {
  const now = Date.now();
  const current = requestWindows.get(sessionId);
  if (!current || now - current.startedAt >= REQUEST_WINDOW_MS) {
    requestWindows.set(sessionId, { startedAt: now, count: 1 });
    // Best-effort per-isolate throttle only; drop expired windows so the map cannot grow without bound.
    if (requestWindows.size > 2000) {
      for (const [key, value] of requestWindows) {
        if (now - value.startedAt >= REQUEST_WINDOW_MS) requestWindows.delete(key);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > REQUESTS_PER_WINDOW;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isPayload(value: unknown): value is CompanionRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<CompanionRequest>;
  return (body.mode === "chat" || body.mode === "revision" || body.mode === "story")
    && (body.lang === "zh" || body.lang === "en")
    && typeof body.userInput === "string"
    && body.userInput.trim().length > 0
    && body.userInput.length <= 5000
    && typeof body.sessionId === "string"
    && body.sessionId.length <= 128
    && !!body.goal
    && typeof body.goal.companionName === "string"
    && typeof body.goal.spName === "string"
    && typeof body.goal.desire === "string"
    && Array.isArray(body.goal.beliefs)
    && (body.goal.memoryItems === undefined || Array.isArray(body.goal.memoryItems))
    && Array.isArray(body.recentMessages)
    && Array.isArray(body.recentRevisions)
    && (body.rephrase === undefined || (typeof body.rephrase === "string" && body.rephrase.length <= 600))
    && (body.storyCategory === undefined || (STORY_CATEGORIES as readonly string[]).includes(body.storyCategory));
}

/**
 * A story script: its own short prompt, a plain-text reply, the automatic checks, and at most one rewrite
 * when a check fails (the rewrite is kept only if it passes more checks).
 */
async function writeStoryScript(payload: CompanionRequest, model: string, apiKey: string) {
  const category = (payload.storyCategory as StoryCategory | undefined) || storyCategoryFor(payload.goal.wishCategory, typeof payload.goal.relationKind === "string" ? payload.goal.relationKind : undefined);
  const messages = buildStoryMessages(payload, category);
  const person = category === "love" ? payload.goal.spName : "";
  const call = async (extra: Array<{ role: "assistant" | "user"; content: string }> = []) => {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [...messages, ...extra], temperature: 0.85, enable_thinking: false }),
      signal: AbortSignal.timeout(STORY_TIMEOUT_MS),
    });
    const data = await response.json() as ChatCompletion;
    return { ok: response.ok, text: chatContent(data).trim(), usage: chatUsage(data) };
  };
  const first = await call();
  if (!first.ok || !first.text) return { ...first, retried: false };
  const notes = storyProblems(first.text, payload.lang, category, person);
  if (!notes.length) return { ...first, retried: false };
  try {
    const second = await call([{ role: "assistant", content: first.text }, { role: "user", content: (payload.lang === "zh" ? "按下面几点改写整篇，只输出改好的剧本：\n" : "Rewrite the whole script fixing these points; output only the script:\n") + notes.join("\n") }]);
    const usage = combineTokenUsage(first.usage, second.usage);
    const better = second.ok && second.text && storyProblems(second.text, payload.lang, category, person).length < notes.length;
    return { ok: true, text: better ? second.text : first.text, usage, retried: true };
  } catch {
    return { ...first, retried: false };
  }
}

export function GET() {
  // Only expose whether the backend is wired up; model names are not public.
  return json({ configured: Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  // bedtime affirmations travel as their own mode and are billed like a chat turn
  const affirm = !!payload && typeof payload === "object" && (payload as { mode?: unknown }).mode === "affirm";
  if (affirm) (payload as { mode: string }).mode = "chat";
  if (!isPayload(payload)) return json({ error: "INVALID_REQUEST" }, 400);
  // Error bubbles the client once showed ("AI could not connect…") are not things the AI said; keep them out of its context.
  payload.recentMessages = payload.recentMessages.filter((message) => !isErrorEcho(message));

  if (isRateLimited(payload.sessionId)) {
    return json({
      error: "TOO_MANY_REQUESTS",
      message: payload.lang === "zh" ? "这一分钟的对话有点密集，请稍等片刻再继续。" : "This minute has been a little busy. Please continue in a moment.",
    }, 429);
  }

  const name = payload.goal.companionName.trim() || (payload.lang === "zh" ? "你" : "you");
  const country = readClientInfo(request.headers, (request as Request & { cf?: Record<string, unknown> }).cf).country;
  payload.country = country; // server-side only: lets crisis replies name her local line
  const safetyReply = desirePreservingSafetyReply(payload.userInput, payload.lang, name, country);
  // Reframe, affirmations and scripts have no conversation to catch her: a line about ending her life is
  // never turned into a new thought, a bedtime line or a scene. Chat keeps its own crisis card.
  if (affirm || payload.mode !== "chat") {
    if (safetyReply || mentionsSuicide(payload.userInput)) {
      const pause = crisisPause(payload.lang, name, crisisResources(payload.lang, country));
      if (payload.mode === "revision") return json({ reply: pause, journeySummary: payload.goal.journeySummary, beliefObserved: "", memoryCandidates: [], model: "crisis-pause-route", usage: null });
      return json({ error: "CRISIS_PAUSE", message: pause }, 422);
    }
  }
  if (safetyReply) {
    return json({
      reply: safetyReply,
      journeySummary: payload.goal.journeySummary,
      beliefObserved: "",
      memoryCandidates: [],
      model: "desire-preserving-safety-route",
      usage: null,
    });
  }

  // She asked to stop: end it right here, no model call, no follow-up question.
  if (!affirm && payload.mode === "chat" && isExitIntent(payload.userInput)) {
    return json({
      reply: exitReply(payload.lang),
      journeySummary: payload.goal.journeySummary,
      beliefObserved: "",
      memoryCandidates: [],
      model: "exit-route",
      usage: null,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({
      error: "AI_NOT_CONFIGURED",
      message: payload.lang === "zh"
        ? "AI 暂时不可用，请稍后再试。"
        : "AI is temporarily unavailable. Please try again shortly.",
    }, 503);
  }

  const gate = await beginBetaRequest(request, payload.sessionId, payload.mode);
  if (!gate.ok) {
    const messages: Record<string, Record<"zh" | "en", string>> = {
      SIGN_IN_REQUIRED: { zh: "无法识别这台设备，请刷新页面后再试。", en: "This device could not be identified. Please refresh and try again." },
      MEMBERSHIP_SIGN_IN_REQUIRED: { zh: "请先到会员页用邮箱登录，然后继续对话。", en: "Sign in with email on the membership page, then continue chatting." },
      MEMBERSHIP_LIMIT: { zh: "当前会员用量已经用完，可到会员页查看恢复时间或升级。", en: "Your current allowance is used up. Check the membership page for its reset time or upgrade." },
      STORY_LIMIT: { zh: "这周的剧本额度用完了，周一恢复。", en: "This week's scripts are used up; they come back on Monday." },
      AI_PAUSED: { zh: "AI 暂时不可用，请稍后再试。", en: "AI is temporarily unavailable. Please try again shortly." },
      // No per-person cap codes here on purpose — nobody is ever told "you're out for today."
      // BETA_BUDGET_PAUSED is a site-wide cost circuit breaker, not a personal limit.
      BETA_BUDGET_PAUSED: { zh: "AI 现在请求有点多，请稍后再试一次。", en: "AI is getting a lot of requests right now. Please try again shortly." },
    };
    return json({ error: gate.code, message: messages[gate.code]?.[payload.lang] || gate.code }, gate.code === "SIGN_IN_REQUIRED" || gate.code === "MEMBERSHIP_SIGN_IN_REQUIRED" ? 401 : 429);
  }

  const startedAt = Date.now();
  // Every plan gets the same (best) model; plans differ in how much, not in how well (founder, 2026-11-21).
  const chatModel = process.env.OPENAI_CHAT_MODEL || "deepseek-v4-flash-0731";
  const creativeModel = process.env.OPENAI_CREATIVE_MODEL || chatModel;
  // stories are long, detailed scripts; they can run on a stronger model than chat (OPENAI_STORY_MODEL)
  const model = payload.mode === "chat" ? chatModel : payload.mode === "story" ? (process.env.OPENAI_STORY_MODEL || creativeModel) : creativeModel;

  if (affirm) {
    const failed = () => json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "AI 暂时没有连接成功，请稍后再试。" : "AI could not connect. Please try again shortly." }, 502);
    try {
      const from = payload.userInput.trim() === "-" ? "" : payload.userInput;
      const upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: buildAffirmMessages(payload.lang, payload.goal.desire, from), response_format: { type: "json_object" }, temperature: 0.8, enable_thinking: false }),
        signal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
      });
      const data = await upstream.json() as ChatCompletion;
      const usage = chatUsage(data);
      const lines = upstream.ok ? affirmLines(chatContent(data), payload.lang) : [];
      await settleBetaRequest(gate.ticket, usage, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, feature: "affirm", success: lines.length > 0, latencyMs: Date.now() - startedAt });
      await finishMemberRequest(gate.ticket, lines.length ? usage : null, lines.length > 0);
      return lines.length ? json({ reply: lines.join("\n") }) : failed();
    } catch (error) {
      console.error("affirmations failed", String(error));
      await finishMemberRequest(gate.ticket, null, false);
      return failed();
    }
  }

  if (payload.mode === "story") {
    try {
      const story = await writeStoryScript(payload, model, apiKey);
      await settleBetaRequest(gate.ticket, story.usage, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: story.ok, latencyMs: Date.now() - startedAt });
      if (!story.ok || !story.text) {
        await finishMemberRequest(gate.ticket, null, false);
        return json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "AI 暂时没有连接成功，请稍后再试。" : "AI could not connect. Please try again shortly." }, 502);
      }
      const reply = cleanReply(story.text, { mode: "story", name: payload.goal.companionName });
      const logId = await recordConversation(gate.ticket, { lang: payload.lang, coachMode: payload.goal.coachMode, wishCategory: payload.goal.wishCategory, context: [], userText: payload.userInput, aiReply: reply, model });
      await finishMemberRequest(gate.ticket, story.usage, true);
      return json({ reply, logId, journeySummary: payload.goal.journeySummary, beliefObserved: "", memoryCandidates: [], model, usage: story.usage, retried: story.retried });
    } catch (error) {
      console.error("story script failed", String(error));
      await finishMemberRequest(gate.ticket, null, false);
      return json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "AI 暂时没有连接成功，请稍后再试。" : "AI could not connect. Please try again shortly." }, 502);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(payload),
        response_format: { type: "json_object" },
        temperature: 0.85,
        // DeepSeek/Qwen on DashScope: skip the reasoning pass — it triples latency
        // and this is a warm conversational turn, not a hard reasoning problem.
        enable_thinking: false,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("companion upstream fetch threw", { base: OPENAI_BASE_URL, model, err: String(err), stack: (err as Error)?.stack });
    await settleBetaRequest(gate.ticket, null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: false, latencyMs: Date.now() - startedAt });
    await finishMemberRequest(gate.ticket, null, false);
    return json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "AI 暂时没有连接成功，请稍后再试。" : "AI could not connect. Please try again shortly." }, 502);
  }

  let data: ChatCompletion;
  try { data = await upstream.json() as ChatCompletion; }
  catch { await finishMemberRequest(gate.ticket, null, false); return json({ error: "AI_REQUEST_FAILED" }, 502); }
  let billedUsage: TokenUsage = chatUsage(data);
  await settleBetaRequest(gate.ticket, chatUsage(data), { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: upstream.ok, latencyMs: Date.now() - startedAt });
  const outputText = chatContent(data).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  if (!upstream.ok || !outputText) {
    await finishMemberRequest(gate.ticket, null, false);
    return json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "AI 暂时没有连接成功，请稍后再试。" : "AI could not connect. Please try again shortly." }, 502);
  }

  try {
    let result = JSON.parse(outputText) as {
      reply: string;
      journey_summary: string;
      belief_observed: string;
      memory_candidates: Array<{
        kind: "person" | "place" | "event" | "preference" | "insight";
        title: string;
        detail: string;
        keywords: string[];
      }>;
    };
    const retryNotes = [
      hasContrastFrame(result.reply) ? contrastRetryNote(payload.lang) : "",
      hasStockCoachLine(result.reply) ? coachSpecificityRetryNote(payload.lang) : "",
    ].filter(Boolean);
    // Keep the first reply if the rewrite fails.
    if (payload.mode === "chat" && retryNotes.length) {
      try {
        const retryStartedAt = Date.now();
        const retry = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [...buildMessages(payload), { role: "assistant" as const, content: outputText }, { role: "user" as const, content: retryNotes.join("\n\n") }],
            response_format: { type: "json_object" },
            temperature: 0.5,
            enable_thinking: false,
          }),
          signal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
        });
        const retryData = await retry.json() as ChatCompletion;
        billedUsage = combineTokenUsage(billedUsage, chatUsage(retryData));
        if (retry.ok) {
          await settleBetaRequest(gate.ticket, chatUsage(retryData), { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: true, latencyMs: Date.now() - retryStartedAt });
          const retried = JSON.parse(chatContent(retryData).trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) as typeof result;
          const fixed = typeof retried.reply === "string" && retried.reply.trim().length > 0 && !hasContrastFrame(retried.reply) && !hasStockCoachLine(retried.reply);
          console.log("coach reply rewrite", { fixed });
          if (fixed) result = retried;
        }
      } catch (error) {
        console.error("coach reply rewrite failed", String(error));
      }
    }
    if ((payload.mode === "chat" || payload.mode === "revision") && hasStockCoachLine(result.reply)) result.reply = dropStockSentences(result.reply);
    const reply = cleanReply(result.reply, { mode: payload.mode, name: payload.goal.companionName });
    // Beta: keep the conversation turn (not the desire card) so replies can be reviewed and improved.
    const logId = await recordConversation(gate.ticket, {
      lang: payload.lang,
      coachMode: payload.goal.coachMode,
      wishCategory: payload.goal.wishCategory,
      context: payload.recentMessages.slice(-6).map((message) => ({ role: message.role, text: message.text })),
      userText: payload.userInput,
      aiReply: reply,
      model,
    });
    await finishMemberRequest(gate.ticket, billedUsage, true);
    return json({
      reply,
      logId,
      journeySummary: result.journey_summary,
      beliefObserved: result.belief_observed,
      memoryCandidates: result.memory_candidates || [],
      model,
      usage: billedUsage,
    });
  } catch {
    await finishMemberRequest(gate.ticket, null, false);
    return json({ error: "AI_RESPONSE_INVALID" }, 502);
  }
}
