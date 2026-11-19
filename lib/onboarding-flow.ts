// The opening questions. Pure data and pure functions so the order can be tested without a browser.
//
// Shape of the flow:
//   head      name, country, a line about her, a plain-words note on how her answers are kept
//   wish      one module per desire: the wish, its kind, what makes it concrete, the ordinary day it is already
//             true, how much she wants it, the sentence that keeps pulling her back, early signs, what not to mention
//   more      "add another desire?"  (each extra desire runs a shorter module)
//   tail      people who matter, topics to leave alone, her present situation

export type OnboardingLang = "zh" | "en";
export type WishKind = "relationship" | "wealth" | "self" | "lifestyle" | "other";
export type StepType = "text" | "long" | "category" | "scale" | "people" | "info" | "style" | "more";

export type StepDef = {
  id: string;
  type: StepType;
  /** She can leave it empty and move on. */
  optional: boolean;
  /** The companion answers after this step. */
  reply: boolean;
  /** The text is a one-line answer, not a paragraph. */
  short?: boolean;
  prompt: Record<OnboardingLang, string>;
  hint?: Record<OnboardingLang, string>;
  placeholder?: Record<OnboardingLang, string>;
};

const step = (def: StepDef): StepDef => def;

export const STEPS: Record<string, StepDef> = {
  welcome: step({ id: "welcome", type: "info", optional: false, reply: false,
    prompt: { zh: "欢迎来到 AlreaDough", en: "Welcome to AlreaDough" },
    hint: { zh: "接下来我会问你一些问题，大约 5 分钟。你写得越具体，AlreaDough 的回复就越贴合你的情况。你写的内容只保存在你自己的空间里，可以随时修改或删除。", en: "I will ask you a few questions, about 5 minutes. The more detail you share, the more closely AlreaDough can respond to your situation. What you write stays in your own space, and you can edit or delete it anytime." } }),
  name: step({ id: "name", type: "text", optional: false, reply: false, short: true,
    prompt: { zh: "我该怎么称呼你？", en: "What should I call you?" },
    hint: { zh: "先用一个你喜欢的称呼。之后都可以改。", en: "Start with a name that feels like you. You can change it later." },
    placeholder: { zh: "你的名字或昵称", en: "Your name or nickname" } }),
  country: step({ id: "country", type: "text", optional: false, reply: false, short: true,
    prompt: { zh: "你现在在哪个国家或地区、哪个城市？", en: "Which country or region, and which city, are you in now?" },
    hint: { zh: "城市层级就够了。你分享的地点会帮助 AlreaDough 更贴合你的生活环境。", en: "A city is enough. Knowing where you live helps AlreaDough respond with your surroundings in mind." },
    placeholder: { zh: "例如：美国纽约、中国广东深圳", en: "e.g. New York, US · Shenzhen, China" } }),
  about: step({ id: "about", type: "long", optional: true, reply: false,
    prompt: { zh: "现在的你是怎样的人？", en: "Who are you right now?" },
    hint: { zh: "可以写你的性格、在意的事和最近的变化。你写得越具体，AlreaDough 的回复就越贴合你的情况。", en: "Share your personality, what matters to you, or what has changed lately. Details help AlreaDough respond to your situation." },
    placeholder: { zh: "比如：和 SP 一个月没联系了、正在备考、最近在找工作。", en: "For example: We haven’t been in touch for a month, I’m studying for an exam, or I’m looking for work." } }),
  note: step({ id: "note", type: "info", optional: false, reply: false,
    prompt: { zh: "接下来会问到感情、家人和你的状态。", en: "Next come a few questions about love, family and how you are." },
    hint: { zh: "写下你愿意分享的细节。AlreaDough 会参考这些内容，让回复更贴合你的情况。你可以在“我的空间”修改或删除。", en: "Share the details you are comfortable with. AlreaDough will use them to tailor its replies. You can edit or delete your answers in My Space." } }),

  wish: step({ id: "wish", type: "long", optional: false, reply: true,
    prompt: { zh: "你最想先显化的是什么？", en: "What do you most want to manifest first?" },
    hint: { zh: "不用写得完美，就用你自己的话。放开想，不用现实。", en: "No need to word it perfectly. Say it your way, and don't be realistic." },
    placeholder: { zh: "比如：考到理想成绩、拿到心仪的 Offer、和TA复联复合。", en: "For example: Reach my target exam score, get an offer for a job I’m excited about, or reconnect with them and get back together." } }),
  category: step({ id: "category", type: "category", optional: false, reply: false,
    prompt: { zh: "它更接近哪一类？", en: "Which kind is it closest to?" } }),

  // relationship
  sp_name: step({ id: "sp_name", type: "text", optional: true, reply: false, short: true,
    prompt: { zh: "你已经有特定对象，还是想遇见新的人？", en: "Is there a specific person, or would you like to meet someone new?" } }),
  rel_state: step({ id: "rel_state", type: "long", optional: true, reply: false,
    prompt: { zh: "说说你们现在的关系和相处情况。", en: "Tell us where your relationship stands and how you interact now." },
    placeholder: { zh: "比如：刚认识、暧昧中、异地、断联一段时间，或已经重新联系。也可以写你们平时多久联系一次。", en: "For example: We just met, we’re figuring things out, we’re long-distance, we’ve lost touch, or we recently reconnected. Add how often you talk if it helps." } }),
  rel_who: step({ id: "rel_who", type: "long", optional: true, reply: false,
    prompt: { zh: "TA 是个什么样的人？", en: "What kind of person are they?" },
    hint: { zh: "家境、职业、穿着、说话的样子、小习惯，想到什么写什么。AI 为你写剧本时会照着写。", en: "Background, work, how they dress, how they talk, little habits. Whatever comes to mind. The AI follows it when it writes your scripts." },
    placeholder: { zh: "比如：家里条件很好，穿衣讲究但不张扬，说话慢，紧张时会摸耳朵。", en: "For example: comes from money, dresses well but quietly, speaks slowly, touches his ear when nervous." } }),
  rel_close: step({ id: "rel_close", type: "long", optional: true, reply: false,
    prompt: { zh: "你想要的亲密是什么样子？", en: "What does the closeness you want look like?" },
    hint: { zh: "拥抱、牵手、TA 的声音、TA 怎样对你。", en: "A hug, holding hands, their voice, how they treat you." },
    placeholder: { zh: "比如：每天都有小惊喜，忙完会分享今天的小事，有分歧也能和平解决。", en: "For example: We have little surprises every day, share little things about our day, and resolve disagreements peacefully." } }),

  // wealth and work
  wealth_form: step({ id: "wealth_form", type: "long", optional: true, reply: false,
    prompt: { zh: "它具体是什么形态？", en: "What exactly does it look like?" },
    hint: { zh: "收入数字、offer、项目、客户、一间公司。", en: "An income figure, an offer, a project, a client, a company." } }),
  wealth_when: step({ id: "wealth_when", type: "long", optional: true, reply: false,
    prompt: { zh: "它出现的那一天，你在哪里、谁第一个知道？", en: "The day it arrives: where are you, and who knows first?" } }),

  // self
  self_who: step({ id: "self_who", type: "long", optional: true, reply: false,
    prompt: { zh: "你想成为怎样的人？", en: "Who do you want to be?" } }),
  self_body: step({ id: "self_body", type: "long", optional: true, reply: false,
    prompt: { zh: "那时候的身体是什么感觉？别人怎么看见你？", en: "What does your body feel like then, and how do others see you?" } }),

  // lifestyle
  life_where: step({ id: "life_where", type: "long", optional: true, reply: false,
    prompt: { zh: "在哪座城市，住在什么样的地方？", en: "Which city, and what kind of place?" } }),
  life_morning: step({ id: "life_morning", type: "long", optional: true, reply: false,
    prompt: { zh: "那里的一个普通早晨是什么样的？", en: "What does an ordinary morning there look like?" } }),

  // anything else
  other_moment: step({ id: "other_moment", type: "long", optional: true, reply: false,
    prompt: { zh: "它已经发生的那一刻，你在哪里，身边有谁？", en: "The moment it has already happened: where are you, and who is with you?" } }),

  scene: step({ id: "scene", type: "long", optional: true, reply: true,
    prompt: { zh: "想象愿望落地后平凡的一天，你会做些什么？", en: "Imagine an ordinary day after your wish comes true. What would you do?" },
    hint: { zh: "可以写你在哪儿、在做什么、身边有谁。细节越具体，AlreaDough 越能写出贴合你的场景。", en: "Describe where you are, what you are doing, and who is with you. Details help AlreaDough write a scene that fits you." } }),
  intensity: step({ id: "intensity", type: "scale", optional: false, reply: false,
    prompt: { zh: "你有多想要它？", en: "How much do you want it?" },
    hint: { zh: "它会决定愿望卡的先后顺序。", en: "It sets the order of your desire cards." } }),
  pullback: step({ id: "pullback", type: "long", optional: true, reply: true,
    prompt: { zh: "哪些想法或经历会让你对这个愿望动摇？", en: "What thoughts or experiences make you doubt this desire?" },
    hint: { zh: "可以写它在什么情况下出现、你当时怎么想，以及你想怎么回应。", en: "Describe when it comes up, what you think in that moment, and how you want to respond." } }),
  evidence: step({ id: "evidence", type: "long", optional: true, reply: false,
    prompt: { zh: "有哪些小变化，让你觉得自己正在靠近这个愿望？", en: "What small changes make you feel closer to this desire?" } }),
  more: step({ id: "more", type: "more", optional: false, reply: false,
    prompt: { zh: "还有别的愿望想一起放进来吗？", en: "Any other desire you want to bring in?" },
    hint: { zh: "你可以同时显化很多件事。每个愿望都会有自己的一张卡。", en: "You can manifest many things at once. Each desire gets its own card." } }),

  // no AI line here: it kept inventing details about people she only named
  people: step({ id: "people", type: "people", optional: true, reply: false,
    prompt: { zh: "有哪些人对你很重要？", en: "Who matters most to you?" },
    hint: { zh: "名字加一句 TA 是谁，至少添加一位。我之后会记得。", en: "A name and a line about who they are. Add at least one. I will remember." } }),
  never: step({ id: "never", type: "long", optional: true, reply: false,
    prompt: { zh: "有哪些话题，你不希望我提？", en: "Which topics do you not want me to bring up?" } }),
  situation: step({ id: "situation", type: "long", optional: true, reply: false,
    prompt: { zh: "你现在过着怎样的日子？", en: "What does your life look like right now?" },
    hint: { zh: "可以写你最近的学习、工作、生活节奏和在意的事。你写得越具体，AlreaDough 的回复就越贴合你的情况。", en: "Describe your studies, work, routine, or what matters lately. Details help AlreaDough respond to your situation." } }),
};

