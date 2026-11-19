import type { CompanionRequest } from "./already-ai";

/**
 * Story scripts get their own short prompt: the shared script rules plus only the block for the story's
 * category. Chat rules, chat history and memories are left out, which keeps the request around a quarter of
 * the chat prompt's size (input tokens are most of a story's cost) and removes chat rules that contradict it.
 */

export const STORY_CATEGORIES = ["love", "wealth", "career", "study", "body", "life", "family", "other"] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];

export const STORY_CATEGORY_LABELS: Record<StoryCategory, { zh: string; en: string }> = {
  love: { zh: "爱情", en: "Love" },
  wealth: { zh: "财富", en: "Wealth" },
  career: { zh: "事业", en: "Career" },
  study: { zh: "学业", en: "Study" },
  body: { zh: "健康与身体", en: "Health and body" },
  life: { zh: "生活与旅行", en: "Life and travel" },
  family: { zh: "家人", en: "Family" },
  other: { zh: "其他", en: "Other" },
};

/** The story category that matches a desire card's category, used as the editor's default. */
export function storyCategoryFor(wishCategory?: string): StoryCategory {
  return ({ relationship: "love", wealth: "wealth", self: "body", lifestyle: "life" } as Record<string, StoryCategory>)[wishCategory || ""] || "other";
}

const core = {
  zh: `你写完成态剧本。她给你几个关键词，你把它扩写成一段她读的时候像身在其中的剧本。

写法：
- 第一人称“我”，现在时，写愿望已经实现之后的某一天或某一刻。不写过程、等待和匮乏，不写“终于”“曾经”。
- 地点：关键词里写了地点，剧本就发生在那里，并把它写到具体的街区、楼、店、酒店或学校。关键词没写地点时，用 desire_details 里她写过的地方，再没有就用 her_home（她住的城市）。愿望涉及物质环境时（住处、店、学校、公司、物品），用现实中存在、叫得出名字的地方和品牌；拿不准名字的，只写它是什么样的地方，不编造名字。不写真实名人。
- desire_details 和 about_her 是她自己写的愿望细节和生活状况，里面能用进这个场景的人、地方、习惯和细节都用上。
- story_setting 是她为这个愿望交代的剧本设定（人物是什么样、他们的生活、不想出现的东西），每一条都照做；和其他资料冲突时以它为准，里面说不要的一律不写。
- 感知要全：看见的颜色、光线和天气，听见的人声和背景里的环境音，闻到的气味，尝到的味道，皮肤上的温度、质地和重量，身体里面的感觉（心跳、呼吸、肩膀松下来、胃里暖起来）。
- 让场景是活的：写清时间（几点、季节），写周围的人和万物在做什么，写具体的数字和小物件（金额、分数、门牌、时间、手里拿着的东西），可以有一点不完美的小插曲（打翻、迟到、笑场），真实生活就是这样。
- 情绪靠动作、对白和身体写出来，不直接说“我很幸福”。对白是自然口语，短。
- 结构：按时间往前推进的几个片段，每段一个画面，共 700 到 1100 字，分 6 到 10 段，段与段之间空一行。
- 她给的关键词都要用上。锚定句的意思在剧本里自然出现一次，可以化成心里的一句话，不要原样贴在结尾。
- 结尾停在一个动作、画面或一句对白上。不写感悟，不总结，不点题，不出现“这就是”“我的日常”“熟悉的日子”这类收尾，不出现显化、假设、3D、宇宙这类词。

语言：不用“不是X，而是Y”的转折句式；不用破折号；不连用三个形容词；不用“仿佛时间静止”“空气凝固”“心里泛起涟漪”这类套话。

边界：never_mention 里的人和事一律不写。people 里的人只写这个场景里的言行，不编造他们的身世和性格。不写违法、伤害他人、未成年人的亲密内容。

只输出剧本正文，不加标题、前言或说明。`,
  en: `You write fulfilled-state scripts. She gives you a few keywords; you expand them into a script she can step inside as she reads.

How to write:
- First person, present tense, a day or moment after the desire is already real. No process, waiting, or lack; no "finally" or "used to".
- Place: if the keywords name a place, the script happens there, written down to the street, building, shop, hotel or school. If they do not, use a place she wrote in desire_details, and failing that her_home (the city she lives in). When the desire involves a physical world (a home, a shop, a school, a company, things), use places and brands that exist and can be named; if you are unsure of a name, describe what kind of place it is and invent no name. No real celebrities.
- desire_details and about_her are her own words about this desire and her life; use every person, place, habit and detail from them that fits this scene.
- story_setting is what she has asked every script for this desire to keep to (who the people are, their life, what to leave out). Follow every point; it wins over anything else, and anything it says to leave out never appears.
- All the senses: colours, light and weather; voices and the ambient sound behind them; smells; tastes; temperature, texture and weight on the skin; what happens inside the body (heartbeat, breath, shoulders dropping, warmth in the stomach).
- Make the scene alive: give the time (hour, season), what the people and things around her are doing, specific numbers and small objects (amounts, scores, door numbers, times, what is in her hand), and a small imperfection if it fits (a spill, running late, a laugh at the wrong moment).
- Feelings come through action, dialogue and the body; never state "I am so happy". Dialogue is short and spoken.
- Structure: a few moments moving forward in time, one picture each, 450 to 750 words in 6 to 10 paragraphs separated by blank lines.
- Use every keyword. Let the anchor line appear once naturally, for example as a thought; never paste it as a closing line.
- End on an action, an image, or a line of dialogue. No reflection, summary, or moral; never "this is my life now" or similar; never the words manifest, assume, 3D, or universe.

Language: no "not X, but Y" turns; no em dashes; no runs of three adjectives; no stock lines like "time stood still" or "a breath I didn't know I was holding".

Limits: leave out everyone and everything in never_mention. People from people_in_her_life only act and speak in this scene; invent no history or personality for them. Nothing illegal, nothing that harms others, nothing intimate involving minors.

Output only the script: no title, preface, or notes.`,
};

