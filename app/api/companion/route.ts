import {
  buildInput,
  buildInstructions,
  companionResponseSchema,
  desirePreservingSafetyReply,
  type CompanionRequest,
} from "@/lib/already-ai";

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

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: buildInstructions(payload.lang, payload.mode, payload.goal.coachMode),
      input: buildInput(payload),
      store: false,
      reasoning: { effort: "none" },
      max_output_tokens: payload.mode === "story" ? 1500 : 900,
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

  const data = await upstream.json() as OpenAIResponse;
  const outputText = responseText(data);
  if (!upstream.ok || !outputText) {
    return json({ error: "AI_REQUEST_FAILED", message: data.error?.message || "The AI request failed." }, 502);
  }

  try {
    const result = JSON.parse(outputText) as {
      reply: string;
      journey_summary: string;
      belief_observed: string;
    };
    return json({
      reply: result.reply,
      journeySummary: result.journey_summary,
      beliefObserved: result.belief_observed,
      model,
      usage: data.usage || null,
    });
  } catch {
    return json({ error: "AI_RESPONSE_INVALID" }, 502);
  }
}