const WISH_SPECIFICS: Record<WishKind, string[]> = {
  relationship: ["sp_name", "rel_state", "rel_who", "rel_close"],
  wealth: ["wealth_form", "wealth_when"],
  self: ["self_who", "self_body"],
  lifestyle: ["life_where", "life_morning"],
  other: ["other_moment"],
};

export const HEAD_STEPS = ["welcome", "name", "country", "about", "note"];
export const TAIL_STEPS = ["people", "never", "situation"];

/** Steps for one desire. The first desire gets the full set; extra desires get a shorter one. */
export function wishModule(kind: WishKind | "", full: boolean): string[] {
  const specifics = kind ? WISH_SPECIFICS[kind] : [];
  if (!full) return ["wish", "category", ...specifics.slice(0, kind === "relationship" ? 2 : 1), "scene", "intensity"];
  return ["wish", "category", ...specifics, "scene", "intensity", "pullback", "evidence"];
}

export type FlowSlot = { wish: number | null; id: string };

/**
 * The whole ordered list, given what she has chosen so far.
 * `kinds[i]` is the kind of desire i ("" while she has not picked one).
 * `finished` flips true once she answers "that's all" at the last "add another?".
 * Adding a desire removes that "add another?" slot and puts the new desire's steps in its place.
 */
