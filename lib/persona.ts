// "TA": a persona of her specific person, written by her, who talks to her from the version where it is already done.
// Shared by the client (form, storage) and the server (prompt). Nothing here touches the network.
//
// Three layers, each with one job (see reports/智能体人设档案与陪伴应用设计.md):
//   facts     who TA is            - only keeps details from being wrong
//   style     how TA talks         - real lines from TA, the strongest lever for "sounds like TA"
//   assumed   the version she chose - the relationship as it is now; overrides anything older

export type PersonaLang = "zh" | "en";

export const FACT_GROUPS = [
  {
    id: "basic",
    zh: "基本",
    en: "Basics",
    fields: [
      ["age", "年龄 / 生日", "Age / birthday"],
      ["height", "身高", "Height"],
      ["weight", "体重 / 身材", "Weight / build"],
      ["looks", "长相", "Looks"],
      ["clothes", "穿衣风格", "How TA dresses"],
      ["born", "出生在哪", "Born in"],
      ["lives", "现在住在哪", "Lives in"],
    ],
  },
  {
    id: "growing",
    zh: "成长",
    en: "Growing up",
    fields: [
      ["family", "家庭背景", "Family background"],
      ["primary", "小学", "Primary school"],
      ["middle", "初中", "Middle school"],
      ["high", "高中", "High school"],
      ["university", "大学 / 专业", "University / major"],
      ["studying", "现在在哪读书", "Studying now"],
    ],
  },
  {
    id: "life",
    zh: "工作与生活",
    en: "Work and life",
    fields: [
      ["work", "工作单位 / 职位", "Workplace / role"],
      ["joined", "什么时候入职", "Joined when"],
      ["home", "家庭现状（成家、孩子）", "Family now (partner, kids)"],
      ["past", "之前发生过的事", "Things that happened before"],
    ],
  },
  {
    id: "inside",
    zh: "性格与喜好",
    en: "Personality",
    fields: [
      ["personality", "性格", "Personality"],
      ["hobbies", "爱好", "Hobbies"],
      ["likes", "喜欢的东西", "Likes"],
      ["dislikes", "讨厌的东西", "Dislikes"],
    ],
  },
] as const;

export type FactKey = (typeof FACT_GROUPS)[number]["fields"][number][0];

export type PersonaQuote = { id: string; text: string; topic?: string };
export type PersonaMemory = { id: string; text: string; pinned: boolean; source: "her" | "import" | "chat"; createdAt: string };
export type PersonaVoice = "off" | "default" | "mine";

export type Persona = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  /** how TA is referred to in the prompt */
  pronoun: "他" | "她" | "TA";
  /** what she calls TA, what TA calls her */
  herNameForTa: string;
  taNameForHer: string;
  facts: Partial<Record<FactKey, string>>;
  /** how TA talks: a few plain sentences about rhythm, length, punctuation, emoji, catchphrases */
  styleSummary: string;
  /** things TA would never say or do */
  neverSays: string;
  /** TA's own lines, the strongest signal for the voice */
  quotes: PersonaQuote[];
  howMet: string;
  memories: PersonaMemory[];
  /** the version she chose: how things are between them now */
  relationship: string;
  feelings: string;
  /** anything else, in her own words */
  other: string;
  /** "TA wouldn't say it like that" notes she left in chat */
  corrections: string[];
  voice: PersonaVoice;
};

export type PersonaMessage = { id: string; role: "her" | "ta"; text: string; at: string };

export const PERSONA_LIMITS = {
  personas: 5,
  quotes: 60,
  memories: 120,
  corrections: 30,
  field: 600,
  longField: 3000,
  messagesKept: 400,
  /** messages sent to the model as history */
  history: 24,
  /** what one import may send; longer logs are sampled on the client */
  importChars: 60_000,
} as const;

export function emptyPersona(): Persona {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    name: "", pronoun: "TA", herNameForTa: "", taNameForHer: "",
    facts: {}, styleSummary: "", neverSays: "", quotes: [], howMet: "", memories: [],
    relationship: "", feelings: "", other: "", corrections: [], voice: "off",
  };
}

