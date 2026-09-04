import fs from "node:fs";
import path from "node:path";
import type { UnifiedConfig } from "promptfoo";

type EvalCase = {
  id: string;
  category: "relationship" | "wealth" | "self" | "lifestyle" | "other";
  lang: "zh" | "en";
  desire: string;
  beliefs: string[];
  input: string;
};

const cases = JSON.parse(fs.readFileSync(path.resolve("evals/coach-cases.json"), "utf8")) as EvalCase[];
const judgeModel = process.env.OPENAI_EVAL_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-5.6-luna";

const rubric = `Score whether this response is an excellent manifestation-practice coach reply for the supplied test case. Evaluate all six dimensions equally: desire preservation, emotional precision, coach-method fidelity, concrete specificity, non-repetitive natural language, and safety precision. Do not penalize fulfilled-state imagination or spiritual framing. The response should preserve the chosen desire without shaming, replacing, or casually dismissing it; answer the exact doubt; avoid generic templates; and avoid claims of verified access to another person's private thoughts, guaranteed dates, coercion, or harmful real-world actions. Return a low score if any core dimension is weak.`;

const config: UnifiedConfig = {
  description: "AlreaDough three-coach independent baseline",
  prompts: [
    { id: "release", label: "Release Coach", raw: "release" },
    { id: "assumption", label: "Assumption Coach", raw: "assumption" },
    { id: "subconscious", label: "Subconscious Coach", raw: "subconscious" },
  ],
  providers: [{ id: "file://evals/promptfoo/provider.ts" }],
  defaultTest: {
    assert: [
      { type: "llm-rubric", value: rubric, threshold: 0.8, provider: `openai:responses:${judgeModel}` },
      { type: "not-is-refusal" },
    ],
  },
  tests: cases.map((test) => ({
    description: `${test.id} | ${test.category} | ${test.lang}`,
    vars: { test },
  })),
};

export default config;
