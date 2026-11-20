// Words that may mean she is thinking about ending her life, including the internet euphemisms
// readers actually use (紫砂 / 自鲨 for 自杀, 想不开, 噶了自己). Kept to self-directed phrases:
// "旧版本的 sp 去死" or "快撑不住了" about work are common and are not on this list.

const ZH = /自杀|紫砂|自鲨|轻生|寻死|想不开|不想活|活不下去|活着没意思|活着好累|想死|想去死|一了百了|结束(?:自己|我)?(?:的)?生命|结束自己|离开这个世界|伤害自己|割腕|跳楼|吞药|没有我.{0,6}(?:会)?更好|不想醒来/;
const EN = /kill myself|suicid|end my life|end it all|want to die|wanna die|hurt myself|no reason to live|better off without me|don't want to wake up|unalive/i;

/** True when the text may be about ending her own life. Used where no conversation follows (Reframe, affirmations, scripts). */
export function mentionsSuicide(text: string) {
  return ZH.test(text) || EN.test(text);
}

/** A short, caring reply for those places: stop the practice, ask about safety, point to real people and local help. */
export function crisisPause(lang: "zh" | "en", name: string, localLine: string) {
  // without a name the line simply starts with what she wrote, never "你，你写下…"
  const call = name && name !== "你" && name.toLowerCase() !== "you" ? name : "";
  return lang === "zh"
    ? `${call ? `${call}，` : ""}你写下的这句话很重，我先不把它转成别的。你现在安全吗？请现在联系一个你信任、能来到你身边的人；如果危险就在眼前，请立刻拨打当地紧急电话。你的愿望没有被否定，你更没有。${localLine ? `\n\n${localLine}` : ""}`
    : `${call ? `${call}, w` : "W"}hat you wrote matters, so I won't turn it into something else. Are you safe right now? Please reach someone you trust who can be with you; if danger is immediate, call your local emergency number now. Your desire is not being rejected, and neither are you.${localLine ? `\n\n${localLine}` : ""}`;
}
