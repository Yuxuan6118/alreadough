import { finishMemberRequest, settleBetaRequest } from "@/lib/beta-guard";
import { OPENAI_BASE_URL, chatContent, chatUsage, type ChatCompletion } from "@/lib/openai-base";
import { FACT_GROUPS, PERSONA_LIMITS, type PersonaLang } from "@/lib/persona";
import { beginPersonaRequest, personaError, personaModel } from "@/lib/persona-gate";

// Reads a pasted chat log once and returns what she can review: how TA talks, TA's real lines, facts and shared
// memories. The log itself is not stored anywhere, here or in logs.

const FACT_KEYS = FACT_GROUPS.flatMap((group) => group.fields.map(([key, zh]) => `${key}（${zh}）`)).join("、");

function instructions(lang: PersonaLang, taName: string, herName: string) {
  const her = herName || (lang === "zh" ? "她" : "her");
  return lang === "zh"
    ? `下面是一段聊天记录。记录里"${taName}"是 TA，${herName ? `"${herName}"是她自己` : "另一方是她自己"}。请只根据记录内容整理，输出 JSON：
{
  "style_summary": "4-8 句话写清 TA 怎么发消息：一条通常多长、会不会连发几条、标点和表情习惯、语气词、口头禅、怎么开玩笑、怎么表达关心。写具体的习惯，不写性格形容词。",
  "never_says": "TA 从来不会用的说法或语气，2-5 条，用分号隔开。",
  "quotes": [{"text": "TA 的一句原话，原样照录", "topic": "两三个字的话题"}],
  "nicknames": {"ta_calls_her": "TA 怎么称呼${her}", "she_calls_ta": "${her}怎么称呼 TA"},
  "facts": {"字段名": "记录里明确提到的事实"},
  "memories": ["一件你们之间发生过的具体的事、只有你们懂的梗或约定，一句话写清"]
}
要求：quotes 挑 15-30 句最能代表 TA 说话方式的原话，长短都要有，优先深夜聊天、开玩笑、关心人、闹别扭时说的；不要改字，不要挑${her}说的话。facts 只用这些字段名：${FACT_KEYS}，没提到的就不写。memories 最多 20 条，只写真实发生在记录里的事。不要做任何关系分析或评价。`
    : `Below is a chat log. In it "${taName}" is TA${herName ? `, and "${herName}" is her` : ", and the other side is her"}. Using only what is in the log, output JSON:
{
  "style_summary": "4-8 sentences on how TA texts: usual message length, whether TA sends several in a row, punctuation and emoji habits, filler words, catchphrases, how TA jokes and shows care. Concrete habits, not personality adjectives.",
  "never_says": "2-5 things TA never says or a tone TA never uses, separated by semicolons.",
  "quotes": [{"text": "one of TA's real lines, verbatim", "topic": "a 1-3 word topic"}],
  "nicknames": {"ta_calls_her": "what TA calls her", "she_calls_ta": "what she calls TA"},
  "facts": {"field": "a fact clearly stated in the log"},
  "memories": ["one specific thing that happened between them, an inside joke or a promise, in one sentence"]
}
Rules: pick 15-30 quotes that best show how TA talks, mixed lengths, favouring late-night talk, jokes, care and small fights; copy them exactly and never pick her lines. For facts use only these field names: ${FACT_GROUPS.flatMap((g) => g.fields.map(([key, , en]) => `${key} (${en})`)).join(", ")}; leave out anything not mentioned. At most 20 memories, only things that really happen in the log. No analysis or judgement of the relationship.`;
}

export async function POST(request: Request) {
  let body: { lang?: unknown; sessionId?: unknown; taName?: unknown; herName?: unknown; log?: unknown };
  try { body = await request.json() as typeof body; } catch { return personaError("INVALID_JSON", "zh", 400); }
  const lang: PersonaLang = body.lang === "en" ? "en" : "zh";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  const taName = typeof body.taName === "string" ? body.taName.trim().slice(0, 40) : "";
  const herName = typeof body.herName === "string" ? body.herName.trim().slice(0, 40) : "";
  const log = typeof body.log === "string" ? body.log.slice(0, PERSONA_LIMITS.importChars) : "";
  if (!sessionId || !taName || log.trim().length < 40) return personaError("INVALID_REQUEST", lang, 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return personaError("AI_PAUSED", lang, 503);
  const gate = await beginPersonaRequest(request, sessionId);
  if (!gate.ok) return personaError(gate.code, lang, gate.status);

  const startedAt = Date.now();
  let data: ChatCompletion | null = null;
  let ok = false;
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: personaModel(),
        messages: [{ role: "system", content: instructions(lang, taName, herName) }, { role: "user", content: log }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        enable_thinking: false,
      }),
    });
    data = await response.json() as ChatCompletion;
    ok = response.ok;
  } catch (error) {
    console.error("persona import failed", String(error));
  }
  const usage = data ? chatUsage(data) : null;
  let parsed: Record<string, unknown> | null = null;
  try { parsed = ok && data ? JSON.parse(chatContent(data).trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) : null; } catch { parsed = null; }
  await settleBetaRequest(gate.ticket, usage, { success: !!parsed, latencyMs: Date.now() - startedAt });
  await finishMemberRequest(gate.ticket, usage, !!parsed);
  if (!parsed) return personaError("AI_REQUEST_FAILED", lang, 502);

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const keys = new Set<string>(FACT_GROUPS.flatMap((g) => g.fields.map(([key]) => key)));
  const facts: Record<string, string> = {};
  if (parsed.facts && typeof parsed.facts === "object") {
    for (const [key, value] of Object.entries(parsed.facts as Record<string, unknown>)) {
      const clean = key.replace(/[（(].*$/, "").trim();
      if (keys.has(clean) && str(value, 600)) facts[clean] = str(value, 600);
    }
  }
  const nick = (parsed.nicknames || {}) as Record<string, unknown>;
  return Response.json({
    styleSummary: str(parsed.style_summary, 3000),
    neverSays: str(parsed.never_says, 1200),
    quotes: (Array.isArray(parsed.quotes) ? parsed.quotes : []).slice(0, 40)
      .map((q) => ({ text: str((q as { text?: unknown })?.text ?? q, 400), topic: str((q as { topic?: unknown })?.topic, 40) }))
      .filter((q) => q.text),
    taNameForHer: str(nick.ta_calls_her, 40),
    herNameForTa: str(nick.she_calls_ta, 40),
    facts,
    memories: (Array.isArray(parsed.memories) ? parsed.memories : []).slice(0, 20).map((m) => str(m, 600)).filter(Boolean),
  }, { headers: { "Cache-Control": "no-store" } });
}
