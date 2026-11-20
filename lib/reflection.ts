import { mentionsSuicide } from "./crisis-signals.ts";
// Self-reflection: a few optional questions per desire, answered in her own words.
// Everything here is local and deterministic. No model call, nothing sent anywhere.
// The only "analysis" is counting which words she herself wrote more than once.

export type ReflectionQuestionId = "feel" | "worry" | "give";
export type ReflectionAnswers = Partial<Record<ReflectionQuestionId, string>>;
export type ReflectionGoal = { id: string; title: string; reflection: ReflectionAnswers };
export type RepeatedWord = { word: string; count: number; where: Array<{ goalTitle: string; question: ReflectionQuestionId }> };

export const MAX_REFLECTION_CHARS = 600;

export const reflectionQuestions: Array<{ id: ReflectionQuestionId; zh: string; en: string; zhHint: string; enHint: string }> = [
  { id: "feel", zh: "拥有它之后，你会有什么感觉？", en: "When you have it, what do you feel?", zhHint: "心里的、身体的感觉都可以", enHint: "Inside or in your body, anything counts" },
  { id: "worry", zh: "如果一直没有，你最担心会发生什么？", en: "If it never comes, what worries you most?", zhHint: "不想写就空着", enHint: "Leave it empty if you would rather not" },
  { id: "give", zh: "你希望它给你带来的是什么？", en: "What do you hope it gives you?", zhHint: "用你自己的话写", enHint: "In your own words" },
];

const stopZh = new Set("的 了 我 你 他 她 它 是 在 有 和 就 不 也 都 很 会 要 没 这 那 一个 什么 自己 可以 因为 所以 如果 但是 然后 还是 没有 觉得 感觉 想要 一直 可能 已经 一下 一些 这个 那个 我们 他们 你们 时候 真的 比较 还有 或者 而且 只是 不是 就是 能够 需要 希望 担心 发生 拥有 带来 会有 怎么 为什么".split(" "));
const stopEn = new Set("the and for you are but not with that this have has had was were will would could should about what when then than them they their there from into just like feel feeling want wants more most never ever very much really myself it's i'm i'd i've don't".split(" "));

const cjk = /[㐀-鿿]/;

function wordsOf(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
    for (const part of segmenter.segment(lower)) if (part.isWordLike) found.push(part.segment);
  } else {
    // Fallback: overlapping two-character windows over Chinese runs, whole words otherwise.
    for (const run of lower.match(/[㐀-鿿]+|[a-z']+/g) || []) {
      if (cjk.test(run)) for (let i = 0; i + 2 <= run.length; i += 1) found.push(run.slice(i, i + 2));
      else found.push(run);
    }
  }
  return found.filter((word) => {
    if (/^\d+$/.test(word)) return false;
    if (cjk.test(word)) return [...word].length >= 2 && !stopZh.has(word);
    return word.length >= 3 && !stopEn.has(word);
  });
}

/** Words she wrote in more than one answer, most frequent first. Each answer counts a word once. */
export function repeatedWords(goals: ReflectionGoal[], options: { min?: number; limit?: number } = {}): RepeatedWord[] {
  const min = options.min ?? 2;
  const limit = options.limit ?? 12;
  const table = new Map<string, RepeatedWord>();
  for (const goal of goals) {
    for (const question of reflectionQuestions) {
      const text = (goal.reflection[question.id] || "").trim();
      if (!text) continue;
      for (const word of new Set(wordsOf(text))) {
        const row = table.get(word) || { word, count: 0, where: [] };
        row.count += 1;
        row.where.push({ goalTitle: goal.title, question: question.id });
        table.set(word, row);
      }
    }
  }
  const rows = [...table.values()].filter((row) => row.count >= min);
  // Drop a word that is only a piece of a longer word with the same count (keep the fuller one).
  const kept = rows.filter((row) => !rows.some((other) => other !== row && other.count === row.count && other.word.length > row.word.length && other.word.includes(row.word)));
  return kept.sort((a, b) => b.count - a.count || b.word.length - a.word.length || a.word.localeCompare(b.word)).slice(0, limit);
}

/** A gentle check for words that may signal she is in danger. It only decides whether to show a caring note. */
export function mentionsSelfHarm(text: string) {
  return mentionsSuicide(text);
}

export function clipReflection(text: string) {
  return [...text].slice(0, MAX_REFLECTION_CHARS).join("");
}
