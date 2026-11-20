import type { CoachMode, CompanionLang } from "./already-ai";

// Knowledge cards for the three guidance methods, distilled from research_notes/显化三流派导师理论
// (release_classic / release_influencers: Sedona, Levenson, Dwoskin, Hawkins, Byron Katie, Singer, 煜子;
// assumption_classic / assumption_influencers: Neville's Feeling Is the Secret, Out of This World, the 1954
// revision lecture, N姐; subconscious_classic / subconscious_influencers: Coué, Hay, Helmstetter, Erickson,
// Wood 2009, Sammy Ingram, 科技兔). Each card is one concrete idea and how to use it in a single chat turn.
// Left out on purpose: commanding or "removing" other people, blaming her for what others do, "ignore 3D" for
// health or safety, and claims sold as science (theta programming, quantum, 100%).
// A few cards are sent per turn: the ones her words point to first, then a rotation, so replies stop
// circling the same one or two concepts.

type CardText = { idea: string; how: string };
export type CoachCard = { id: string; coach: CoachMode; triggers: string[]; zh: CardText; en: CardText };

/** Words that show a card's idea already came up in a recent reply (Chinese replies), so it is not offered again. */
const usedMarkers: Record<string, RegExp> = {
  r_wanting_not_wish: /不是愿望本身|愿望(原样|还在|留着)/,
  r_three_wants: /认可|掌控|安全感/,
  r_welcome: /欢迎/,
  r_could_would_when: /能不能放下|愿不愿意|什么时候放/,
  r_unwilling_ok: /放不下也|不愿意也/,
  r_no_lesson: /功课|不用(先)?(搞懂|弄明白|找原因)/,
  r_guest: /客人/,
  r_attention_back: /关注力|收回来/,
  r_not_now: /催|必须现在/,
  r_scarcity_first: /压力/,
  r_back_to_wish: /还在抓/,
  r_numb_start: /感觉不到任何感觉|从「?感受不到/,
  r_doubt_not_failure: /不代表.{0,6}失败/,
  r_let_go_of_letting_go: /想要放手|继续抓着/,
  r_lean_in: /握拳|握紧/,
  r_small_release: /小的释放|轻一点点/,
  r_wanting_controlled: /想要被控制/,
  r_layers: /一层一层|新的一层/,
  a_exam_done: /考过了|考完/,
  a_breathing: /呼吸/,
  a_think_from_end: /站在终点|油价/,
  a_i_am: /我会|将来/,
  a_live_in_end: /结局|那一头/,
  a_how_not_yours: /怎么实现|过程/,
  a_bridge: /巧合|那座桥/,
  a_signs_follow: /迹象|倒影/,
  a_revision: /重演|改写|改成|重新过/,
  a_sleep: /睡前|入睡|睡着/,
  a_one_scene: /一个动作|小场景/,
  a_inner_talk: /心里(说|吵)|对话/,
  a_persist: /动摇|选回/,
  a_no_effort: /用力/,
  a_self_concept: /身份|你是(那个|一个)/,
  a_creating_absence: /不在的那一版|空白/,
  a_if_already: /如果已经/,
  a_doubt_story: /怀疑/,
  a_past_not_evidence: /过去/,
  s_familiar: /念熟|熟悉/,
  s_too_far: /太远/,
  s_ladder: /我正在|我愿意|我决定|也许/,
  s_question: /为什么我/,
  s_evidence: /小事/,
  s_drowsy: /刚醒|睡前/,
  s_daily_moments: /刷牙|通勤|烧水|洗碗/,
  s_few_lines: /一两句|只留/,
  s_feeling_word: /感受词/,
  s_counter_thought: /旧的/,
  s_feed: /刷到|帖子/,
  s_play_role: /演/,
  s_anchor: /短句|锚/,
};
// A let-go invitation in either of the last two replies means this turn must not ask again.
const letGoInvite = /愿不愿意|能不能(放下|松开|允许)|松开一点|willing to (let|loosen)|could you let/i;