const modules: Record<StoryCategory, { zh: string; en: string }> = {
  love: {
    zh: "类目：爱情。对方（用 her_person 里的名字，至少出现两次）全程在场。写两个人之间的动作、对白、眼神、身体的靠近：牵手、靠着、他的体温和声音、他叫她的名字。写日常里的亲密，比如一起做一件普通的小事，他自然地记得她的习惯。他的话只写这个场景里说的，不替他发誓或解释心意。",
    en: "Category: love. The other person (the name in her_person, at least twice) is there throughout. Write what passes between them: gestures, dialogue, eye contact, closeness, his warmth and voice, him saying her name. Show everyday intimacy, like doing a small ordinary thing together while he remembers her habits without being asked. He only says what fits this scene; no vows or speeches about his feelings.",
  },
  wealth: {
    zh: "类目：财富。钱要落到具体的数字和币种（按她生活的地方），比如银行 App 里的余额、到账通知、一张账单的金额。写她用的、穿的、住的、开的东西的真实品牌和型号，档次贴合她的愿望，不堆砌奢侈品牌。重点写有钱以后的从容：付款时不看价格，顺手帮别人买单，时间被自己安排。",
    en: "Category: wealth. Put money into specific amounts and her local currency: a balance in her banking app, a deposit notification, the total on a bill. Name the real brands and models of what she wears, uses, lives in and drives, at the level her desire describes, without piling up luxury labels. Show the ease of having it: paying without checking the price, picking up someone else's bill, owning her time.",
  },
  career: {
    zh: "类目：事业。写清她做的是什么工作、在什么样的公司或城市，职位、团队、项目要具体。可以有邮件签名里的新头衔、工资条或合同上的数字、会议上被认真听的一句话、同事的反应、办公室里真实的声音和气味（咖啡机、键盘、空调）。写她做得轻松熟练的样子。",
    en: "Category: career. Make her work concrete: the role, the kind of company, the city, the team and the project. Use details like the new title in her email signature, the number on a payslip or contract, a sentence of hers the room listens to, colleagues' reactions, and the real sounds and smells of the workplace (the coffee machine, keyboards, air conditioning). Show her doing it with ease.",
  },
  study: {
    zh: "类目：学业。关键词里有学校、专业、考试就用真实的名称；没有就按她的情况选一个真实存在的。写分数、录取通知、学号、课表这些具体的东西，写校园里真实的楼、图书馆、食堂、宿舍和那里的声音气味，写她学得顺、答得出的感觉。",
    en: "Category: study. Use the real names of the school, programme or exam if the keywords give them; otherwise choose a real one that fits her. Write concrete things like scores, the offer letter, a student number, a timetable, the real buildings, library, canteen and dorm with their sounds and smells, and the feeling of the work coming easily to her.",
  },
  body: {
    zh: "类目：健康与身体。写具体的数字（体重、尺码、体检指标）和身体的真实感受：走路的轻快、衣服的松紧、镜子里的线条、呼吸和精力。可以写真实的运动场所、衣服品牌、吃的东西。写身体本来就这样的自然，不写节食和挣扎。",
    en: "Category: health and body. Use specific numbers (weight, size, test results) and how the body really feels: light steps, how clothes fit, the lines in the mirror, breath and energy. Real gyms, clothing brands and food can appear. Show the body as simply being this way, with no dieting or struggle.",
  },
  life: {
    zh: "类目：生活与旅行。地点具体到真实的城市、街区、酒店、店铺、景点，写那里真实会有的东西、当地的语言和声音、当季的天气和食物。住处要写清格局、窗外看到什么、屋里用的东西。写她在那里生活得自在熟练。",
    en: "Category: life and travel. Set it in a real city, neighbourhood, hotel, shop or sight, with what is really there: the local language and sounds, the season's weather and food. For a home, describe the layout, the view from the window, and the things she uses. Show her at ease there.",
  },
  family: {
    zh: "类目：家人。用 people_in_her_life 里家人的称呼和名字，写一家人在一起时真实的样子：饭桌、口头禅、家里的气味、一起做的小事。每个人只写这个场景里的言行。",
    en: "Category: family. Use the family members' names from people_in_her_life and show the family as it really is together: the dinner table, sayings they repeat, the smell of home, small things done together. Each person only acts and speaks in this scene.",
  },
  other: {
    zh: "类目：其他。先从关键词判断这个愿望实现后最具体的一个场景，再按上面的写法把人、地方和感知写实。",
    en: "Category: other. First work out from the keywords the most concrete scene of this desire fulfilled, then make its people, place and senses real as described above.",
  },
};

