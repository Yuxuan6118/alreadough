import type { CoachMode, CompanionLang } from "./already-ai";
import { playbook, type PlaybookSituation } from "./coach-playbook-data.ts";
import { slangBlock } from "./slang-glossary.ts";

// Situation playbook: when her message matches a common situation (he is not replying, 3D contradicts the
// assumption, she has stopped believing, money or exams, a crisis...), the companion gets the concrete moves
// manifestation teachers use there and example replies in the selected guidance method. At most three
// situations are sent per turn (fewer examples each when there are three), so the prompt stays small.

const MAX_SITUATIONS = 3;

function scoreSituation(situation: PlaybookSituation, text: string) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const trigger of situation.triggers) {
    if (trigger && lower.includes(trigger.toLowerCase())) score += 1 + Math.min(trigger.length, 8) / 8;
  }
  return score;
}

/** Small stable hash, so the same message keeps the same examples but different messages rotate them. */
function hash(text: string) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return value;
}

function pickExamples<T>(items: T[], seed: number, count: number) {
  if (items.length <= count) return items;
  const start = seed % items.length;
  return Array.from({ length: count }, (_, offset) => items[(start + offset) % items.length]);
}

const isCrisis = (situation: PlaybookSituation) => situation.topic === "T13" || situation.id.startsWith("crisis_");

export function matchSituations(request: string, previousUser: string) {
  const rank = (text: string) => {
    const scored = playbook
      .map((situation) => ({ situation, score: scoreSituation(situation, text) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ situation }) => situation)
      // a possible crisis always makes the cut, however many other topics the message touches
      .sort((a, b) => Number(isCrisis(b)) - Number(isCrisis(a)));
    // One situation per topic first, so "I gave up on manifesting... and he is still gay" keeps both the doubt and the relationship part.
    const picked: PlaybookSituation[] = [];
    for (const situation of scored) if (picked.length < MAX_SITUATIONS && !picked.some((item) => item.topic === situation.topic)) picked.push(situation);
    for (const situation of scored) if (picked.length < MAX_SITUATIONS && !picked.includes(situation)) picked.push(situation);
    return picked;
  };
  const direct = rank(request);
  if (direct.length) return direct;
  // A real follow-up ("那怎么办", "然后呢", "so what now") continues the situation she described just before.
  // Anything else that matched nothing stays unmatched, so a new topic never inherits the previous one.
  const text = request.trim();
  const isFollowUp = text.length <= 30 && (
    /^(那|所以|可是|但是|然后|那我|这样|这个|还有|就是|what about|so\b|then\b|but\b|and\b)/i.test(text)
    || /^(怎么办|然后呢|真的吗|为什么|做不到|好难|还是不行|what now|really|why)[。？?!！.…～~]*$/i.test(text)
  );
  return isFollowUp ? rank(previousUser) : [];
}

const rules: Record<CompanionLang, string> = {
  zh: "把处境参考当作知识库：选与你当前流派和这轮意图相符的一条洞见，讲清背后的理由，再连到用户说过的具体细节。示例中的动作、场景和练习无需跟做；其他流派的观点不混入本轮。不照抄句子，不替用户补写事实，不预测他人的行为，不冒充或点名导师。没有匹配时，用当前流派的基本概念回答。",
  en: "Treat situation references as a knowledge base. Select an insight that fits the active school and the user's current intent, explain the reasoning, and connect it to a detail the user supplied. Actions, scenes, and exercises in examples are optional; do not mix schools. Do not copy wording, invent facts, predict others' actions, or impersonate or name teachers. If nothing matches, draw on the active school's fundamental concepts.",
};

/** The fixed part: how to use situation references. Sent every turn, so it sits in the cached front of the prompt. */
export function coachCorpusRules(lang: CompanionLang) {
  return rules[lang];
}

export function coachCorpusInstructions(lang: CompanionLang, coach: CoachMode, request: string, previousUser: string, localCrisisLine = "") {
  const playbook = coachCorpusPlaybook(lang, coach, request, previousUser, localCrisisLine);
  return playbook ? `${rules[lang]}\n\n${playbook}` : rules[lang];
}

/** The part chosen for this turn (matched situations, slang notes, local crisis line); empty when nothing matched. */
export function coachCorpusPlaybook(lang: CompanionLang, coach: CoachMode, request: string, previousUser: string, localCrisisLine = "") {
  const situations = matchSituations(request, previousUser);
  const slang = slangBlock(lang, `${request}\n${previousUser}`);
  const tail = slang ? `\n\n${slang}` : "";
  if (!situations.length) return slang || "";
  const seed = hash(request);
  const blocks = situations.map((situation) => {
    if (lang === "en") {
      return `Situation: ${situation.id.replace(/_/g, " ")}\nWhat works here:\n${situation.moves.en.map((move) => `- ${move}`).join("\n")}`;
    }
    const examples = pickExamples(situation.examples[coach] || [], seed, situations.length > 2 ? 1 : 2)
      .map((example) => `用户：${example.user}\n陪伴者：${example.reply}`)
      .join("\n\n");
    return [
      `处境：${situation.title}`,
      `这种处境里具体怎么接：\n${situation.moves.zh.map((move) => `- ${move}`).join("\n")}`,
      situation.avoid.length ? `这里不要：\n${situation.avoid.map((item) => `- ${item}`).join("\n")}` : "",
      examples ? `示范（只学做法和具体程度，不照抄）：\n${examples}` : "",
    ].filter(Boolean).join("\n");
  });
  const crisis = situations.some(isCrisis);
  if (crisis) {
    blocks.push(lang === "zh"
      ? `她所在地的求助方式：${localCrisisLine || "用她所在地的危机热线和急救电话，不要写别的国家的号码。"}`
      : `Her local help: ${localCrisisLine || "use her local crisis line and emergency number; never give another country's numbers."}`);
  }
  const heading = lang === "zh" ? "situation_playbook（本轮处境的参考）：" : "situation_playbook (reference for this turn):";
  return `${heading}\n${blocks.join("\n\n")}${tail}`;
}
