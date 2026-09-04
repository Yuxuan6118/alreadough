import { buildInput, buildInstructions, companionResponseSchema, type CoachMode, type CompanionRequest } from "../../lib/already-ai";

type EvalCase = {
  id: string;
  category: "relationship" | "wealth" | "self" | "lifestyle" | "other";
  lang: "zh" | "en";
  desire: string;
  beliefs: string[];
  input: string;
};

type ApiOutput = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

function outputText(data: ApiOutput) {
  return data.output_text || data.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text || "").join("") || "";
}

function payloadFor(test: EvalCase, coachMode: CoachMode): CompanionRequest {
  return {
    mode: "chat",
    lang: test.lang,
    userInput: test.input,
    sessionId: `promptfoo-${test.id}-${coachMode}`,
    goal: {
      wishCategory: test.category,
      coachMode,
      companionName: test.lang === "zh" ? "小愿" : "you",
      spName: test.category === "relationship" ? "对方" : "",
      desire: test.desire,
      beliefs: test.beliefs,
      journeySummary: "",
      tone: test.lang === "zh" ? "温柔、坚定、具体" : "warm, steady, specific",
      status: "active",
      memoryItems: [],
      acceptedSceneLedger: [],
    },
    recentMessages: [],
    recentRevisions: [],
  };
}

export default class AlreaDoughCoachProvider {
  id() {
    return "alreadough-production-coaches";
  }

  async callApi(prompt: string, context?: { vars?: Record<string, unknown> }) {
    const coach = prompt.trim() as CoachMode;
    const test = context?.vars?.test as EvalCase | undefined;
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_CHAT_MODEL || "gpt-5.6-luna";
    if (!test || !["release", "assumption", "subconscious"].includes(coach)) return { error: "Invalid Promptfoo test context" };
    if (!apiKey) return { error: "OPENAI_API_KEY is not configured" };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: buildInstructions(test.lang, "chat", coach),
        input: buildInput(payloadFor(test, coach)),
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 500,
        text: { verbosity: "low", format: { type: "json_schema", name: "coach_eval_response", strict: true, schema: companionResponseSchema } },
      }),
    });
    const data = await response.json() as ApiOutput;
    if (!response.ok) return { error: data.error?.message || `OpenAI ${response.status}` };
    const parsed = JSON.parse(outputText(data)) as { reply: string };
    return {
      output: parsed.reply,
      tokenUsage: {
        prompt: data.usage?.input_tokens,
        completion: data.usage?.output_tokens,
        total: data.usage?.total_tokens,
      },
      metadata: { coach, caseId: test.id, model },
    };
  }
}