/** Short system prompt plus a compact request for one story script. */
export function buildStoryMessages(payload: CompanionRequest, category: StoryCategory) {
  const lang = payload.lang;
  const profile = payload.goal.profile;
  const request = {
    keywords: payload.userInput.slice(0, 4000),
    desire: payload.goal.desire.slice(0, 600),
    ...(category === "love" || payload.goal.wishCategory === "relationship" ? { her_person: payload.goal.spName || (lang === "zh" ? "他" : "him") } : {}),
    // only strings reach the prompt; the request body is not trusted to have the right shapes
    her_home: (typeof profile?.home === "string" && profile.home.slice(0, 80)) || payload.country || "",
    ...(typeof payload.goal.background === "string" && payload.goal.background.trim() ? { desire_details: payload.goal.background.slice(0, 1200) } : {}),
    ...(typeof payload.goal.storySetting === "string" && payload.goal.storySetting.trim() ? { story_setting: payload.goal.storySetting.slice(0, 1500) } : {}),
    ...(profile?.about || profile?.situation ? { about_her: [profile?.about, profile?.situation].filter(Boolean).join("\n").slice(0, 800) } : {}),
    ...(profile?.people?.length ? { people_in_her_life: profile.people.slice(0, 8).map((person) => `${person.name}${person.relation ? `（${person.relation}）` : ""}`) } : {}),
    ...(profile?.neverInclude?.length ? { never_mention: profile.neverInclude.slice(0, 20) } : {}),
  };
  return [
    { role: "system" as const, content: `${core[lang]}\n\n${modules[category][lang]}` },
    { role: "user" as const, content: JSON.stringify(request) },
  ];
}

/** Checks a script can fail without a person reading it. Returns notes for a rewrite, empty when it passes. */
export function storyProblems(script: string, lang: "zh" | "en", category: StoryCategory, person?: string) {
  const zh = lang === "zh";
  const paragraphs = script.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const length = zh ? script.replace(/\s/g, "").length : script.split(/\s+/).filter(Boolean).length;
  const last = paragraphs.at(-1) || "";
  const notes: string[] = [];
  if (length < (zh ? 600 : 400)) notes.push(zh ? "太短了，扩写到 700 到 1100 字。" : "Too short; expand to 450-750 words.");
  if (length > (zh ? 1500 : 1000)) notes.push(zh ? "太长了，收到 1100 字以内。" : "Too long; keep it under 750 words.");
  if (paragraphs.length < 5) notes.push(zh ? "分成 6 到 10 段，段与段之间空一行。" : "Split it into 6-10 paragraphs separated by blank lines.");
  if (zh ? /这就是|我的日常|熟悉的日[子常]|每天都有他/.test(last) : /this is (my|what)|every ?day life/i.test(last)) notes.push(zh ? "最后一段在点题总结，改成停在一个动作、画面或对白上。" : "The last paragraph sums up; end on an action, image, or line of dialogue instead.");
  if (zh ? /显化|假设法则|3D|宇宙/.test(script) : /manifest|assum|\b3D\b|universe/i.test(script)) notes.push(zh ? "去掉显化、假设、3D、宇宙这类词。" : "Remove words like manifest, assume, 3D, universe.");
  if (/——|—/.test(script)) notes.push(zh ? "去掉破折号，用逗号或句号。" : "Remove em dashes; use commas or full stops.");
  if (category === "love" && person && person.length > 0 && script.split(person).length - 1 < 2) notes.push(zh ? `对方的名字「${person}」至少出现两次。` : `Use the name "${person}" at least twice.`);
  return notes;
}