export const coachCards: CoachCard[] = [
  // ---- release ----
  { id: "r_wanting_not_wish", coach: "release", triggers: ["放下", "放手", "不想要", "放弃", "先爱自己", "let go", "give up"],
    zh: { idea: "松开的是「想要」那种还没有的感觉，不是愿望本身。愿望原样留着，只是抓着它的那只手可以松一点。", how: "她担心放下就等于放弃时用。说清楚两者的区别，然后让她照旧要这个结果。" },
    en: { idea: "What loosens is the wanting, the sense of not having it yet, not the desire itself. The desire stays; only the gripping hand relaxes.", how: "Use when she fears letting go means giving up. Make the difference clear and let her keep wanting the outcome." } },
  { id: "r_three_wants", coach: "release", triggers: ["认可", "控制", "安全感", "证明", "看手机", "刷", "查", "骂", "吵架", "妈", "爸", "老公", "说我", "approval", "control", "secure"],
    zh: { idea: "很多紧绷底下是三种想要之一：想被认可、想掌控、想有安全感。认出是哪一种，比分析原因更快松下来。", how: "从她说的具体动作里点出是哪一种（反复看手机多半是想掌控，被妈妈骂完多半是想被认可），一句话点到就好，不展开分析。" },
    en: { idea: "Under most tension sits one of three wants: approval, control, or security. Naming which one loosens it faster than analysing why.", how: "Point to which one from the specific thing she did (rechecking the phone is usually control; after a scolding it is usually approval). One sentence, no analysis." } },
  { id: "r_welcome", coach: "release", triggers: ["难受", "烦", "气", "崩溃", "受不了", "讨厌", "hate", "angry", "upset"],
    zh: { idea: "欢迎它：欢迎这份感受，也欢迎那个想赶紧把它修好的念头。欢迎不是逼自己去挖，只是不推开。", how: "她在和自己的情绪较劲时用。请她让这份感觉在这里待一会儿，不用变好，也不用说清楚。" },
    en: { idea: "Welcome it: the feeling, and also the urge to fix it fast. Welcoming is not digging; it is simply not pushing away.", how: "Use when she is fighting her own feeling. Invite her to let it stay a moment, without needing it to improve or be explained." } },
  { id: "r_could_would_when", coach: "release", triggers: ["怎么释放", "怎么放下", "释放怎么做", "how do i let go", "how to release"],
    zh: { idea: "三个问题：能不能放下它？愿不愿意？什么时候？每个问题都可以回答「不」，回答「不」也算数。", how: "只在她想要一个具体练习时用，一段对话里用一次。三个问题之间留白，不催她。" },
    en: { idea: "Three questions: could you let it go, would you, when? Each can be answered no, and no counts too.", how: "Only when she asks for a practice, once per conversation. Leave room between the questions; do not rush her." } },
  { id: "r_unwilling_ok", coach: "release", triggers: ["放不下", "做不到", "松不开", "不愿意", "can't let go"],
    zh: { idea: "「不愿意」也是一个可以被允许的答案。放不下的时候，就欢迎这份放不下，不用跟它拔河。", how: "她说放不下、做不到时用。直接告诉她放不下也可以，不把它当成练习失败。" },
    en: { idea: "Unwilling is an allowed answer. When she can't let go, welcome the not-letting-go instead of tugging at it.", how: "Use when she says she can't. Tell her plainly that this is allowed and not a failed practice." } },
  { id: "r_no_lesson", coach: "release", triggers: ["为什么", "功课", "课题", "卡点在哪", "哪里做错", "why"],
    zh: { idea: "不需要先搞懂为什么，也不需要找出这件事要你学的功课。想搞明白的那股劲，本身也可以松一点。", how: "她反复追问原因、怀疑自己哪里有卡点时用。把注意力从找原因移回此刻的感觉上。" },
    en: { idea: "No need to work out why, or to find the lesson in it. The urge to figure it out can loosen too.", how: "Use when she keeps asking why or hunting for her block. Move attention from causes back to what she feels now." } },
  { id: "r_guest", coach: "release", triggers: ["一直想", "满脑子", "停不下来", "反复想", "can't stop thinking"],
    zh: { idea: "情绪像来访的客人，让它在客厅坐一会儿，它自己会走。不贴标签、不分析、不赶，它跑完就散了。", how: "她被一股情绪卷着走时用。给她一个可以放手的画面，不加任务。" },
    en: { idea: "A feeling is like a visitor: let it sit a while and it leaves on its own. No labels, no analysis, no chasing it out; it runs its course.", how: "Use when a feeling is carrying her away. Give her an image she can rest in, with no task attached." } },
  { id: "r_attention_back", coach: "release", triggers: ["他的动态", "朋友圈", "主页", "点赞", "在线", "刷他", "his story", "his page"],
    zh: { idea: "把关注力从他的动态上收回来，放回自己此刻的感觉。不纠缠、不解释，也不用去证明什么。", how: "她反复看对方动态时用。给一个今晚能做的具体动作，比如今晚不点开他的主页，手放在胸口感觉一下自己。" },
    en: { idea: "Take attention back from his updates and return it to how she feels right now. No chasing, no explaining, nothing to prove.", how: "Use when she keeps checking his page. Give one concrete thing for tonight, such as not opening his profile." } },
  { id: "r_not_now", coach: "release", triggers: ["多久", "什么时候", "还要等", "等不及", "太慢", "how long", "when will"],
    zh: { idea: "让人最累的常常是「必须现在就来」那股催促，不是愿望本身。催促可以松开，愿望和方向都不变。", how: "她问还要多久、等得焦躁时用。认出这股催促，请她把它放轻一点。" },
    en: { idea: "What tires her most is often the must-be-now urgency, not the desire. The urgency can ease while the desire and direction stay.", how: "Use when she asks how long or is restless waiting. Name the urgency and invite her to hold it more lightly." } },
  { id: "r_scarcity_first", coach: "release", triggers: ["没钱", "存款", "账单", "余额", "欠", "房租", "broke", "bills", "rent"],
    zh: { idea: "钱紧的时候，先承认眼前的压力是真的有分量，再谈松开抓取。没有这一步，「放下就有了」听起来就像站着说话不腰疼。", how: "她在说钱和现实压力时用。先一句话落到她的具体处境上，再请她松开对结果的那份紧。" },
    en: { idea: "When money is tight, first acknowledge the weight of the real pressure, then speak about loosening the grip. Skipping this makes letting go sound glib.", how: "Use when she talks about money and real pressure. Land on her specific situation in one sentence first." } },
  { id: "r_back_to_wish", coach: "release", triggers: ["松了", "好一点", "轻松", "平静", "lighter", "calmer"],
    zh: { idea: "松下来以后，再想一下那个愿望，看看哪里还在抓。没有抓的地方，就让愿望轻轻待着。", how: "她说感觉松一点了时用，把释放接回她的愿望上。" },
    en: { idea: "Once she has softened, hold the desire in mind again and notice where any grip remains. Where there is none, let the desire simply rest.", how: "Use when she says she feels lighter, to connect the release back to her desire." } },

  // added 2026-11-20 from the Sedona community forum translations (Killaaqueen) and Xiaohongshu replies
  { id: "r_numb_start", coach: "release", triggers: ["感受不到", "没感觉", "麻木", "心里很空", "空空的", "feel nothing", "numb"],
    zh: { idea: "感受不到感受的时候，就从「感受不到」开始：注意一下，感觉不到任何感觉是什么感觉，在这里待一会儿，它慢慢会变成一点感觉，或者一个念头。", how: "她说没感觉、心里很空、释放不出来时用。不要求她先找到情绪。" },
    en: { idea: "When she can't feel anything, start from that: notice what it is like to feel nothing and stay there a while; it slowly turns into a sensation or a thought.", how: "Use when she says she feels nothing or can't find the feeling. Don't ask her to find an emotion first." } },
  { id: "r_doubt_not_failure", coach: "release", triggers: ["怀疑", "不起作用", "没用", "白费", "是不是假的", "not working"],
    zh: { idea: "怀疑冒出来，不代表前面的释放失败了，只说明人一直在变；注意到这个怀疑，轻轻放掉就好。", how: "她释放过、松过，现在又怀疑没用时用。" },
    en: { idea: "Doubt showing up doesn't mean the earlier release failed; it only means she is alive and changing. Notice the doubt and let it go lightly.", how: "Use when she had released or felt lighter and now doubts it worked." } },
  { id: "r_let_go_of_letting_go", coach: "release", triggers: ["释放不了", "卡住", "卡死", "怎么都放不掉", "stuck"],
    zh: { idea: "卡住的时候，先放下「想要放手」本身；也可以干脆允许自己继续抓着。回答「不」也算数，答完停一下，看看有什么变化。", how: "她说怎么都释放不了、越想放越紧时用。" },
    en: { idea: "When stuck, let go of wanting to let go; or simply allow herself to keep holding on. No counts as an answer; pause after it and notice what shifts.", how: "Use when she can't release at all or it tightens the more she tries." } },
  { id: "r_lean_in", coach: "release", triggers: ["紧", "堵", "压着", "透不过气", "喘不上", "tight", "can't breathe"],
    zh: { idea: "顺着紧绷：像握拳一样，用力握紧，握得再久一点，手最后会自己松开。", how: "她越想放松越紧绷的时候用。给一个可以马上做的动作。" },
    en: { idea: "Go with the tightness: like a fist, clench harder and longer, and the hand eventually opens on its own.", how: "Use when trying to relax makes her tighter. Give her something she can do right now." } },
  { id: "r_small_release", coach: "release", triggers: ["一点点", "没变化", "还是一样", "太慢", "没进展", "still the same"],
    zh: { idea: "小的释放也算数。每一次轻一点点，就是在松开，不用和以前最好的那次比。", how: "她觉得进展太小、没变化时用。" },
    en: { idea: "Small releases count. Each slightly lighter moment is letting go; no need to measure it against her best one.", how: "Use when progress feels too small." } },
  { id: "r_wanting_controlled", coach: "release", triggers: ["完了", "肯定不行", "没希望", "最坏", "认命", "压垮", "it's over", "hopeless"],
    zh: { idea: "宁可相信最糟的结果、觉得自己被外面压垮了，这也是一种想要：想要被控制。认出它，它就能放。", how: "她说完了、肯定不行、只能认命时用。一句话点出来，不分析。" },
    en: { idea: "Believing the worst and feeling crushed by what's outside is also a want: wanting to be controlled. Seeing it lets it go.", how: "Use when she says it's over or hopeless. Point it out in one line, no analysis." } },
  { id: "r_layers", coach: "release", triggers: ["越释放越", "又冒出来", "又回来", "更生气", "更难受", "worse when i release"],
    zh: { idea: "释放的时候情绪反而冒出来、更强了，说明释放已经开始了。情绪是一层一层出来的，冒出来的是新的一层。", how: "她说越释放越难受、情绪又回来了时用。" },
    en: { idea: "If feelings rise and get stronger while releasing, the release has started. Feelings come up in layers; what rises is the next one.", how: "Use when she says releasing makes it worse or it keeps coming back." } },

  // ---- assumption ----
  { id: "a_i_am", coach: "assumption", triggers: ["会不会", "以后", "将来", "希望", "will i", "someday"],
    zh: { idea: "「我是」比「我会」更有力。说「我会有」等于先承认了「我现在没有」。", how: "她用将来时、可能性的口气说愿望时用。帮她把一句话换成现在时，就一句。" },
    en: { idea: "I am is stronger than I will be. Saying I will have it quietly admits I don't now.", how: "Use when she speaks of the desire in future or maybe terms. Help her turn one line into present tense." } },
  { id: "a_live_in_end", coach: "assumption", triggers: ["等", "还没", "什么时候", "熬", "waiting", "not yet"],
    zh: { idea: "住在结局里：不等事情一件件发生，先从已经实现的那一头过今天。结局在哪里，就从哪里开始。", how: "她在熬、在等时用。问她：已经是这样的你，今天会怎么过？然后写一个很小的日常片段。" },
    en: { idea: "Dwell in the end: don't wait for events one by one; live today from the side where it is done.", how: "Use when she is waiting it out. Ask how the version of her who has it would spend today, then write one small everyday moment." } },
  { id: "a_how_not_yours", coach: "assumption", triggers: ["怎么实现", "怎么做到", "路径", "途径", "不可能", "how will", "impossible"],
    zh: { idea: "「怎么实现」不是她要操心的事。接受了结局，路自己会出现；想象时只想已经成了，不想过程。", how: "她在推算路径、觉得不现实时用。把她从「怎么会」拉回「已经是」，再给一个结果已经在的画面。" },
    en: { idea: "How it happens is not her job. Accepting the end brings the means; imagine it done, not the process.", how: "Use when she is plotting routes or calls it unrealistic. Move her from how could it to it is, then give a fulfilled picture." } },
  { id: "a_bridge", coach: "assumption", triggers: ["巧合", "运气", "刚好", "coincidence", "luck"],
    zh: { idea: "事情发生的时候，会像一串普通的巧合，看起来像是别人、时机或运气促成的。这就是从想象走到现实的那座桥。", how: "她担心没有现实条件，或者把好事归给运气时用。" },
    en: { idea: "When it arrives it looks like ordinary coincidences, as if people, timing, or luck caused it. That is the bridge from imagining to having.", how: "Use when she worries there is no realistic path, or credits good news to luck." } },
  { id: "a_signs_follow", coach: "assumption", triggers: ["没变化", "没动静", "反着来", "更糟", "证据", "nothing changed", "getting worse"],
    zh: { idea: "迹象是跟在后面的，不会先到。眼前还没变的样子是旧画面迟到的倒影，跟它争论反而会把它描得更清楚。", how: "她拿眼前的现实来反驳愿望时用。不和现实辩论，只是不把它当结论，然后回到已经成立的那一版。" },
    en: { idea: "Signs follow; they don't come first. What hasn't changed yet is a late reflection of the old picture, and arguing with it only draws it more sharply.", how: "Use when she holds up current reality against the desire. Don't debate it; just stop treating it as the verdict." } },
  { id: "a_revision", coach: "assumption", triggers: ["今天", "那一幕", "那句话", "白天", "画面", "忘不掉", "today", "that moment"],
    zh: { idea: "修正：睡前把今天让她难受的那一幕在心里重演，改成她想要的样子，反复过几遍，直到新版本有了真实感。", how: "她被白天某个具体场景卡住时用。帮她写出改好的那一幕，具体到对方说的那句话。" },
    en: { idea: "Revision: before sleep, replay the moment from today that hurt and change it into what she wanted, a few times, until the new version feels real.", how: "Use when a specific scene from today is stuck. Write the revised moment with her, down to the line the other person says." } },
  { id: "a_sleep", coach: "assumption", triggers: ["睡前", "睡觉", "晚上", "失眠", "sleep", "bed", "night"],
    zh: { idea: "入睡前的心境会被带进第二天。不要带着失望入睡；困倦的时候，用一个很短的场景或一句话带着「已经有了」睡着。", how: "她问睡前怎么做时用。给她一个十几秒的画面或三四个字的短句，不要长流程。" },
    en: { idea: "The mood she falls asleep in carries into tomorrow. Don't sleep on disappointment; in the drowsy state, carry a short scene or phrase of already having it.", how: "Use when she asks about bedtime. Give a ten-second image or a three-word phrase, not a long routine." } },
  { id: "a_one_scene", coach: "assumption", triggers: ["想象不出来", "画面", "怎么想象", "走神", "can't visualize"],
    zh: { idea: "选一个只有愿望实现后才会发生的小场景，用自己的眼睛在里面做一个动作，比如握手、开门、听他叫自己的名字。走神就拉回来。", how: "她不会想象、画面散时用。只给一个动作，不给一整部剧。" },
    en: { idea: "Pick one small scene that only happens once the wish is real and do one action in it from her own eyes: a handshake, opening a door, hearing her name. If attention drifts, bring it back.", how: "Use when imagining is hard or scattered. Give one action, not a whole film." } },
  { id: "a_inner_talk", coach: "assumption", triggers: ["心里吵", "脑子里", "跟他吵", "想象吵架", "内耗", "in my head"],
    zh: { idea: "她一直在心里和人说话，这些内在对话在塑造她的处境。把脑子里那场争吵换成她想听到的那段对话。", how: "她在脑子里反复和人吵、反复演最坏的对话时用。帮她写出对方会说的那句好话。" },
    en: { idea: "She is always talking to people in her head, and those conversations shape her situation. Swap the argument for the conversation she wants to hear.", how: "Use when she replays arguments or worst-case talks. Write the kind line the other person says instead." } },
  { id: "a_persist", coach: "assumption", triggers: ["坚持", "动摇", "不信了", "放弃", "没用", "doubt", "give up"],
    zh: { idea: "坚持不是一遍遍念，而是不回到旧的那一版。满足、平静比激动更像「已经印进去了」的信号。", how: "她动摇、说没用时用。告诉她动摇过后照样可以选回来，不需要从头算起。" },
    en: { idea: "Persisting is not repeating lines; it is not going back to the old version. Calm satisfaction, more than excitement, is the sign it has taken.", how: "Use when she wavers or says it isn't working. Tell her she can choose it again after wavering, without starting over." } },
  { id: "a_no_effort", coach: "assumption", triggers: ["好累", "用力", "很努力", "好难", "做不到", "exhausting", "trying so hard"],
    zh: { idea: "这件事不需要用力，越用力越像在证明自己还没有。是让自己顺着愿望走，不是逼愿望过来。", how: "她觉得显化很累、很努力时用。把练习说轻，给她松一口气的理由。" },
    en: { idea: "It needs no strain; straining feels like proving she doesn't have it yet. It is yielding to the wish, not forcing it.", how: "Use when she says it is exhausting. Make the practice lighter and give her a reason to exhale." } },
  { id: "a_self_concept", coach: "assumption", triggers: ["配不上", "我不够", "不配", "自卑", "not good enough", "don't deserve"],
    zh: { idea: "她怎么看自己，决定她住在哪个世界里。在结局里她是什么样的人，就从那个身份出发看今天的事。", how: "她觉得自己不配、不够好时用。帮她说出结局里那个她的一句自我描述。" },
    en: { idea: "How she sees herself decides the world she lives in. Whoever she is in the end, let today be seen from that identity.", how: "Use when she feels unworthy. Help her say one line of how the fulfilled her describes herself." } },
  { id: "a_creating_absence", coach: "assumption", triggers: ["没联系", "拉黑", "断联", "几个月", "消失", "blocked", "no contact"],
    zh: { idea: "这段时间的空白，可以看成是她一直在想「他不在」，所以一直在过「他不在」的那一版。这不怪任何人，反而说明选择权在她手里。", how: "长时间没联系、被拉黑时用。不责怪她，也不责怪对方，然后让她选回他在的那一版。" },
    en: { idea: "The months of silence can be read as her dwelling on his absence and so living the version where he is absent. No one is to blame; it shows the choice is hers.", how: "Use for long silence or being blocked. Blame no one, then let her choose the version where he is here." } },
  { id: "a_if_already", coach: "assumption", triggers: ["怎么办", "该怎么想", "怎么假设", "what do i do", "how do i assume"],
    zh: { idea: "问自己：如果已经是我的了，我此刻会怎么想？然后把这个故事编得很具体，留意心里那种不再缺什么的松。", how: "她问该怎么想、该怎么做时用。替她问这个问题，再帮她补两三个具体细节。" },
    en: { idea: "Ask: if it were already mine, what would I be thinking right now? Then make the story specific and notice the ease of not missing anything.", how: "Use when she asks what to think or do. Ask her this, then fill in two or three concrete details." } },
  { id: "a_doubt_story", coach: "assumption", triggers: ["怀疑", "不信", "骗自己", "假的", "doubt", "fake", "lying to myself"],
    zh: { idea: "怀疑也只是一个故事，不需要打赢它才能继续。把怀疑推开，反而是把它当成了事实。", how: "她说自己不信、像在骗自己时用。允许怀疑在旁边，照样选她要的那一版。" },
    en: { idea: "Doubt is just another story; she doesn't have to beat it to continue. Pushing it away treats it as fact.", how: "Use when she says she doesn't believe it. Let doubt sit beside her while she keeps choosing her version." } },
  { id: "a_past_not_evidence", coach: "assumption", triggers: ["以前", "上次", "又是这样", "每次都", "always", "last time"],
    zh: { idea: "过去不是证据。过去的事可以有感受，但不能拿来反驳她现在的选择。", how: "她用以前的经历证明这次也不会成时用。" },
    en: { idea: "The past is not evidence. It can be felt, but it doesn't get to overrule what she chooses now.", how: "Use when she uses past experience to prove it won't work this time." } },

  // added 2026-11-20 from Xiaohongshu replies
  { id: "a_exam_done", coach: "assumption", triggers: ["今天", "明天", "什么时候", "会不会来", "多久", "when"],
    zh: { idea: "今天明天都是眼前世界里的说法。就像已经考完的那场试，考前再紧张，它也已经考过了。", how: "她纠结它今天会不会来、什么时候来时用。" },
    en: { idea: "Today and tomorrow are words of the visible world. Like an exam already sat: however nervous she was before, it has already been taken.", how: "Use when she agonizes over whether it comes today or when." } },
  { id: "a_breathing", coach: "assumption", triggers: ["用力", "好累", "坚持", "努力", "撑", "trying hard"],
    zh: { idea: "知道自己已经有了，就不会用力，就像人不会用力去呼吸。", how: "她问怎么才能不用力、觉得坚持很累时用。" },
    en: { idea: "Knowing she already has it, there is nothing to strain for, the way no one strains to breathe.", how: "Use when she asks how to stop straining or finds persisting tiring." } },
  { id: "a_think_from_end", coach: "assumption", triggers: ["怎么想", "怎么假设", "终点", "该想什么", "what should i think"],
    zh: { idea: "不是去想终点，是站在终点去想：已经拥有的她，今天会关心什么？没车的人在想怎么攒钱，有车的人在关心油价。", how: "她问该怎么想、怎么假设时用。帮她说出拥有之后会在意的一件小事。" },
    en: { idea: "Not thinking of the end, but thinking from it: what does the version who has it care about today? Someone without a car saves for one; someone with a car watches fuel prices.", how: "Use when she asks what to think. Help her name one small thing she'd care about once she has it." } },

  // ---- subconscious ----
  { id: "s_familiar", coach: "subconscious", triggers: ["重复", "念多少", "多少遍", "坚持念", "how many times", "repeat"],
    zh: { idea: "一句话念熟了，就不再陌生，心里也就不急着反驳它。重复的用处是让它变熟，不是凑一个数字。", how: "她问要念多少遍、要不要狂念时用。把重点从次数挪到「念着顺不顺」。" },
    en: { idea: "A line said often enough stops feeling foreign, so the mind stops rushing to argue. Repetition makes it familiar; it is not about hitting a number.", how: "Use when she asks how many times. Shift focus from count to whether it feels easy to say." } },
  { id: "s_too_far", coach: "subconscious", triggers: ["骗自己", "不信", "反驳", "别扭", "像撒谎", "feels like a lie"],
    zh: { idea: "一句话离她现在的感觉太远，心里就会冒出反驳，越念越难受。这说明句子太远了，不说明她做错了。", how: "她说肯定语像撒谎时用。告诉她是句子的问题，然后帮她换一句近一点的。" },
    en: { idea: "When a line is too far from how she feels, the mind argues back and it feels worse. That means the line is too far, not that she failed.", how: "Use when an affirmation feels like a lie. Say it is the sentence, then help her find a closer one." } },
  { id: "s_ladder", coach: "subconscious", triggers: ["改句子", "怎么写", "换什么", "念什么", "what should i say", "rewrite"],
    zh: { idea: "句子可以往下退一级：「我是」→「我正在成为」→「我决定」→「我愿意」→「也许」→ 一个问句。哪一级念着不别扭，就从哪一级开始，顺了再往上走。", how: "她要改句子时用。只给一到两句，落在她现在能说出口的那一级。" },
    en: { idea: "A line can step down a rung: I am, I'm becoming, I decide, I'm willing, maybe, a question. Start at whichever rung feels easy, then climb.", how: "Use when she wants to rewrite a line. Offer one or two lines on the rung she can say now." } },
  { id: "s_question", coach: "subconscious", triggers: ["念不下去", "不想念", "念不出口", "can't say it"],
    zh: { idea: "把肯定句换成问句，比如「为什么我越来越轻松地收到钱？」。心里不太会反驳一个问题，而是会开始找答案。", how: "她连温和的句子都念不下去时，作为一个可选的办法给，不说成一定更有效。" },
    en: { idea: "Turn the affirmation into a question, like why is money coming to me more easily? The mind rarely argues with a question; it starts looking for answers.", how: "Offer as one option when even gentle lines won't come; don't sell it as proven better." } },
  { id: "s_evidence", coach: "subconscious", triggers: ["没用", "一点用", "没效果", "不灵", "doesn't work"],
    zh: { idea: "找一件最近的小事，说明这句话已经有一点点是真的，把它写进句子里。有了这一点依据，句子就站得住。", how: "她说念了没用时用。请她想一件小事，或者从她说过的话里找一件。" },
    en: { idea: "Find one small recent thing that shows the line is already a little true, and put it into the line so it has footing.", how: "Use when she says it isn't working. Ask for one small thing, or find one in what she has said." } },
  { id: "s_drowsy", coach: "subconscious", triggers: ["什么时候念", "睡前", "早上", "刚醒", "when should i"],
    zh: { idea: "快睡着和刚醒的时候，人最放松，心里最少反驳，这时候念最容易进去。", how: "她问什么时候念时用。给一个具体的时刻就好。" },
    en: { idea: "Just before sleep and just after waking she is most relaxed and argues least, so lines go in most easily.", how: "Use when she asks when to say them. Name one specific moment." } },
  { id: "s_daily_moments", coach: "subconscious", triggers: ["没时间", "忘了念", "坚持不了", "打卡", "no time", "forget"],
    zh: { idea: "把句子挂在每天一定会做的小动作上：刷牙、等水烧开、通勤、洗碗。不用专门腾时间，也不用打卡。", how: "她说坚持不下来、忘了念时用。帮她挑一个她生活里已经有的动作。" },
    en: { idea: "Hang the line on something she does every day anyway: brushing teeth, waiting for the kettle, commuting, washing up. No special time, no streaks.", how: "Use when she can't keep it up. Pick a habit already in her day." } },
  { id: "s_few_lines", coach: "subconscious", triggers: ["好多句", "清单", "列表", "很多肯定语", "list"],
    zh: { idea: "一次只留一两句，越少越容易念熟。今天换一句、明天换一句，它刚有点熟就被打断了。", how: "她在收集很多句子、经常换时用。帮她只留一句。" },
    en: { idea: "Keep just one or two lines; fewer become familiar faster. Swapping daily interrupts them just as they start to settle.", how: "Use when she collects many lines or keeps switching. Help her keep one." } },
  { id: "s_feeling_word", coach: "subconscious", triggers: ["没感觉", "干巴巴", "机械", "no feeling", "robotic"],
    zh: { idea: "句子里带一个感受词，比如「安心」「轻松」「踏实」，念的时候身体比较容易跟上。", how: "她说念起来没感觉时用。在她的原句里加一个感受词。" },
    en: { idea: "Put a feeling word into the line, like safe, easy, settled, so the body follows more readily.", how: "Use when the line feels flat. Add one feeling word to her own line." } },
  { id: "s_counter_thought", coach: "subconscious", triggers: ["冒出来", "反向念头", "负面念头", "又想到", "negative thought"],
    zh: { idea: "反向的念头冒出来时，不用和它吵，接一句「这是旧的」，然后把自己那句念完。吵得越凶，它越响。", how: "她说脑子里一直有反对声音时用。" },
    en: { idea: "When a contrary thought pops up, don't argue; add this is the old one and finish her own line. The harder she fights, the louder it gets.", how: "Use when a voice keeps contradicting her." } },
  { id: "s_feed", coach: "subconscious", triggers: ["刷到", "小红书", "抖音", "视频", "帖子", "别人说", "scrolling", "tiktok"],
    zh: { idea: "刷到的那些焦虑和别人的结论，会悄悄变成她脑子里的念头。少刷让她慌的内容，就是在少喂旧句子。", how: "她因为刷到的帖子、别人的说法而慌时用。给一个具体的小动作，比如今天先不看这类帖子。" },
    en: { idea: "Anxious posts and other people's verdicts quietly become her own thoughts. Scrolling less of what scares her is feeding the old lines less.", how: "Use when a post or someone's claim shook her. Suggest one small step, like skipping those posts today." } },
  { id: "s_play_role", coach: "subconscious", triggers: ["不相信", "信不了", "演", "装", "can't believe"],
    zh: { idea: "不用先相信，照着那个已经拥有的自己去说话、去做，演久了就成了她自己的样子。", how: "她说自己信不了时用，把门槛降到「先演一演」。" },
    en: { idea: "She doesn't have to believe first. Talk and act like the version who has it; played long enough, it becomes simply her.", how: "Use when she can't believe. Lower the bar to just playing it for now." } },
  { id: "s_anchor", coach: "subconscious", triggers: ["慌", "一下子", "突然", "怎么稳住", "panic", "suddenly"],
    zh: { idea: "给自己一个三四个字的短句当锚，比如「已完成」「旧剧本下线」，慌的时候一句话就能回到状态。", how: "她需要一个随时能用的东西时用。帮她起一个她自己喜欢的短句，不照搬现成口号。" },
    en: { idea: "A three- or four-word anchor phrase, like it's done or old script off, brings her back in one breath when panic hits.", how: "Use when she needs something to grab at any moment. Help her coin her own phrase." } },
];

