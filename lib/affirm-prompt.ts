import type { CompanionLang } from "@/lib/already-ai";

/** Bedtime affirmations for her desire, or lines lifted from something she wrote. Server-side only. */
export function buildAffirmMessages(lang: CompanionLang, desire: string, from: string) {
  const zh = lang === "zh";
  const rules = zh ? `你为她写睡前每天听的肯定语。只输出 JSON：{"lines": ["……", "……"]}。

怎么写：
- 第一人称，现在时，一句一个意思，每句 20 个字以内。要有主语，不能只写关键词（只写「110 斤」不行，写「我现在 110 斤，身体很轻」）。
- 写结果，不写过程。就算她的愿望原话里写了「他主动来找我」「家里同意」，也只写结果，不写别人同意、批准、主动来找、终于回复，直接写成已经发生的样子：「家里同意我们结婚」写成「全家都真心祝福我们」；「他来找我复合了」写成「我和他在一起了」；「我一定能考到 650」写成「我轻松考到了 650」。
- 写她想要的状态，不写她怕的东西：「我能让焦虑飘走」写成「我很放松」。只有她平时说话本来就这么说，才保留「不用」「不再」。
- 像她跟朋友说话的口气，日常的词，不写口号，不用「宇宙」「能量」「频率」「显化」这类词，除非她自己用了。
- 换着用几种说法，不要每句都一个句式：
  · 直接的：「我已经……」「我是……」
  · 正在发生的：「我越来越……」「每天都更……」——给念「已经」会心虚的人。写的是结果本身越来越真，不写为了得到它要做的步骤（复习、等消息、努力）
  · 轻一点的入口：「如果能……就太好了」「万一我真的……呢」「我允许自己……」
  三种说法都要指向她原本想要的那个结果，不能换成泛泛的放松、爱自己。
- 保留她的人名、数字、地点、具体细节，不添加她没说过的事（她没提房子，就不写房子）。
- 不写医疗、治病、法律上的承诺；不写「一定要坚持」「越难越要撑」这类硬撑的话。
- 如果她的话里有被打、被伤害，不写让她忍下去的句子，写她自己安全、被好好对待的句子。` : `You write bedtime affirmations she will listen to every night. Output JSON only: {"lines": ["...", "..."]}.

How to write them:
- First person, present tense, one idea per line, under 15 words. Always a full sentence with a subject, never a bare keyword.
- Write the result, not the process. Even if her desire itself says "he reaches out first" or "my parents agree", write only the result: no one approving, agreeing, reaching out, or finally replying; write it as already done: "My family agrees to our wedding" becomes "My whole family celebrates us"; "He comes back to me" becomes "We are together"; "I will pass the exam" becomes "I passed the exam with ease".
- Write the state she wants, not the thing she fears: "I can let my anxiety float away" becomes "I am relaxed". Keep "no longer" only if that is how she naturally talks.
- Sound like her talking to a friend: everyday words, no slogans, no "universe", "energy", "vibration" or "manifest" unless she used them.
- Vary the form instead of repeating one pattern:
  · direct: "I am...", "I have..."
  · unfolding: "I am more and more...", "Every day I..." for when "already" feels untrue. It is the result itself becoming more real, not the steps to get it (studying, waiting, trying)
  · a softer way in: "It would be so nice if...", "What if I really...", "I allow myself..."
  All three point at the result she actually wants, never swapped for generic calm or self-love.
- Keep her names, numbers, places and specifics. Add nothing she never said (no flat if she never mentioned one).
- No medical, healing or legal promises; nothing about pushing through or holding on harder.
- If her words mention being hit or hurt, write no line that has her endure it; write lines about her being safe and treated well.`;
  const ask = from.trim()
    ? (zh ? `从下面这段她写下或聊到的话里，挑出或改写 2 到 4 句。只用这段话里有的内容。\n\n她的愿望：${desire}\n\n这段话：\n${from}` : `Pick or rewrite 2 to 4 lines from what she wrote or said below. Use only what is in it.\n\nHer desire: ${desire}\n\nWhat she wrote:\n${from}`)
    : (zh ? `为她的愿望写 6 句，大约一半直接的、两句正在发生的、一句轻一点的入口。\n\n她的愿望：${desire}` : `Write 6 lines for her desire: about half direct, two unfolding, one softer way in.\n\nHer desire: ${desire}`);
  return [
    { role: "system" as const, content: rules },
    { role: "user" as const, content: ask },
  ];
}

/** Lines out of the model's JSON; empty when it did not follow the format. */
export function affirmLines(text: string, lang: CompanionLang) {
  const limit = lang === "zh" ? 40 : 140;
  try {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return [];
    return parsed.lines
      .filter((line): line is string => typeof line === "string")
      .map((line) => line.replace(/^[\s\-*\d.、)）"“「]+|["”」]+$/g, "").trim())
      .filter((line) => line && line.length <= limit)
      .slice(0, 8);
  } catch { return []; }
}
