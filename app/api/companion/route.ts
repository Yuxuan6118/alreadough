import {
  buildMessages,
  desirePreservingSafetyReply,
  type CompanionRequest,
} from "@/lib/already-ai";
import { beginBetaRequest, combineTokenUsage, finishMemberRequest, recordConversation, settleBetaRequest } from "@/lib/beta-guard";
import { cleanReply, coachSpecificityRetryNote, contrastRetryNote, dropStockSentences, exitReply, hasContrastFrame, hasStockCoachLine, isErrorEcho, isExitIntent } from "@/lib/reply-guards";
import { readClientInfo } from "@/lib/client-info";
import { OPENAI_BASE_URL, chatContent, chatUsage, type ChatCompletion } from "@/lib/openai-base";

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
    && Array.isArray(body.recentRevisions);
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
  if (payload.mode === "chat" && isExitIntent(payload.userInput)) {
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

  const chatModel = process.env.OPENAI_CHAT_MODEL || "deepseek-v4-flash-0731";
  const creativeModel = process.env.OPENAI_CREATIVE_MODEL || chatModel;
  const model = payload.mode === "chat" ? chatModel : creativeModel;
  const gate = await beginBetaRequest(request, payload.sessionId, payload.mode);
  if (!gate.ok) {
    const messages: Record<string, Record<"zh" | "en", string>> = {
      SIGN_IN_REQUIRED: { zh: "无法识别这台设备，请刷新页面后再试。", en: "This device could not be identified. Please refresh and try again." },
      MEMBERSHIP_SIGN_IN_REQUIRED: { zh: "请先到会员页用邮箱登录，然后继续对话。", en: "Sign in with email on the membership page, then continue chatting." },
      MEMBERSHIP_LIMIT: { zh: "当前会员用量已经用完，可到会员页查看恢复时间或升级。", en: "Your current allowance is used up. Check the membership page for its reset time or upgrade." },
      AI_PAUSED: { zh: "AI 暂时不可用，请稍后再试。", en: "AI is temporarily unavailable. Please try again shortly." },
      // No per-person cap codes here on purpose — nobody is ever told "you're out for today."
      // BETA_BUDGET_PAUSED is a site-wide cost circuit breaker, not a personal limit.
      BETA_BUDGET_PAUSED: { zh: "AI 现在请求有点多，请稍后再试一次。", en: "AI is getting a lot of requests right now. Please try again shortly." },
    };
    return json({ error: gate.code, message: messages[gate.code]?.[payload.lang] || gate.code }, gate.code === "SIGN_IN_REQUIRED" || gate.code === "MEMBERSHIP_SIGN_IN_REQUIRED" ? 401 : 429);
  }

  const startedAt = Date.now();

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
  let billedUsage = chatUsage(data);
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
    if (payload.mode === "chat" && hasStockCoachLine(result.reply)) result.reply = dropStockSentences(result.reply);
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