function hash(text: string) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return value;
}

/** Very short replies, rewritten in AlreaDough's words from Xiaohongshu teachers' answers (batch 2026-11-20).
 * One or two are shown per chat turn so the model sees that a sentence or two is often the whole reply. */
type ShortExample = { coach: CoachMode | "any"; triggers: string[]; user: string; reply: string };
const shortExamples: ShortExample[] = [
  { coach: "assumption", triggers: ["考上", "录取", "上岸", "offer", "通过"], user: "我无条件相信我已经考上了。", reply: "你已经考上了。" },
  { coach: "assumption", triggers: ["又失去", "又没了", "飞速失去", "又走了", "又回去了"], user: "好不容易成了，又一下子没了，好受打击。", reply: "这还不是结局，接着来。" },
  { coach: "any", triggers: ["镜子", "长痘", "难看", "外貌", "脸"], user: "总忍不住照镜子挑毛病。", reply: "你已经是很好看的人了，偶尔对着镜子挑出一点瑕疵，也不影响这件事。" },
  { coach: "assumption", triggers: ["更想他", "越来越想", "控制不住想", "一直想他"], user: "开始显化以后，我反而更想他了。", reply: "因为你开始往这个念头里放力气了。换个角度想，他也开始莫名其妙想你了。" },
  { coach: "assumption", triggers: ["梦到", "梦见", "做梦"], user: "我梦到他来找我和好，是不是说明快成了？", reply: "你已经拥有了。现在你告诉我，这个梦还需要说明什么？" },
  { coach: "any", triggers: ["朋友", "闺蜜", "人缘"], user: "怎么显化一个灵魂契合的朋友？", reply: "她已经在你身边的时候，你是什么感觉？" },
  { coach: "subconscious", triggers: ["默念", "念出声", "出声", "写下来"], user: "肯定语是默念还是念出声？", reply: "不重要，哪种顺手就用哪种。" },
  { coach: "assumption", triggers: ["今天", "明天", "什么时候"], user: "我该认定他今天会来，还是已经来了？", reply: "已经来了。就像考完的那场试，考前再紧张，它也已经考过了。" },
  { coach: "assumption", triggers: ["用力", "好累", "不用力"], user: "怎么才能不用力？", reply: "你知道自己已经有了，就不会用力，就像你不会用力呼吸。" },
  { coach: "release", triggers: ["堵", "又回来", "又冒出来"], user: "胸口那种堵，放走了一会儿又回来了。", reply: "那是新冒出来的一层，接着放就行。" },
  { coach: "release", triggers: ["没感觉", "不耐烦", "没效果", "二十分钟"], user: "释放了二十分钟，一点感觉都没有，有点不耐烦。", reply: "你想快点学会吗？这个「想快」背后是什么感觉？就放它。" },
  { coach: "release", triggers: ["怕不成功", "害怕失败", "怕失败", "怕不成"], user: "成功过几次，现在特别怕不成功。", reply: "你已经知道自己在怕什么了，那就把这份怕放掉。" },
];

