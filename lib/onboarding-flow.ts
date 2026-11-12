// The opening questions. Pure data and pure functions so the order can be tested without a browser.
//
// Shape of the flow:
//   head      name, country, a line about her, a plain-words note on how her answers are kept
//   wish      one module per desire: the wish, its kind, what makes it concrete, the ordinary day it is already
//             true, how much she wants it, the sentence that keeps pulling her back, early signs, what not to mention
//   more      "add another desire?"  (each extra desire runs a shorter module)
//   tail      people who matter, topics to leave alone, her present situation, how to be accompanied

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
  name: step({ id: "name", type: "text", optional: false, reply: false, short: true,
    prompt: { zh: "我该怎么称呼你？", en: "What should I call you?" },
    hint: { zh: "先用一个你喜欢的称呼。之后都可以改。", en: "Start with a name that feels like you. You can change it later." },
    placeholder: { zh: "例如：安安", en: "For example: Mia" } }),
  country: step({ id: "country", type: "text", optional: true, reply: false, short: true,
    prompt: { zh: "你现在在哪个国家或城市？", en: "Which country or city are you in now?" },
    hint: { zh: "只用来让场景更贴近你的生活。写国家就够了，也可以跳过。", en: "Only to make scenes closer to your life. A country is enough, or skip." },
    placeholder: { zh: "例如：美国俄亥俄", en: "For example: Ohio, USA" } }),
  about: step({ id: "about", type: "long", optional: true, reply: false,
    prompt: { zh: "用一句话说说，现在的你是怎样的人？", en: "In a sentence, who are you right now?" },
    hint: { zh: "写你自己愿意说的就好，只写你觉得相关的。", en: "Only what feels relevant to you." },
    placeholder: { zh: "例如：在读研究生、爱写东西、慢热", en: "For example: a grad student, loves writing, slow to warm up" } }),
  note: step({ id: "note", type: "info", optional: false, reply: false,
    prompt: { zh: "接下来会问到感情、家人和你的状态。", en: "Next come a few questions about love, family and how you are." },
    hint: { zh: "你写的内容会保存在你的空间里，只用来让陪伴更像你。每一题都可以跳过，也可以随时在“我的空间”修改或删除。", en: "What you write is kept in your space and used only to make the companionship fit you. Every question can be skipped, and you can edit or delete it anytime in My space." } }),

  wish: step({ id: "wish", type: "long", optional: false, reply: true,
    prompt: { zh: "你最想先显化的是什么？", en: "What do you most want to manifest first?" },
    hint: { zh: "不用写得完美，就用你自己的话。放开想，不用现实。", en: "No need to word it perfectly. Say it your way, and don't be realistic." },
    placeholder: { zh: "例如：他回到我身边 / 拿到纽约的 offer", en: "For example: he is back with me / I got the offer in New York" } }),
  category: step({ id: "category", type: "category", optional: false, reply: false,
    prompt: { zh: "它更接近哪一类？", en: "Which kind is it closest to?" } }),

  // relationship
  sp_name: step({ id: "sp_name", type: "text", optional: true, reply: false, short: true,
    prompt: { zh: "他或她的名字，或你对 TA 的称呼？", en: "Their name, or what you call them?" },
    hint: { zh: "还没有出现的人，可以跳过。", en: "Skip if this person has not appeared yet." },
    placeholder: { zh: "例如：Elvin", en: "For example: Elvin" } }),
  rel_state: step({ id: "rel_state", type: "long", optional: true, reply: false,
    prompt: { zh: "TA 是谁，你们现在是什么状态？", en: "Who are they, and where are you two now?" },
    placeholder: { zh: "例如：以前每天聊天，现在不联系了", en: "For example: we used to talk every day, now we don't" } }),
  rel_close: step({ id: "rel_close", type: "long", optional: true, reply: false,
    prompt: { zh: "你想要的亲密是什么样子？", en: "What does the closeness you want look like?" },
    hint: { zh: "拥抱、牵手、TA 的声音、TA 怎样对你。", en: "A hug, holding hands, their voice, how they treat you." },
    placeholder: { zh: "例如：他从身后抱住我，在我耳边说话", en: "For example: he holds me from behind and talks near my ear" } }),

  // wealth and work
  wealth_form: step({ id: "wealth_form", type: "long", optional: true, reply: false,
    prompt: { zh: "它具体是什么形态？", en: "What exactly does it look like?" },
    hint: { zh: "收入数字、offer、项目、客户、一间公司。", en: "An income figure, an offer, a project, a client, a company." },
    placeholder: { zh: "例如：每个月稳定进账五万", en: "For example: 5,000 a month, steadily" } }),
  wealth_when: step({ id: "wealth_when", type: "long", optional: true, reply: false,
    prompt: { zh: "它出现的那一天，你在哪里、谁第一个知道？", en: "The day it arrives: where are you, and who knows first?" },
    placeholder: { zh: "例如：在图书馆，我先告诉妈妈", en: "For example: in the library, and I tell my mom first" } }),

  // self
  self_who: step({ id: "self_who", type: "long", optional: true, reply: false,
    prompt: { zh: "你想成为怎样的人？", en: "Who do you want to be?" },
    placeholder: { zh: "例如：说话不再先道歉的人", en: "For example: someone who doesn't apologise first" } }),
  self_body: step({ id: "self_body", type: "long", optional: true, reply: false,
    prompt: { zh: "那时候的身体是什么感觉？别人怎么看见你？", en: "What does your body feel like then, and how do others see you?" },
    placeholder: { zh: "例如：肩膀放松，走进房间别人会看过来", en: "For example: shoulders loose, people look up when I walk in" } }),

  // lifestyle
  life_where: step({ id: "life_where", type: "long", optional: true, reply: false,
    prompt: { zh: "在哪座城市，住在什么样的地方？", en: "Which city, and what kind of place?" },
    placeholder: { zh: "例如：纽约，有大窗户的公寓", en: "For example: New York, an apartment with big windows" } }),
  life_morning: step({ id: "life_morning", type: "long", optional: true, reply: false,
    prompt: { zh: "那里的一个普通早晨是什么样的？", en: "What does an ordinary morning there look like?" },
    placeholder: { zh: "例如：咖啡的味道，窗外的街", en: "For example: the smell of coffee, the street outside" } }),

  // anything else
  other_moment: step({ id: "other_moment", type: "long", optional: true, reply: false,
    prompt: { zh: "它已经发生的那一刻，你在哪里，身边有谁？", en: "The moment it has already happened: where are you, and who is with you?" },
    placeholder: { zh: "用你自己的话", en: "In your own words" } }),

  scene: step({ id: "scene", type: "long", optional: true, reply: true,
    prompt: { zh: "它已经实现的那个普通的一天，你上午在做什么？", en: "On an ordinary day when it is already true, what are you doing this morning?" },
    hint: { zh: "一句话就好。", en: "One sentence is enough." },
    placeholder: { zh: "例如：在窗边喝咖啡，手机震了一下", en: "For example: coffee by the window, my phone buzzes" } }),
  intensity: step({ id: "intensity", type: "scale", optional: false, reply: false,
    prompt: { zh: "你有多想要它？", en: "How much do you want it?" },
    hint: { zh: "它会决定愿望卡的先后顺序。", en: "It sets the order of your desire cards." } }),
  pullback: step({ id: "pullback", type: "long", optional: true, reply: true,
    prompt: { zh: "有没有一句话，总在把你往回拉？", en: "Is there a sentence that keeps pulling you back?" },
    hint: { zh: "写下来，我们之后帮你换成你已经选的那一版。", en: "Write it down. We will turn it into the version you have already chosen." },
    placeholder: { zh: "例如：我不够好 / 来不及了", en: "For example: I'm not enough / it's too late" } }),
  evidence: step({ id: "evidence", type: "long", optional: true, reply: false,
    prompt: { zh: "你已经看到过哪些“它正在靠近”的小迹象？", en: "What small signs have you already seen that it is coming closer?" },
    placeholder: { zh: "例如：他昨天点赞了我的动态", en: "For example: he liked my post yesterday" } }),
  exclude: step({ id: "exclude", type: "long", optional: true, reply: false,
    prompt: { zh: "这个愿望里，有没有你不想被提的人或事？", en: "Anything or anyone you don't want mentioned around this desire?" },
    placeholder: { zh: "例如：我的前任", en: "For example: my ex" } }),

  more: step({ id: "more", type: "more", optional: false, reply: false,
    prompt: { zh: "还有别的愿望想一起放进来吗？", en: "Any other desire you want to bring in?" },
    hint: { zh: "你可以同时显化很多件事。每个愿望都会有自己的一张卡。", en: "You can manifest many things at once. Each desire gets its own card." } }),

  // no AI line here: it kept inventing details about people she only named
  people: step({ id: "people", type: "people", optional: true, reply: false,
    prompt: { zh: "有哪些人对你很重要？", en: "Who matters most to you?" },
    hint: { zh: "名字加一句 TA 是谁。我之后会记得。", en: "A name and a line about who they are. I will remember." } }),
  never: step({ id: "never", type: "long", optional: true, reply: false,
    prompt: { zh: "有哪些话题，你不希望我提？", en: "Which topics do you not want me to bring up?" },
    hint: { zh: "每行写一个。", en: "One per line." },
    placeholder: { zh: "例如：我的体重\n我的前任", en: "For example: my weight\nmy ex" } }),
  situation: step({ id: "situation", type: "long", optional: true, reply: false,
    prompt: { zh: "你现在过着怎样的日子？", en: "What does your life look like right now?" },
    hint: { zh: "学习或工作，一句话就好。", en: "Study or work, one line is enough." },
    placeholder: { zh: "例如：在读研，同时在做一个小项目", en: "For example: in grad school, building a small project" } }),
  style: step({ id: "style", type: "style", optional: false, reply: false,
    prompt: { zh: "你希望怎样被陪伴？", en: "How do you want to be accompanied?" },
    hint: { zh: "先选最接近的。之后可以随时换。", en: "Pick the closest. You can change it anytime." } }),
};

