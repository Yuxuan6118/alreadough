// The companion's one-line answers during the opening questions.
// Pure functions: the prompt it is given, and a check that throws away a reply that sounds like a stock AI line.

export type OnboardingReplyStep = "wish" | "scene" | "pullback" | "people";

export const REPLY_STEPS: OnboardingReplyStep[] = ["wish", "scene", "pullback", "people"];

export function isReplyStep(value: unknown): value is OnboardingReplyStep {
  return typeof value === "string" && (REPLY_STEPS as string[]).includes(value);
}

const zhBase = `你是 AlreaDough 的显化陪练，正在陪一个人做开场的几个问题。你只回一小句话，最多两句，不提问。

怎么说话：
- 必须直接用到 TA 刚写的具体词（地名、人名、画面里的东西），不能只说抽象的“安全、舒适、被爱”。
- 从愿望已经实现的那一边说话，用现在时，当作一件已经成立的事。
- 不说“我理解”“很自然”“这很正常”“可以感受到”，不替 TA 定义感受，不认可负面的感受。
- 只用 TA 写过的词和画面。不添加 TA 没写的人物、地点、时间、动作、细节（比如“每天醒来第一眼”这种 TA 没提过的画面）。
- 不用破折号，不用“不是……而是……”这类对比句。
- 不用感叹号，不用 emoji，不叫 TA 的名字开头。`;

const enBase = `You are AlreaDough's manifestation companion, sitting with someone as they answer a few opening questions. Reply with one short line, two sentences at most, and ask nothing.

How to speak:
- Use their own concrete words (a place, a name, a thing in the picture) directly. Never fall back on abstract needs such as "safety", "comfort" or "being loved".
- Speak from the side where the wish is already true, in the present tense, as something settled.
- Do not say "I understand", "that's natural", "that's valid", "it sounds like". Do not define their feelings or validate a negative feeling.
- Use only their words and their picture. Add no people, places, times, actions or details they did not write (no "the first thing you see when you wake up" if they never said it).
- No em-dashes, no "not X, but Y" contrasts.
- No exclamation marks, no emoji, do not begin with their name.`;

const zhStep: Record<OnboardingReplyStep, string> = {
  wish: "TA 刚写下的是 TA 最想显化的愿望。只用 TA 的词，把 TA 写的那句话换成已经成立的现在时，不再添加任何东西。",
  scene: "TA 刚写下的是愿望实现后普通一天的上午。顺着 TA 写的画面，再往里走半步，只用 TA 给的细节。",
  pullback: "TA 刚写下的是一句总把 TA 往回拉的话（例如“来不及了”“我不够好”）。只改写这句话本身：用一句现在时的话，说出和它相反、TA 已经选择的那个事实（例如“来不及了”改成“时间站在你这边，它按你的节奏到来”）。不要重复原话，不要安慰，不要续写任何场景，不添加画面和细节。",
  people: "TA 刚添加了一个对 TA 重要的人。记下这个人，用对方的名字和 TA 写的关系，说一句对方在 TA 的世界里这件事。不替对方编性格或经历。",
};
const enStep: Record<OnboardingReplyStep, string> = {
  wish: "They just wrote the desire they most want to manifest. Use only their words: restate what they wrote as already true, in the present tense, adding nothing.",
  scene: "They just wrote a morning on an ordinary day when it is already true. Follow their picture and step half a pace further into it, using only the details they gave.",
  pullback: "They just wrote a sentence that keeps pulling them back (for example \"it is too late\" or \"I am not enough\"). Rewrite only that sentence: in one present-tense line, state the opposite fact they have already chosen (for example \"it is too late\" becomes \"time is on your side, and it arrives at your pace\"). Do not repeat their words, do not comfort, do not continue any scene, and add no images or details.",
  people: "They just added someone who matters to them. Note them, using their name and the relationship they wrote, and say they are in their world. Do not invent their traits or history.",
};

export function onboardingSystem(lang: "zh" | "en", step: OnboardingReplyStep): string {
  return `${lang === "zh" ? zhBase : enBase}\n\n${lang === "zh" ? zhStep[step] : enStep[step]}`;
}

export type OnboardingReplyInput = {
  lang: "zh" | "en";
  step: OnboardingReplyStep;
  name: string;
  /** what she just wrote */
  answer: string;
  /** earlier answers worth knowing, as plain label/value pairs */
  context: Array<{ label: string; value: string }>;
};

export function onboardingUser(input: OnboardingReplyInput): string {
  const clip = (value: string, max: number) => value.trim().slice(0, max);
  const context = input.context
    .filter((item) => item.value.trim())
    .slice(0, 8)
    .map((item) => `${clip(item.label, 30)}：${clip(item.value, 240)}`);
  return JSON.stringify({
    her_name: clip(input.name, 40),
    earlier_answers: context,
    she_just_wrote: clip(input.answer, 600),
    response_language: input.lang,
  });
}

const STOCK_ZH = /(我理解|我能理解|很自然|很正常|完全可以理解|可以感受到|听起来你|听起来像|你渴望|你的渴望|这反映了)/;
const STOCK_EN = /(i understand|it'?s (completely |totally )?(understandable|natural|valid|normal)|it sounds like|reflects (a |your )?desire|you'?re craving)/i;

/**
 * Returns the reply cleaned up, or "" when it should not be shown at all.
 * A blank is always safe: the opening continues without a reply.
 * (The "not X, it is Y" frame is checked by the route with hasContrastFrame.)
 */
export function sanitizeOnboardingReply(raw: string, lang: "zh" | "en", name = ""): string {
  let text = (raw || "").trim().replace(/^```(?:\w+)?\s*|\s*```$/g, "").trim();
  if (!text) return "";
  text = text.replace(/\s*——+\s*/g, "，").replace(/\s+—\s+/g, ", ").replace(/^["“”']+|["“”']+$/g, "").trim();
  const trimmedName = name.trim();
  if (trimmedName) {
    const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stripped = text.replace(new RegExp(`^\\s*${escaped}\\s*[，,：:、]\\s*`), "");
    if (stripped.trim()) text = stripped.trim();
  }
  const limit = lang === "zh" ? 90 : 220;
  if ([...text].length > limit) return "";
  if (/[!！]/.test(text)) text = text.replace(/[!！]/g, lang === "zh" ? "。" : ".");
  if (/\p{Extended_Pictographic}/u.test(text)) return "";
  if ((lang === "zh" ? STOCK_ZH : STOCK_EN).test(text)) return "";
  return text;
}
