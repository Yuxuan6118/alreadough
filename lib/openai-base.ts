/**
 * LLM backend adapter.
 *
 * The app talks to an OpenAI-compatible Chat Completions endpoint. In production
 * this is Aliyun Bailian (DashScope compatible-mode) serving `deepseek-v4-flash`
 * — reachable from every Cloudflare colo, unlike api.openai.com which refuses
 * requests originating in Hong Kong / mainland China ("country not supported").
 *
 * OPENAI_BASE_URL must point at a `/v1`-style base (no trailing slash), e.g.
 *   https://dashscope.aliyuncs.com/compatible-mode/v1
 *   https://api.deepseek.com/v1
 *   https://api.siliconflow.cn/v1
 */
export const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
  message?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
};

/** Text of the first choice from a Chat Completions response. */
export function chatContent(data: ChatCompletion): string {
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Normalise Chat Completions usage into the { input_tokens, output_tokens, total_tokens } shape the beta guard expects. */
export function chatUsage(data: ChatCompletion) {
  const u = data?.usage;
  if (!u) return null;
  return {
    input_tokens: u.prompt_tokens ?? 0,
    output_tokens: u.completion_tokens ?? 0,
    total_tokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
    // the part of the input served from the provider's prompt cache (cheaper); part of input_tokens, not on top of it
    cached_tokens: u.prompt_tokens_details?.cached_tokens ?? 0,
  };
}

/**
 * Chat Completions for short helper jobs (search translation): tries OPENAI_SEARCH_MODEL first,
 * then the chat model that powers conversations, so a stale search-model setting can't silently break search.
 */
export async function helperCompletion(body: Record<string, unknown>, timeoutMs = 8_000): Promise<ChatCompletion | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const models = [...new Set([process.env.OPENAI_SEARCH_MODEL, process.env.OPENAI_CHAT_MODEL, "deepseek-v4-flash-0731"].filter(Boolean) as string[])];
  for (const model of models) {
    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ ...body, model }),
      });
      if (response.ok) return await response.json() as ChatCompletion;
      console.warn(`helper model ${model} failed: ${response.status}`);
    } catch (error) {
      console.warn(`helper model ${model} failed: ${error instanceof Error ? error.message : "error"}`);
    }
  }
  return null;
}

export type { ChatCompletion };