export function buildFlow(kinds: Array<WishKind | "">, finished: boolean): FlowSlot[] {
  const slots: FlowSlot[] = HEAD_STEPS.map((id) => ({ wish: null, id }));
  kinds.forEach((kind, index) => {
    for (const id of wishModule(kind, index === 0)) slots.push({ wish: index, id });
    // "add another?" is asked once, after the last desire so far
    if (index === kinds.length - 1) slots.push({ wish: index, id: "more" });
  });
  if (finished) for (const id of TAIL_STEPS) slots.push({ wish: null, id });
  return slots;
}

/** How many steps she has to go through if she adds no more desires and picks a kind with `specifics` questions. */
export function minimumLength(kind: WishKind): number {
  return buildFlow([kind], true).length;
}

export const WISH_KIND_OPTIONS: Array<{ id: WishKind; zh: string; en: string; zhHint: string; enHint: string }> = [
  { id: "relationship", zh: "关系与特定对象", en: "Relationships", zhHint: "爱情、友情、家庭或一位特定的人", enHint: "Love, friendship, family or one specific person" },
  { id: "wealth", zh: "金钱与事业", en: "Money and career", zhHint: "收入、工作、项目或机会", enHint: "Income, work, a project or an opportunity" },
  { id: "self", zh: "自我与状态", en: "Self", zhHint: "自我概念、身体感受或个人成长", enHint: "Self-image, how your body feels, growth" },
  { id: "lifestyle", zh: "生活与体验", en: "Life and experiences", zhHint: "居住、旅行、物品或生活方式", enHint: "Where you live, travel, things, a way of living" },
  { id: "other", zh: "其他愿望", en: "Something else", zhHint: "用你自己的方式定义它", enHint: "Define it your own way" },
];

