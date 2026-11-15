import type { CoachMode, CompanionLang } from "./already-ai";
import { playbook, type PlaybookSituation } from "./coach-playbook-data";

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

export function matchSituations(request: string, previousUser: string) {
  const rank = (text: string) => {
    const scored = playbook
      .map((situation) => ({ situation, score: scoreSituation(situation, text) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ situation }) => situation);
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
  zh: "回复要具体：本轮至少给出一样实在的东西（一个新读法、一个比喻、一个生活画面、一句她现在能念或想的话、一个马上能做的小动作），贴着她这一句和她的愿望。不要用“你选的版本”“这一秒”“3D里的一帧”“回到终点”这类套话撑起回复。不替她补写她没提过的动作和物件，不预言现实里别人会怎么做。示范只示范做法和具体程度，换成她的人、她的事、她的话，不照抄句子，也不提任何博主或导师的名字。",
  en: "Be concrete: every reply carries at least one real thing (a fresh reading, a metaphor, an everyday picture, a line she can say or think now, or one small action), fitted to her exact message and desire. Do not lean on stock lines about her chosen 'version', 'this second', 'one frame of 3D', or 'returning to the end'. Do not invent actions or objects she never mentioned, and do not predict what another real person will do. Examples show the move and the level of detail only; use her people, events, and words, never copy their sentences, and never name a teacher.",
};

export function coachCorpusInstructions(lang: CompanionLang, coach: CoachMode, request: string, previousUser: string, localCrisisLine = "") {
  const situations = matchSituations(request, previousUser);
  if (!situations.length) return rules[lang];
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
  const crisis = situations.some((situation) => situation.topic === "T13" || situation.id.startsWith("crisis_"));
  if (crisis) {
    blocks.push(lang === "zh"
      ? `她所在地的求助方式：${localCrisisLine || "用她所在地的危机热线和急救电话，不要写别的国家的号码。"}`
      : `Her local help: ${localCrisisLine || "use her local crisis line and emergency number; never give another country's numbers."}`);
  }
  const heading = lang === "zh" ? "situation_playbook（本轮处境的参考）：" : "situation_playbook (reference for this turn):";
  return `${rules[lang]}\n\n${heading}\n${blocks.join("\n\n")}`;
}