export function shortExamplesBlock(lang: CompanionLang, coach: CoachMode, request: string) {
  if (lang !== "zh") return "";
  const pool = shortExamples.filter((example) => example.coach === "any" || example.coach === coach);
  const text = request.toLowerCase();
  const matched = pool.filter((example) => example.triggers.some((trigger) => text.includes(trigger.toLowerCase())));
  const rest = pool.filter((example) => !matched.includes(example));
  const start = rest.length ? hash(request) % rest.length : 0;
  const picked = [...matched, ...rest.map((_, offset) => rest[(start + offset) % rest.length])].slice(0, 2);
  if (!picked.length) return "";
  return `很短的回复示范（只学篇幅和口气：很多时候一两句就是完整的回复，不铺垫、不讲道理也可以；不照抄句子）：\n${picked.map((example) => `用户：${example.user}\n陪伴者：${example.reply}`).join("\n")}`;
}

/** Cards her words point to come first; the rest rotate by message. Ideas already used in recent replies are skipped. */
export function pickCoachCards(coach: CoachMode, request: string, previousUser = "", count = 3, recentAssistant: string[] = []) {
  const recent = recentAssistant.slice(-3).join("\n");
  const pool = coachCards.filter((card) => card.coach === coach && !(recent && usedMarkers[card.id]?.test(recent)));
  const text = `${request} ${previousUser}`.toLowerCase();
  const matched = pool
    .map((card) => ({ card, score: card.triggers.filter((trigger) => text.includes(trigger.toLowerCase())).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ card }) => card);
  const rest = pool.filter((card) => !matched.includes(card));
  const start = rest.length ? hash(request) % rest.length : 0;
  const rotated = rest.map((_, offset) => rest[(start + offset) % rest.length]);
  return [...matched, ...rotated].slice(0, count);
}