export type OnboardingPerson = { id: string; name: string; relation: string };

export type WishAnswers = {
  wish: string;
  kind: WishKind | "";
  /** answers to the kind-specific questions, keyed by step id */
  specifics: Record<string, string>;
  scene: string;
  intensity: number;
  pullback: string;
  evidence: string;
  exclude: string;
};

export type OnboardingAnswers = {
  name: string;
  country: string;
  about: string;
  situation: string;
  never: string;
  people: OnboardingPerson[];
  wishes: WishAnswers[];
};

export const emptyWish = (): WishAnswers => ({ wish: "", kind: "", specifics: {}, scene: "", intensity: 3, pullback: "", evidence: "", exclude: "" });
export const emptyAnswers = (): OnboardingAnswers => ({ name: "", country: "", about: "", situation: "", never: "", people: [], wishes: [emptyWish()] });

/** Topics separated by line breaks or punctuation, with duplicates removed. */
export function splitLines(value: string, max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[\r\n、，,；;]+/)) {
    const line = raw.trim();
    const key = line.toLowerCase();
    if (!line || isNone(line) || seen.has(key)) continue;
    seen.add(key);
    out.push(line.slice(0, 80));
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Everything she told us about one desire, in her own words, as a short block the companion can read.
 * Nothing is added; empty answers are left out.
 */
export function wishBackground(wish: WishAnswers, lang: OnboardingLang): string {
  const zh = lang === "zh";
  const labels: Record<string, [string, string]> = {
    sp_name: ["TA 的称呼", "What they call them"],
    rel_state: ["TA 是谁，现在的状态", "Who they are and where things stand"],
    rel_close: ["想要的亲密", "The closeness they want"],
    wealth_form: ["具体的形态", "What it looks like"],
    wealth_when: ["它出现的那一天", "The day it arrives"],
    self_who: ["想成为的人", "Who they want to be"],
    self_body: ["那时的身体与别人的目光", "How their body feels and how others see them"],
    life_where: ["城市与住处", "City and home"],
    life_morning: ["那里的普通早晨", "An ordinary morning there"],
    other_moment: ["它已经发生的那一刻", "The moment it has happened"],
  };
  const lines: string[] = [];
  const meetingSomeoneNew = wish.specifics.relationship_target === "new";
  for (const [id, [zhLabel, enLabel]] of Object.entries(labels)) {
    if (meetingSomeoneNew && id === "sp_name") continue;
    if (meetingSomeoneNew && id === "rel_state") {
      const description = clean(wish.specifics.new_rel_state);
      const label = zh ? "想遇见的人和期待建立的关系" : "The person they want to meet and the relationship they want";
      if (description) lines.push(`${label}：${description}`);
      continue;
    }
    const text = clean(wish.specifics[id]);
    if (text) lines.push(`${zh ? zhLabel : enLabel}：${text}`);
  }
  if (clean(wish.scene)) lines.push(`${zh ? "它已经实现的普通一天" : "An ordinary day when it is true"}：${clean(wish.scene)}`);
  if (clean(wish.evidence)) lines.push(`${zh ? "看到的小迹象" : "Small signs they have seen"}：${clean(wish.evidence)}`);
  return lines.join("\n");
}

/** The name of the person a relationship desire is about, if she gave one. */
export function wishPersonName(wish: WishAnswers): string {
  return wish.specifics.relationship_target === "new" ? "" : clean(wish.specifics.sp_name);
}

/** Can she press Continue on this step? Every question needs an answer; "none" is an answer. */
export function canAdvance(stepId: string, answers: OnboardingAnswers, wishIndex: number | null): boolean {
  const def = STEPS[stepId];
  if (!def) return false;
  const wish = wishIndex === null ? null : answers.wishes[wishIndex];
  if (stepId === "sp_name" && wish?.specifics.relationship_target === "new") return true;
  switch (def.type) {
    case "category": return Boolean(wish && wish.kind);
    case "people": return answers.people.some((person) => person.name.trim());
    case "text":
    case "long": return stepAnswer(stepId, answers, wishIndex).trim().length > 0;
    default: return true;
  }
}


export type MemoryKindSeed = "person" | "place" | "event" | "preference" | "insight";
/** One thing she told us, shaped for the memory library. Her own words, nothing added. */
export type MemorySeed = { kind: MemoryKindSeed; title: string; detail: string; keywords: string[] };
/** Longest story setting kept per desire (characters). */
export const MAX_STORY_SETTING = 1500;
export type GoalSeed = { wishCategory: WishKind; desire: string; background: string; beliefs: string[]; spName: string; intensity: number; memories: MemorySeed[]; storySetting: string };
export type ProfileSeed = { country: string; about: string; situation: string; people: OnboardingPerson[]; neverInclude: string[] };

/** Every question has to be answered, so "none" is a real answer. It should not become a memory. */
export const isNone = (text: string | undefined) => /^(没有|无|暂无|还没有|还没|不知道|没什么|没啥|none|no|n\/a|nothing)[\s。.!！]*$/i.test((text || "").trim());
const clean = (text: string | undefined) => (isNone(text) ? "" : (text || "").trim());
const clip = (text: string | undefined, max: number) => clean(text).slice(0, max);
const seed = (kind: MemoryKindSeed, title: string, detail: string, keywords: string[] = []): MemorySeed | null => {
  const t = clip(title, 80), d = clip(detail, 600);
  return t && d ? { kind, title: t, detail: d, keywords: keywords.map((k) => clip(k, 24)).filter(Boolean).slice(0, 5) } : null;
};
const compact = (items: Array<MemorySeed | null>): MemorySeed[] => items.filter((item): item is MemorySeed => item !== null);

/** What she said about herself and her world: the same for every desire card. */
export function sharedMemories(answers: OnboardingAnswers, lang: OnboardingLang): MemorySeed[] {
  const zh = lang === "zh";
  return compact([
    seed("insight", zh ? "我是怎样的人" : "Who I am", answers.about),
    seed("place", zh ? "我所在的地方" : "Where I am", answers.country, [answers.country]),
    seed("insight", zh ? "我现在的日子" : "My life right now", answers.situation),
    ...answers.people.filter((person) => person.name.trim()).map((person) => seed("person", person.name, person.relation || (zh ? "对我很重要的人" : "Someone who matters to me"), [person.name])),
    ...(splitLines(answers.never).length ? [seed("preference", zh ? "不想被提的话题" : "Topics to leave alone", splitLines(answers.never).join(zh ? "、" : ", "))] : []),
  ]);
}

/** What she said about one desire. */
export function wishMemories(wish: WishAnswers, lang: OnboardingLang): MemorySeed[] {
  const zh = lang === "zh";
  const sp = wishPersonName(wish);
  const sp2 = wish.specifics;
  return compact([
    sp ? seed("person", sp, sp2.rel_state || (zh ? "我想要的那个人" : "The person I am manifesting"), [sp]) : null,
    sp2.relationship_target === "new" ? seed("preference", zh ? "想遇见的人和期待建立的关系" : "The person and relationship I want", sp2.rel_state) : null,
    seed("preference", zh ? "我想要的亲密" : "The closeness I want", sp2.rel_close),
    seed("insight", zh ? "它具体的样子" : "What it looks like", sp2.wealth_form),
    seed("event", zh ? "它出现的那一天" : "The day it arrives", sp2.wealth_when),
    seed("insight", zh ? "我想成为的人" : "Who I want to be", sp2.self_who),
    seed("insight", zh ? "那时的身体和别人的目光" : "How my body feels and how others see me", sp2.self_body),
    seed("place", zh ? "我想住的地方" : "Where I want to live", sp2.life_where),
    seed("event", zh ? "那里的普通早晨" : "An ordinary morning there", sp2.life_morning),
    seed("event", zh ? "它已经发生的那一刻" : "The moment it has happened", sp2.other_moment),
    seed("event", zh ? "愿望实现的普通一天" : "An ordinary day when it is true", wish.scene),
    seed("insight", zh ? "它正在靠近的小迹象" : "Small signs it is coming closer", wish.evidence),
  ]);
}

/** Turns what she answered into the pieces the app stores: one seed per desire, and one profile for her. */
export function answersToSeeds(answers: OnboardingAnswers, lang: OnboardingLang): { goals: GoalSeed[]; profile: ProfileSeed } {
  const shared = sharedMemories(answers, lang);
  const goals: GoalSeed[] = answers.wishes
    .filter((wish) => wish.wish.trim())
    .map((wish) => ({
      wishCategory: wish.kind || "other",
      desire: wish.wish.trim(),
      background: wishBackground(wish, lang),
      beliefs: clean(wish.pullback) ? [clean(wish.pullback)] : [],
      spName: wish.kind === "relationship" ? wishPersonName(wish) : "",
      // "what kind of person are they" goes into this desire's story setting
      storySetting: wish.kind === "relationship" ? clean(wish.specifics.rel_who).slice(0, MAX_STORY_SETTING) : "",
      intensity: Math.min(5, Math.max(1, Math.round(wish.intensity || 3))),
      memories: [...wishMemories(wish, lang), ...shared].slice(0, 40),
    }));
  const never = [...splitLines(answers.never), ...answers.wishes.flatMap((wish) => splitLines(wish.exclude))];
  const profile: ProfileSeed = {
    country: clean(answers.country).slice(0, 80),
    about: clean(answers.about).slice(0, 1200),
    situation: clean(answers.situation).slice(0, 1200),
    people: answers.people.filter((person) => person.name.trim()).slice(0, 12),
    neverInclude: splitLines(never.join("\n")),
  };
  return { goals, profile };
}

/** What she wrote on this step, as one string (empty when nothing). Shared by the page and by canAdvance. */
export function stepAnswer(stepId: string, answers: OnboardingAnswers, wishIndex: number | null): string {
  const wish = wishIndex === null ? null : answers.wishes[wishIndex];
  if (!wish) {
    switch (stepId) {
      case "name": return answers.name;
      case "country": return answers.country;
      case "about": return answers.about;
      case "never": return answers.never;
      case "situation": return answers.situation;
      case "people": return answers.people.map((person) => `${person.name}（${person.relation}）`).join("；");
      default: return "";
    }
  }
  switch (stepId) {
    case "wish": return wish.wish;
    case "scene": return wish.scene;
    case "rel_state": return wish.specifics[wish.specifics.relationship_target === "new" ? "new_rel_state" : "rel_state"] || "";
    case "pullback": return wish.pullback;
    case "evidence": return wish.evidence;
    case "exclude": return wish.exclude;
    default: return wish.specifics[stepId] || "";
  }
}