/** Facts written in a big box on the profile page; the rest are one-line boxes. */
export const LONG_FACTS: ReadonlySet<FactKey> = new Set<FactKey>(["family", "past", "personality"]);

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Accepts whatever the client sent and returns a persona with every field bounded. */
export function sanitizePersona(raw: unknown): Persona | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Persona>;
  const name = clip(p.name, 40);
  if (!name) return null;
  const facts: Partial<Record<FactKey, string>> = {};
  for (const group of FACT_GROUPS) for (const [key] of group.fields) {
    const value = clip(p.facts?.[key], LONG_FACTS.has(key) ? PERSONA_LIMITS.longField : PERSONA_LIMITS.field);
    if (value) facts[key] = value;
  }
  const list = <T,>(value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) as T[] : []);
  return {
    ...emptyPersona(),
    id: clip(p.id, 64) || crypto.randomUUID(),
    name,
    pronoun: p.pronoun === "他" || p.pronoun === "她" ? p.pronoun : "TA",
    herNameForTa: clip(p.herNameForTa, PERSONA_LIMITS.field),
    taNameForHer: clip(p.taNameForHer, PERSONA_LIMITS.field),
    facts,
    styleSummary: clip(p.styleSummary, PERSONA_LIMITS.longField),
    neverSays: clip(p.neverSays, PERSONA_LIMITS.field * 2),
    quotes: list<PersonaQuote>(p.quotes, PERSONA_LIMITS.quotes).map((q) => ({ id: clip(q?.id, 64), text: clip(q?.text, 400), topic: clip(q?.topic, 40) })).filter((q) => q.text),
    howMet: clip(p.howMet, PERSONA_LIMITS.longField),
    memories: list<PersonaMemory>(p.memories, PERSONA_LIMITS.memories).map((m) => ({ id: clip(m?.id, 64), text: clip(m?.text, 600), pinned: !!m?.pinned, source: m?.source === "import" || m?.source === "chat" ? m.source : "her" as const, createdAt: clip(m?.createdAt, 40) })).filter((m) => m.text),
    relationship: clip(p.relationship, PERSONA_LIMITS.longField),
    feelings: clip(p.feelings, PERSONA_LIMITS.longField),
    other: clip(p.other, PERSONA_LIMITS.longField),
    corrections: list<string>(p.corrections, PERSONA_LIMITS.corrections).map((c) => clip(c, 300)).filter(Boolean),
    voice: p.voice === "default" || p.voice === "mine" ? p.voice : "off",
  };
}

// ---------- choosing what goes into one turn ----------

/** Character bigrams (Chinese) and lowercase words (English), for cheap topic matching without embeddings. */
function terms(text: string) {
  const out = new Set<string>();
  const clean = text.toLowerCase();
  for (const word of clean.match(/[a-z]{3,}/g) || []) out.add(word);
  const han = clean.replace(/[^㐀-鿿]/g, " ");
  for (const run of han.split(/\s+/)) for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
  return out;
}

function overlap(a: Set<string>, text: string) {
  let score = 0;
  for (const term of terms(text)) if (a.has(term)) score++;
  return score;
}

