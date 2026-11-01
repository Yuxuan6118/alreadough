// Deterministic guards around the model's reply. Pure functions so they can be unit-tested with plain Node.
// Prompts can only ask the model to avoid certain habits; these make the most visible ones impossible.

/** The client shows this text when the AI call fails. It must never be treated as something the AI said. */
export function isErrorEcho(message: { role?: string; text?: string }) {
  return message.role === "ai" && /AI 当前没有连接成功|the AI could not connect|AI could not connect/i.test(message.text || "");
}

/** Shorter user message, shorter reply. Chat only; stories and revisions keep their own length rules. */
export function replyLengthGuidance(userInput: string, lang: "zh" | "en") {
  const length = [...userInput.trim()].length;
  const zh = lang === "zh";
  // English runs roughly 2.2x longer than Chinese for the same content.
  const scale = zh ? 1 : 2.2;
  if (length <= 8) return { max_chars: Math.round(60 * scale), note: zh ? "她只发了几个字：一两句话就够，别展开，别提问以外的任何新话题。" : "She sent only a few words: one or two short sentences, no expansion." };
  if (length <= 30) return { max_chars: Math.round(110 * scale), note: zh ? "她说得不长：两三句就够。" : "She wrote little: two or three sentences." };
  if (length <= 120) return { max_chars: Math.round(180 * scale), note: zh ? "中等长度，接住重点即可。" : "Medium length: meet the main point." };
  return { max_chars: Math.round(260 * scale), note: zh ? "她写得比较多，可以多回一些，但别写成长文。" : "She wrote a lot; you may answer more fully, but not at essay length." };
}

/**
 * Remove the most visible AI tells from a reply.
 * - em-dashes become ordinary punctuation (every mode)
 * - a leading "Name," address is dropped, and extra quotation marks are removed (chat only,
 *   because stories legitimately use dialogue quotes)
 */
export function cleanReply(reply: string, options: { mode: "chat" | "revision" | "story"; name?: string }) {
  let text = reply.replace(/\s*——+\s*/g, "，").replace(/\s+—\s+/g, ", ");
  if (options.mode !== "chat") return text;

  const name = (options.name || "").trim();
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stripped = text.replace(new RegExp(`^\\s*${escaped}\\s*[，,：:、]\\s*`), "");
    if (stripped.trim()) text = stripped;
  }

  // Keep at most two quoted passages; drop the marks (not the words) on the rest.
  let pairs = 0;
  text = text.replace(/“([^”]*)”|"([^"\n]*)"/g, (match, a, b) => (++pairs <= 2 ? match : (a ?? b)));
  return text;
}

/**
 * The "negate, then pivot" frame: 不是X，是Y / 不是X而是Y / 与其说X不如说Y / "it's not X, it's Y".
 * Rewriting it by regex would break grammar, so the route asks the model to say the point directly instead.
 */
export function hasContrastFrame(text: string) {
  const zh = /(?:并)?不是[^。！？\n，,；;]{0,20}[，,；;]\s*(?:而)?是(?![的否不吗])|不是[^。！？\n]{0,24}而是|与其说[^。！？\n]{0,30}不如(?:说)?/;
  const en = /\b(?:it|that|this|you|there)(?:'s| is| was| are|'re)? not (?:just |only |about )?[^.!?\n]{0,40}[,;]\s*(?:it|that|this|but|you)(?:'s| is| was| are|'re)?\b|\bnot (?:just |only )?[^.!?\n]{0,30}, but\b|\bisn'?t [^.!?\n]{0,30}, (?:it|but)\b/i;
  return zh.test(text) || en.test(text);
}

export function contrastRetryNote(lang: "zh" | "en") {
  return lang === "zh"
    ? "上一版回复用了“不是……，是……”或“不是……而是……”这类先否定再转折的句式。保持同样的意思，输出同样的 JSON 结构，重写 reply：直接把意思说出来。其他字段保持不变。"
    : "Your last reply used a 'not X, it is Y' contrast. Keep the same meaning and the same JSON shape, and rewrite reply by saying the point directly, with no negate-then-pivot. Keep the other fields unchanged.";
}

/** For relationship goals: steer imagery toward closeness instead of household props. */
export function relationshipImagery(lang: "zh" | "en") {
  return lang === "zh"
    ? "她的愿望是和某个人的关系。需要画面或想象时，用亲密、温暖的东西：被他抱着、牵着手、额头靠着额头、靠在他肩上、他的体温和心跳、他叫她名字的声音、他亲她的额头或脸。可以从这些里选一个贴合她这句话的，别每次都用同一个，也别每次都写拥抱。不要用杯子、水、饭菜、窗光这类道具当画面的主角，除非她自己提过。她没要画面时就不写，先回应她这句话本身。"
    : "Her desire is about a relationship with a particular person. When an image or imagined moment helps, use closeness and warmth: being held by him, holding hands, foreheads together, leaning on his shoulder, his body heat and heartbeat, his voice saying her name, a kiss on the forehead or cheek. Pick one that fits what she just said; vary it, and do not default to a hug every time. Do not make props such as cups, water, food, or window light the center of the image unless she mentioned them. If she did not ask for an image, skip it and answer the thing she said.";
}