export function coachCardsBlock(lang: CompanionLang, coach: CoachMode, request: string, previousUser = "", recentAssistant: string[] = []) {
  const cards = pickCoachCards(coach, request, previousUser, 3, recentAssistant);
  const askedToLetGo = coach === "release" && recentAssistant.slice(-2).some((text) => letGoInvite.test(text));
  const lines = cards.map((card) => `- ${card[lang].idea}${lang === "zh" ? "用法：" : " Use: "}${card[lang].how}`);
  const parts: string[] = [];
  if (lines.length) parts.push(lang === "zh"
    ? `本轮可用的流派知识（需要讲道理或给做法时，从中挑最贴她这句话的一张；最近几条回复已经讲过的道理不在这里，也不要换个说法再讲一遍；用自己的话讲，不照抄，不提导师名字）：\n${lines.join("\n")}`
    : `Method knowledge available this turn (when the turn needs an idea or a practice, pick the one that best fits her message; ideas already used in recent replies are left out, so don't rephrase them; say it in your own words, never name teachers):\n${lines.join("\n")}`);
  const shorts = shortExamplesBlock(lang, coach, request);
  if (shorts) parts.push(shorts);
  if (askedToLetGo) parts.push(lang === "zh"
    ? "最近的回复已经请她留意紧绷、问过她愿不愿意松开，这一轮不要再问，也不要再请她留意身体哪里紧；换成接住这件事、写一个画面、讲上面另一个道理，或者只简短回应。"
    : "A recent reply already asked her to notice the tension and whether she is willing to loosen it. Do not ask again this turn or point her back to the body; meet the moment, write a scene, use another idea above, or answer briefly.");
  return parts.join("\n\n");
}