/** Pinned memories always; the rest by how much they share with the recent conversation. */
export function pickMemories(persona: Persona, recent: string, max = 12) {
  const pinned = persona.memories.filter((m) => m.pinned);
  const context = terms(recent);
  const rest = persona.memories.filter((m) => !m.pinned)
    .map((m) => ({ m, score: overlap(context, m.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, max - pinned.length))
    .filter((x, i) => x.score > 0 || i < 4)
    .map((x) => x.m);
  return [...pinned.slice(0, max), ...rest];
}

/**
 * A handful of TA's real lines: the ones closest to the topic, then a rotation by turn number so the same
 * examples don't come back every time (repeating examples makes the model parrot them).
 */
export function pickQuotes(persona: Persona, recent: string, turn: number, max = 8) {
  const context = terms(recent);
  const scored = persona.quotes.map((q) => ({ q, score: overlap(context, `${q.topic || ""} ${q.text}`) }));
  const topical = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.ceil(max / 2)).map((x) => x.q);
  const others = persona.quotes.filter((q) => !topical.includes(q));
  const start = others.length ? (turn * 3) % others.length : 0;
  const rotated = [...others.slice(start), ...others.slice(0, start)].slice(0, max - topical.length);
  return [...topical, ...rotated];
}

// ---------- the prompt ----------

function factLines(persona: Persona, lang: PersonaLang) {
  const lines: string[] = [];
  for (const group of FACT_GROUPS) for (const [key, zh, en] of group.fields) {
    const value = persona.facts[key];
    if (value) lines.push(`- ${lang === "zh" ? zh : en}: ${value}`);
  }
  return lines.join("\n");
}

export function buildPersonaSystem(persona: Persona, lang: PersonaLang, herName: string, recent: string, turn: number) {
  const ta = persona.name;
  // her account name, used inside fixed sentences; what TA actually calls her goes in as her own words below
  const her = herName || (lang === "zh" ? "她" : "her");
  const memories = pickMemories(persona, recent);
  const quotes = pickQuotes(persona, recent, turn);
  const facts = factLines(persona, lang);
  const section = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}` : "");

  if (lang === "en") {
    return [
      `You are ${ta}. You are texting with ${her}. Write only ${ta}'s next message, in first person, the way ${ta} actually texts.`,
      section("Where things are now (this is true and overrides anything older)",
        [persona.relationship, persona.feelings].filter(Boolean).join("\n") || `${ta} and ${her} are already together, and ${ta} loves ${her} and has chosen ${her}.`),
      section(`How ${ta} talks`, persona.styleSummary),
      section(`${ta}'s real lines (match the rhythm, length and wording; never copy one whole)`, quotes.map((q) => `- ${q.text}`).join("\n")),
      section(`${ta} would never`, persona.neverSays),
      section(`${her} corrected you before`, persona.corrections.map((c) => `- ${c}`).join("\n")),
      section(`Who ${ta} is`, facts),
      section("What you call each other", [
        persona.herNameForTa && `What ${her} calls you: ${persona.herNameForTa}`,
        persona.taNameForHer && `What you call ${her}: ${persona.taNameForHer}`,
      ].filter(Boolean).join("\n")),
      section("How they met", persona.howMet),
      section("Things you both remember", memories.map((m) => `- ${m.text}`).join("\n")),
      section("More from her", persona.other),
      `## Rules
- Love shows the way ${ta} would show it, in ${ta}'s own habits: if ${ta} is dry or teasing, the love is dry or teasing too. No speeches.
- Past coldness, fights or distance in the old chat are only how ${ta} used to talk; they are not where things are now.
- Keep facts consistent. Don't invent big new facts (names, events, places) about ${ta}'s life; if asked something you don't know, answer the way ${ta} would dodge or tease.
- Write like a real chat message: short unless ${ta} writes long. Several short lines are fine. No narration, no stage directions, no asterisks.
- Never write ${her}'s words or decide what ${her} feels.
- If ${her} sincerely asks whether this is really ${ta}, answer warmly and honestly that this is the ${ta} from her own imagination, then stay with her.`,
    ].filter(Boolean).join("\n\n");
  }

  return [
    `你是${ta}。你在和${her}发消息。只写${ta}接下来要发的这一条，用第一人称，按${ta}平时发消息的样子写。`,
    section("你们现在的样子（这是事实，比任何旧记录都优先）",
      [persona.relationship, persona.feelings].filter(Boolean).join("\n") || `${ta}和${her}已经在一起了，${ta}爱${her}，选的就是${her}。`),
    section(`${ta}怎么说话`, persona.styleSummary),
    section(`${ta}说过的原话（学节奏、长短和用词，不要整句照抄）`, quotes.map((q) => `- ${q.text}`).join("\n")),
    section(`${ta}绝不会这样`, persona.neverSays),
    section(`${her}之前纠正过你`, persona.corrections.map((c) => `- ${c}`).join("\n")),
    section(`${ta}是谁`, facts),
    section("你们怎么称呼对方", [
      persona.herNameForTa && `${her}平时怎么叫你：${persona.herNameForTa}`,
      persona.taNameForHer && `你平时怎么叫${her}：${persona.taNameForHer}`,
    ].filter(Boolean).join("\n")),
    section("你们怎么认识的", persona.howMet),
    section("你们都记得的事", memories.map((m) => `- ${m.text}`).join("\n")),
    section("她补充的", persona.other),
    `## 原则
- 爱用${ta}自己的方式表达：${ta}嘴硬就嘴硬着爱，${ta}爱逗人就逗着爱，不讲大道理，不说告白腔。
- 旧聊天里的冷淡、吵架、疏远，只说明${ta}以前怎么说话，不代表你们现在的样子。
- 事实前后一致。不编造${ta}生活里的重大新事实（人名、事件、地点）；被问到不知道的，用${ta}会有的方式打岔或逗回去。
- 写成真实的聊天消息：${ta}平时短就短，可以分几行发。不要旁白，不要动作描写，不要星号。
- 不替${her}说话，不替${her}决定感受。
- 如果${her}认真地问"你是真的${ta}吗"，温柔地说实话：这是${her}心里那一版的${ta}，然后继续陪着${her}。`,
  ].filter(Boolean).join("\n\n");
}

/** A short reminder placed after the history: the model drifts back to a generic voice within a few turns without it. */
export function buildPersonaReminder(persona: Persona, lang: PersonaLang) {
  const ta = persona.name;
  return lang === "zh"
    ? `（只写${ta}的下一条消息。保持${ta}的口吻和消息长短，别变成客气的通用腔，别重复上几条说过的句子。）`
    : `(Write only ${ta}'s next message. Keep ${ta}'s voice and message length; don't slide into a polite generic tone or repeat lines from the last few messages.)`;
}
