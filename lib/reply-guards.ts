// Deterministic guards around the model's reply. Pure functions so they can be unit-tested with plain Node.
// Prompts can only ask the model to avoid certain habits; these make the most visible ones impossible.

/** The client shows this text when the AI call fails. It must never be treated as something the AI said. */
export function isErrorEcho(message: { role?: string; text?: string }) {
  return message.role === "ai" && /AI 当前没有连接成功|the AI could not connect|AI could not connect/i.test(message.text || "");
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

export function hasStockCoachLine(text: string) {
  return /这一秒|3\s*d[里裡的中\s]{0,4}(?:只[是有])?(?:一|这|那)[帧幀]|(?:你|她)(?:已经)?选(?:择|定)?的(?:那一?(?:个)?|这个)?(?:版本|一版|故事|画面)|那个版本里|(?:别|不要|无视)\s*(?:去)?(?:管|看)?\s*3\s*d|(?:one|just a|that) frame (?:of|in) (?:the )?3d|(?:version|reality) you (?:chose|picked)|ignore (?:the )?3d/i.test(text);
}

export function coachSpecificityRetryNote(lang: "zh" | "en") {
  return lang === "zh"
    ? "重写 reply 中的套话，直接表达它原本想说明的意思。保留首句对用户的具体承接和本轮适用的理论解释。对照最近对话，删去重复的修饰词、比喻和建议，不用换词继续同一个比喻。不新加台词、场景或练习，不预言他人的行为。其他 JSON 字段保持不变。"
    : "Rewrite the stock phrasing in reply directly. Preserve the specific acknowledgment and relevant theory explanation. Remove repeated descriptors, metaphors, and advice from recent turns instead of rephrasing the same metaphor. Add no script, scene, exercise, or prediction of someone else's behavior. Keep the other JSON fields unchanged.";
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

/**
 * She says she wants to stop (bye, not chatting any more, going to sleep). The service must stop at once and not
 * keep her talking, so the route answers with a fixed farewell instead of asking the model. Whole-message matches
 * only, so a sentence that merely contains one of these words is never treated as leaving.
 */
const ZH_EXIT = /^(?:好的?|嗯+|那|那我|好吧)*(?:我先?|先|就)?(?:不聊了?|不说了?|不想聊了?|不想说了?|不想再聊了?|别聊了|别说了|走了|走啦|下线了?|退出|退出对话|结束对话|停止对话|先这样|就这样|到这(?:里|儿)|今天(?:就|先)?到这(?:里|儿)?|再见|拜拜|拜拜啦|拜|88|886|晚安|去睡了|去睡觉了|要睡了|去忙了)(?:了|吧|啦|哦|呀|哈|的)*(?:谢谢|谢了|多谢)?$/;
const EN_EXIT = /^(?:bye(?: bye)?|goodbye|good ?night|gotta go|i(?:'ve got| have)? to go|i(?:'m| am) (?:done|leaving|going now)|that'?s (?:all|it)|stop|quit|exit|end (?:the )?chat|talk (?:to you )?later|see you(?: later)?|let'?s stop|i(?:'ll| will) stop here)$/;

export function isExitIntent(text: string) {
  const raw = (text || "").trim();
  if (!raw || raw.length > 30) return false;
  const zh = raw.replace(/[\s。！!？?，,、…~～.]+/g, "");
  const en = raw.toLowerCase().replace(/[。！!？?，,、…~～.]+/g, "").replace(/\s+/g, " ").trim();
  return ZH_EXIT.test(zh) || EN_EXIT.test(en);
}

export function exitReply(lang: "zh" | "en") {
  return lang === "zh" ? "好的，今天就到这里。照顾好自己。" : "Okay, we'll stop here. Take care of yourself.";
}
