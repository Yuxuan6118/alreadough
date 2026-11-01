import {
  buildMessages,
  desirePreservingSafetyReply,
  type CompanionRequest,
} from "@/lib/already-ai";
import { beginBetaRequest, recordConversation, settleBetaRequest } from "@/lib/beta-guard";
import { cleanReply, contrastRetryNote, hasContrastFrame, isErrorEcho } from "@/lib/reply-guards";
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
  const safetyReply = desirePreservingSafetyReply(payload.userInput, payload.lang, name);
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({
      error: "AI_NOT_CONFIGURED",
      message: payload.lang === "zh"
        ? "真实 AI 后端已经准备好，但还没有配置 API 密钥。"
        : "The live AI backend is ready, but an API key has not been configured yet.",
    }, 503);
  }

  const chatModel = process.env.OPENAI_CHAT_MODEL || "deepseek-v4-flash-0731";
  const creativeModel = process.env.OPENAI_CREATIVE_MODEL || chatModel;
  const model = payload.mode === "chat" ? chatModel : creativeModel;
  const gate = await beginBetaRequest(request, payload.sessionId, payload.mode);
  if (!gate.ok) {
    const messages: Record<string, Record<"zh" | "en", string>> = {
      SIGN_IN_REQUIRED: { zh: "无法识别这台设备，请刷新页面后再试。", en: "This device could not be identified. Please refresh and try again." },
      AI_PAUSED: { zh: "AI 服务正在由创始人暂时维护，请稍后再来。", en: "AI is temporarily paused by the founder. Please return shortly." },
      // No per-person cap codes here on purpose — nobody is ever told "you're out for today."
      // BETA_BUDGET_PAUSED is a site-wide cost circuit breaker, not a personal limit.
      BETA_BUDGET_PAUSED: { zh: "AI 现在请求有点多，请稍后再试一次。", en: "AI is getting a lot of requests right now. Please try again shortly." },
    };
    return json({ error: gate.code, message: messages[gate.code]?.[payload.lang] || gate.code }, gate.code === "SIGN_IN_REQUIRED" ? 401 : 429);
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
        max_tokens: payload.mode === "story" ? 1800 : payload.mode === "revision" ? 1100 : 900,
        temperature: 0.85,
        // DeepSeek/Qwen on DashScope: skip the reasoning pass — it triples latency
        // and this is a warm conversational turn, not a hard reasoning problem.
        enable_thinking: false,
      }),
    });
  } catch (err) {
    console.error("companion upstream fetch threw", { base: OPENAI_BASE_URL, model, err: String(err), stack: (err as Error)?.stack });
    await settleBetaRequest(gate.ticket, null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: false, latencyMs: Date.now() - startedAt });
    return json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "AI 暂时没有连接成功，请稍后再试。" : "AI could not connect. Please try again shortly." }, 502);
  }

  const data = await upstream.json() as ChatCompletion;
  await settleBetaRequest(gate.ticket, chatUsage(data), { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: upstream.ok, latencyMs: Date.now() - startedAt });
  const outputText = chatContent(data).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  if (!upstream.ok || !outputText) {
    return json({ error: "AI_REQUEST_FAILED", message: data.error?.message || data.message || "The AI request failed." }, 502);
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
    // Guard: if the reply uses the "not X, it is Y" frame, ask once for a version that says the point directly.
    // Any failure here keeps the first reply; the user is never blocked by this.
    if (payload.mode === "chat" && hasContrastFrame(result.reply)) {
      try {
        const retryStartedAt = Date.now();
        const retry = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [...buildMessages(payload), { role: "assistant" as const, content: outputText }, { role: "user" as const, content: contrastRetryNote(payload.lang) }],
            response_format: { type: "json_object" },
            max_tokens: 900,
            temperature: 0.85,
            enable_thinking: false,
          }),
        });
        const retryData = await retry.json() as ChatCompletion;
        if (retry.ok) {
          await settleBetaRequest(gate.ticket, chatUsage(retryData), { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, success: true, latencyMs: Date.now() - retryStartedAt });
          const retried = JSON.parse(chatContent(retryData).trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) as typeof result;
          const fixed = typeof retried.reply === "string" && retried.reply.trim().length > 0 && !hasContrastFrame(retried.reply);
          console.log("contrast-frame retry", { fixed });
          if (fixed) result = retried;
        }
      } catch (error) {
        console.error("contrast-frame retry failed", String(error));
      }
    }
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
    return json({
      reply,
      logId,
      journeySummary: result.journey_summary,
      beliefObserved: result.belief_observed,
      memoryCandidates: result.memory_candidates || [],
      model,
      usage: chatUsage(data),
    });
  } catch {
    return json({ error: "AI_RESPONSE_INVALID" }, 502);
  }
}