/**
 * Reframe is Neville's revision, an Assumption practice, so it always draws on Assumption cards whatever guidance
 * method she picked for chat. The first ones are the core of how a thought is turned.
 */
const revisionCardIds = ["a_i_am", "a_self_concept", "a_past_not_evidence", "a_if_already", "a_live_in_end", "a_doubt_story", "a_creating_absence"];

/** Reframe: the method knowledge the new thought is written from. Cards her old thought points to come first, then the core ones. */
export function revisionCardsBlock(lang: CompanionLang, request: string) {
  const pool = revisionCardIds.map((id) => coachCards.find((card) => card.id === id)).filter((card): card is CoachCard => Boolean(card));
  const text = request.toLowerCase();
  const matched = pool.filter((card) => card.triggers.some((trigger) => text.includes(trigger.toLowerCase())));
  const cards = [...matched, ...pool.filter((card) => !matched.includes(card))].slice(0, 3);
  if (!cards.length) return "";
  const lines = cards.map((card) => `- ${card[lang].idea}`);
  return lang === "zh"
    ? `写新念头时依据的流派知识（用这些道理决定这句话怎么写：现在时、从已经实现的身份出发、不拿过去当证据；道理本身不写进句子，不提导师名字和流派）：\n${lines.join("\n")}`
    : `Method knowledge to write the new thought from (let these ideas decide how the line is built: present tense, spoken from the identity of having it, the past never taken as evidence; never put the idea itself in the line or name teachers or schools):\n${lines.join("\n")}`;
}