const WISH_SPECIFICS: Record<WishKind, string[]> = {
  relationship: ["sp_name", "rel_state", "rel_close"],
  wealth: ["wealth_form", "wealth_when"],
  self: ["self_who", "self_body"],
  lifestyle: ["life_where", "life_morning"],
  other: ["other_moment"],
};

export const HEAD_STEPS = ["name", "country", "about", "note"];
export const TAIL_STEPS = ["people", "never", "situation", "style"];

/** Steps for one desire. The first desire gets the full set; extra desires get a shorter one. */
export function wishModule(kind: WishKind | "", full: boolean): string[] {
  const specifics = kind ? WISH_SPECIFICS[kind] : [];
  if (!full) return ["wish", "category", ...specifics.slice(0, 1), "scene", "intensity"];
  return ["wish", "category", ...specifics, "scene", "intensity", "pullback", "evidence", "exclude"];
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
  style: string;
  /** her own words, when she chose the custom way of being accompanied */
  customTone: string;
  wishes: WishAnswers[];
};

export const emptyWish = (): WishAnswers => ({ wish: "", kind: "", specifics: {}, scene: "", intensity: 3, pullback: "", evidence: "", exclude: "" });
export const emptyAnswers = (): OnboardingAnswers => ({ name: "", country: "", about: "", situation: "", never: "", people: [], style: "", customTone: "", wishes: [emptyWish()] });

