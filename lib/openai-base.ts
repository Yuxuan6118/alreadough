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
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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
  };
}

export type { ChatCompletion };
