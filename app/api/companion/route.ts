import {
  buildInput,
  buildInstructions,
  companionResponseSchema,
  desirePreservingSafetyReply,
  type CompanionRequest,
} from "@/lib/already-ai";
import { beginBetaRequest, settleBetaRequest } from "@/lib/beta-guard";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const REQUEST_WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 18;

function isRateLimited(sessionId: string) {
  const now = Date.now();
  const current = requestWindows.get(sessionId);
  if (!current || now - current.startedAt >= REQUEST_WINDOW_MS) {
    requestWindows.set(sessionId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > REQUESTS_PER_WINDOW;
}

function responseText(data: OpenAIResponse) {
  if (data.output_text) return data.output_text;
  return data.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("") || "";
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
  return json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-5.6-luna",
    creativeModel: process.env.OPENAI_CREATIVE_MODEL || "gpt-5.6-terra",
  });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!isPayload(payload)) return json({ error: "INVALID_REQUEST" }, 400);

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

  const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-5.6-luna";
  const creativeModel = process.env.OPENAI_CREATIVE_MODEL || "gpt-5.6-terra";
  const model = payload.mode === "chat" ? chatModel : creativeModel;
  const gate = await beginBetaRequest(request, payload.sessionId, payload.mode).catch(() => null);
  if (!gate) {
    return json({
      error: "BETA_STATUS_UNAVAILABLE",
      message: payload.lang === "zh"
        ? "暂时无法确认本次测试额度。你的内容仍然保留，请稍后重试。"
        : "We could not confirm your beta allowance just now. Your content is still here—please try again shortly.",
    }, 503);
  }
  if (!gate.ok) {
    const messages: Record<string, Record<"zh" | "en", string>> = {
      SIGN_IN_REQUIRED: { zh: "请先登录测试版，再继续使用 AI。", en: "Please sign in to continue using the beta AI." },
      AI_PAUSED: { zh: "AI 服务正在由创始人暂时维护，请稍后再来。", en: "AI is temporarily paused by the founder. Please return shortly." },
      TRIAL_ENDED: { zh: "你的 7 天创始测试期已经结束，感谢你留下的每一次体验。", en: "Your 7-day founder beta has ended. Thank you for every session." },
      TRIAL_LIMIT_REACHED: { zh: "你的创始测试额度已经用完。", en: "Your founder beta allowance has been used." },
      DAILY_LIMIT_REACHED: { zh: "今天这一项的体验额度已经用完，明天会自动恢复。", en: "Today's allowance for this practice is complete. It resets tomorrow." },
      BETA_BUDGET_PAUSED: { zh: "今天的全站测试预算已经达到上限，明天会自动恢复。", en: "Today's shared beta budget has been reached. It resets tomorrow." },
    };
    return json({ error: gate.code, message: messages[gate.code]?.[payload.lang] || gate.code }, gate.code === "SIGN_IN_REQUIRED" ? 401 : 429);
  }

  const startedAt = Date.now();

  let upstream: Response;
  try {
    const timeoutSignal = AbortSignal.timeout(45_000);
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.any([request.signal, timeoutSignal]),
      body: JSON.stringify({
        model,
        instructions: buildInstructions(payload.lang, payload.mode, payload.goal.coachMode),
        input: buildInput(payload),
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: payload.mode === "story" ? 1400 : payload.mode === "revision" ? 900 : 750,
        prompt_cache_key: `already-${payload.lang}-${payload.mode}`,
        safety_identifier: payload.sessionId.slice(0, 64),
        text: {
          verbosity: payload.mode === "story" ? "medium" : "low",
          format: {
            type: "json_schema",
            name: "already_companion_response",
            strict: true,
            schema: companionResponseSchema,
          },
        },
      }),
    });
  } catch (error) {
    const aborted = request.signal.aborted;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") && !aborted;
    const code = aborted ? "AI_REQUEST_CANCELLED" : timedOut ? "AI_REQUEST_TIMEOUT" : "AI_REQUEST_FAILED";
    await settleBetaRequest(gate.ticket, null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, language: payload.lang, success: false, latencyMs: Date.now() - startedAt, failureCode: code });
    return json({
      error: code,
      message: payload.lang === "zh"
        ? timedOut ? "这次回应等待太久，已经停止。你的内容仍在，可以重新尝试。" : "这次没有发送成功，你的内容仍在，可以重新尝试。"
        : timedOut ? "This response took too long and was stopped. Your content is still here; you can try again." : "This did not send successfully. Your content is still here; you can try again.",
    }, aborted ? 499 : timedOut ? 504 : 502);
  }

  let data: OpenAIResponse;
  try {
    data = await upstream.json() as OpenAIResponse;
  } catch {
    await settleBetaRequest(gate.ticket, null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, language: payload.lang, success: false, latencyMs: Date.now() - startedAt, failureCode: "AI_RESPONSE_UNREADABLE" });
    return json({ error: "AI_RESPONSE_UNREADABLE", message: payload.lang === "zh" ? "这次回应没有完整送达，你的内容仍在。重新尝试" : "This response did not arrive completely. Your content is still here. Try again." }, 502);
  }
  const outputText = responseText(data);
  if (!upstream.ok || !outputText) {
    await settleBetaRequest(gate.ticket, data.usage || null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, language: payload.lang, success: false, latencyMs: Date.now() - startedAt, failureCode: upstream.ok ? "AI_RESPONSE_EMPTY" : `UPSTREAM_${upstream.status}` });
    return json({ error: "AI_REQUEST_FAILED", message: payload.lang === "zh" ? "这次没有生成完整回应，你的内容仍在。重新尝试" : "A complete response was not generated. Your content is still here. Try again." }, 502);
  }

  try {
    const result = JSON.parse(outputText) as {
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
    await settleBetaRequest(gate.ticket, data.usage || null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, language: payload.lang, success: true, latencyMs: Date.now() - startedAt });
    return json({
      reply: result.reply,
      journeySummary: result.journey_summary,
      beliefObserved: result.belief_observed,
      memoryCandidates: result.memory_candidates || [],
      model,
      usage: data.usage || null,
    });
  } catch {
    await settleBetaRequest(gate.ticket, data.usage || null, { wishCategory: payload.goal.wishCategory, coachMode: payload.goal.coachMode, language: payload.lang, success: false, latencyMs: Date.now() - startedAt, failureCode: "AI_RESPONSE_INVALID" });
    return json({ error: "AI_RESPONSE_INVALID", message: payload.lang === "zh" ? "这次回应格式不完整，你的内容仍在。重新尝试" : "This response was incomplete. Your content is still here. Try again." }, 502);
  }
}
