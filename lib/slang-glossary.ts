// What readers mean by the shorthand of Chinese manifesting communities, counted from real comments.
// Only the terms she actually used this turn are sent, so the companion understands her without
// being taught to talk in jargon.

const TERMS: Array<[RegExp, string]> = [
  [/💐|🌸|鲜花/, "💐、🌸、鲜花 = 显化（代称）"],
  [/(?:^|[\u4e00-\u9fff])a(?![A-Za-z])/i, "a / 狂a = 念肯定语、反复默念；非a = 和肯定语相反的念头"],
  [/kdy/i, "kdy = 肯定语（拼音缩写），她反复念的那句话"],
  [/(?<![A-Za-z])md(?![A-Za-z])/i, "md = mental diet，管住自己的念头，不跟着负面想法走"],
  [/(?<![A-Za-z])n?sp(?![A-Za-z])/i, "sp = 她想显化的那个特定的人"],
  [/3d/i, "3D = 眼前的现实；坏 3D / 反向 3D = 现实看起来在往反方向走；刷在 3D、落地 = 在现实里实现了"],
  [/秒显/, "秒显 = 很快就实现"],
  [/终点/, "站终点 / 活在终点 = 用愿望已经实现的身份去想、去生活"],
  [/小我/, "小我 = 头脑里担心、评判的那个声音"],
  [/旧版本|新版本|皮套/, "旧版本、新版本、皮套 = 旧的自我设定和新的自我设定"],
  [/补帧/, "补帧 = 实现以后，头脑自动补上一段合理的经过"],
  [/起念|纯念/, "起念 = 动了想要的念头；纯念 = 不夹着担心的单纯念头"],
  [/(?<![A-Za-z])sub(?![A-Za-z])/i, "sub = subliminal，潜意识音频"],
  [/代显化/, "代显化 = 替别人显化"],
  [/shifting|(?<![A-Za-z])dr(?![A-Za-z])/i, "shifting = 现实转移；dr = 她想去的那个现实"],
  [/上岸/, "上岸 = 考上、考试通过"],
  [/plq/i, "plq = 评论区"],
  [/紫砂|自鲨/, "紫砂、自鲨 = 自杀的谐音，要当成危机认真对待"],
];

/** Lines explaining the shorthand she used; empty when she used none. */
export function slangNotes(text: string): string[] {
  return TERMS.filter(([pattern]) => pattern.test(text)).map(([, meaning]) => meaning);
}

export function slangBlock(lang: "zh" | "en", text: string) {
  if (lang !== "zh") return "";
  const notes = slangNotes(text);
  if (!notes.length) return "";
  return `她用到的显化圈说法（听懂就好；回复可以顺着她用过的词，不主动教她新的说法）：\n${notes.map((note) => `- ${note}`).join("\n")}`;
}