/** Lines of text for a topic list: one per line, trimmed, empty lines dropped, duplicates removed. */
export function splitLines(value: string, max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/\r?\n|[；;]/)) {
    const line = raw.trim();
    const key = line.toLowerCase();
    if (!line || seen.has(key)) continue;
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
    sp_name: ["TA 的称呼", "What she calls them"],
    rel_state: ["TA 是谁，现在的状态", "Who they are and where things stand"],
    rel_close: ["她想要的亲密", "The closeness she wants"],
    wealth_form: ["具体的形态", "What it looks like"],
    wealth_when: ["它出现的那一天", "The day it arrives"],
    self_who: ["想成为的人", "Who she wants to be"],
    self_body: ["那时的身体与别人的目光", "How her body feels and how others see her"],
    life_where: ["城市与住处", "City and home"],
    life_morning: ["那里的普通早晨", "An ordinary morning there"],
    other_moment: ["它已经发生的那一刻", "The moment it has happened"],
  };
  const lines: string[] = [];
  for (const [id, [zhLabel, enLabel]] of Object.entries(labels)) {
    const text = (wish.specifics[id] || "").trim();
    if (text) lines.push(`${zh ? zhLabel : enLabel}：${text}`);
  }
  if (wish.scene.trim()) lines.push(`${zh ? "它已经实现的普通一天" : "An ordinary day when it is true"}：${wish.scene.trim()}`);
  if (wish.evidence.trim()) lines.push(`${zh ? "她看到的小迹象" : "Small signs she has seen"}：${wish.evidence.trim()}`);
  return lines.join("\n");
}

/** The name of the person a relationship desire is about, if she gave one. */
export function wishPersonName(wish: WishAnswers): string {
  return (wish.specifics.sp_name || "").trim();
}

/** Can she press Continue on this step? */
export function canAdvance(stepId: string, answers: OnboardingAnswers, wishIndex: number | null): boolean {
  const def = STEPS[stepId];
  if (!def) return false;
  const wish = wishIndex === null ? null : answers.wishes[wishIndex];
  switch (stepId) {
    case "name": return answers.name.trim().length > 0;
    case "wish": return Boolean(wish && wish.wish.trim());
    case "category": return Boolean(wish && wish.kind);
    case "style": return Boolean(answers.style);
    default: return true;
  }
}

export type GoalSeed = { wishCategory: WishKind; desire: string; background: string; beliefs: string[]; spName: string; intensity: number };
export type ProfileSeed = { country: string; about: string; situation: string; people: OnboardingPerson[]; neverInclude: string[] };

/** Turns what she answered into the pieces the app stores: one seed per desire, and one profile for her. */
export function answersToSeeds(answers: OnboardingAnswers, lang: OnboardingLang): { goals: GoalSeed[]; profile: ProfileSeed } {
  const goals: GoalSeed[] = answers.wishes
    .filter((wish) => wish.wish.trim())
    .map((wish) => ({
      wishCategory: wish.kind || "other",
      desire: wish.wish.trim(),
      background: wishBackground(wish, lang),
      beliefs: wish.pullback.trim() ? [wish.pullback.trim()] : [],
      spName: wish.kind === "relationship" ? wishPersonName(wish) : "",
      intensity: Math.min(5, Math.max(1, Math.round(wish.intensity || 3))),
    }));
  const never = [...splitLines(answers.never), ...answers.wishes.flatMap((wish) => splitLines(wish.exclude))];
  const profile: ProfileSeed = {
    country: answers.country.trim().slice(0, 60),
    about: answers.about.trim().slice(0, 400),
    situation: answers.situation.trim().slice(0, 400),
    people: answers.people.filter((person) => person.name.trim()).slice(0, 12),
    neverInclude: splitLines(never.join("\n")),
  };
  return { goals, profile };
}
