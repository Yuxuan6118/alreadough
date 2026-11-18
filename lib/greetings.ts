// Home-screen greeting ("欢迎回来，名字"): rotates by time of day, holidays (by IP country), and a few special moments.
// Pure functions so they can be tested; the page picks once per open and remembers recent picks to avoid repeats.

type Line = { id: string; zh: string; en: string; ask?: boolean };
type Holiday = Line & { regions: "all" | "CN" | "US" | "zh" };

const line = (id: string, zh: string, en: string, ask = false): Line => ({ id, zh, en, ask });

// Device local time. Morning 6–11, noon 11–14, afternoon 14–17, evening 17–23, late night 23–6.
const BY_TIME: Record<"morning" | "noon" | "afternoon" | "evening" | "night", Line[]> = {
  morning: [
    line("m1", "早上好", "Good morning"),
    line("m2", "早安", "Morning"),
    line("m3", "醒啦", "You're up"),
    line("m4", "新的一天", "A new day"),
    line("m5", "早，今天想先做什么", "Morning. What's first today", true),
    line("m6", "咖啡泡好了吗", "Coffee ready", true),
    line("m7", "新的一天从这里开始吧", "Let's start the day here"),
    line("m8", "睡得好吗", "Sleep well", true),
  ],
  noon: [
    line("n1", "中午好", "Good afternoon"),
    line("n2", "吃过饭了吗", "Had lunch yet", true),
    line("n3", "午休时间到啦", "Lunch break"),
    line("n4", "上午过得怎么样", "How was your morning", true),
  ],
  afternoon: [
    line("a1", "下午好", "Good afternoon"),
    line("a2", "下午茶时间", "Teatime"),
    line("a3", "休息一下吧", "Take a little break"),
    line("a4", "下午也来待一会儿吧", "Stay a while this afternoon"),
  ],
  evening: [
    line("e1", "晚上好", "Good evening"),
    line("e2", "今天辛苦啦", "Long day", true),
    line("e3", "到家了吗", "Home yet", true),
    line("e4", "晚饭吃了什么", "What was dinner", true),
    line("e5", "忙完啦", "All done for today", true),
    line("e6", "今天过得怎么样", "How was today", true),
    line("e7", "窝进沙发了吗", "Settled in on the couch", true),
  ],
  night: [
    line("z1", "还没睡呀", "Still up", true),
    line("z2", "夜深了", "It's late"),
    line("z3", "睡不着就来聊聊吧", "Can't sleep? Let's talk"),
    line("z4", "睡前再聊聊", "One more chat before sleep"),
    line("z5", "我夜里也在", "I'm here at night too"),
    line("z6", "窝进被窝了吗", "Tucked in yet", true),
  ],
};

const ANYTIME: Line[] = [
  line("g1", "欢迎回来", "Welcome back"),
  line("g2", "又见面啦", "Here we are again"),
  line("g3", "你来啦", "There you are"),
  line("g4", "我在呢", "I'm here"),
  line("g5", "想聊点什么", "What's on your mind", true),
  line("g6", "今天想从哪里说起", "Where shall we start", true),
  line("g7", "慢慢来", "Take your time"),
  line("g8", "回来就好", "Glad you're back"),
  line("g9", "今天也是你的一天", "Today is yours too"),
  line("g10", "有什么新鲜事吗", "Anything new", true),
];

const WEEKDAY: Record<number, Line[]> = {
  1: [line("w1", "周一好", "Happy Monday")],
  5: [line("w5", "周五啦", "It's Friday")],
  6: [line("w6", "周末愉快", "Happy weekend"), line("w6b", "周末睡到自然醒了吗", "Sleep in this weekend", true)],
  0: [line("w0", "周末愉快", "Happy weekend"), line("w0b", "周末睡到自然醒了吗", "Sleep in this weekend", true)],
};

const SPECIAL = {
  first: line("s1", "第一次见面", "Nice to meet you"),
  away: line("s2", "好久不见", "Long time no see"),
  checked: line("s4", "打过卡了呀", "Checked in already"),
};

// Lunar-calendar holidays, by Gregorian date (month-day), 2026–2030.
const LUNAR: Record<number, { eve: string; spring: string; dragon: string; qingming: string; autumn: string }> = {
  2026: { eve: "02-16", spring: "02-17", dragon: "06-19", qingming: "04-05", autumn: "09-25" },
  2027: { eve: "02-05", spring: "02-06", dragon: "06-09", qingming: "04-05", autumn: "09-15" },
  2028: { eve: "01-25", spring: "01-26", dragon: "05-28", qingming: "04-04", autumn: "10-03" },
  2029: { eve: "02-12", spring: "02-13", dragon: "06-16", qingming: "04-04", autumn: "09-22" },
  2030: { eve: "02-02", spring: "02-03", dragon: "06-05", qingming: "04-05", autumn: "09-12" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const md = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** nth (1-based) weekday of a month; n = -1 means the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  if (n === -1) {
    const last = new Date(year, month + 1, 0);
    return last.getDate() - ((last.getDay() - weekday + 7) % 7);
  }
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/**
 * Holidays falling on this date. regions: "all" everyone; "CN" mainland China IP; "US" US IP;
 * "zh" mainland China IP, or anyone using the Chinese interface (overseas Chinese keep 端午 and 中秋).
 * Left out on purpose: Veterans Day, Memorial Day and Columbus Day (a sombre or contested day is not a "happy" greeting).
 */
export function holidaysOn(date: Date): Holiday[] {
  const y = date.getFullYear();
  const key = md(date);
  const out: Holiday[] = [];
  const add = (regions: Holiday["regions"], id: string, zh: string, en: string) => out.push({ id, zh, en, regions });
  if (key === "01-01") add("all", "h-newyear", "新年好", "Happy New Year");
  if (key === "02-14") add("all", "h-valentine", "情人节快乐", "Happy Valentine's Day");
  if (key === "12-24") add("all", "h-xmaseve", "平安夜快乐", "Merry Christmas Eve");
  if (key === "12-25") add("all", "h-xmas", "圣诞快乐", "Merry Christmas");
  if (key === "12-31") add("all", "h-nye", "今年最后一天啦", "Last day of the year");
  const lunar = LUNAR[y];
  if (lunar) {
    if (key === lunar.eve) add("all", "h-eve", "除夕快乐", "Happy Lunar New Year's Eve");
    if (key === lunar.spring) add("all", "h-spring", "新春快乐", "Happy Lunar New Year");
    if (key === lunar.qingming) add("CN", "h-qingming", "清明安康", "Qingming today");
    if (key === lunar.dragon) add("zh", "h-dragon", "端午安康", "Happy Dragon Boat Festival");
    if (key === lunar.autumn) add("zh", "h-autumn", "中秋快乐", "Happy Mid-Autumn Festival");
  }
  if (key === "05-01") add("CN", "h-labour", "劳动节快乐", "Happy Labour Day");
  if (key >= "10-01" && key <= "10-07") add("CN", "h-national", key === "10-01" ? "国庆快乐" : "国庆假期愉快", "Enjoy the National Day holiday");
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 0 && d === nthWeekday(y, 0, 1, 3)) add("US", "h-mlk", "长周末愉快", "Enjoy the long weekend");
  if (m === 1 && d === nthWeekday(y, 1, 1, 3)) add("US", "h-presidents", "长周末愉快", "Enjoy the long weekend");
  if (key === "06-19") add("US", "h-juneteenth", "六月节快乐", "Happy Juneteenth");
  if (key === "07-04") add("US", "h-july4", "独立日快乐", "Happy Fourth of July");
  if (m === 8 && d === nthWeekday(y, 8, 1, 1)) add("US", "h-labor-us", "长周末愉快", "Enjoy the long weekend");
  if (m === 10 && d === nthWeekday(y, 10, 4, 4)) add("US", "h-thanks", "感恩节快乐", "Happy Thanksgiving");
  return out;
}

export function timeSlot(hour: number): keyof typeof BY_TIME {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "noon";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "night";
}

export type GreetingContext = {
  now: Date;
  lang: "zh" | "en";
  country: string | null;
  firstVisit: boolean;
  daysAway: number | null;
  checkedToday: boolean;
  streak: number;
  recent: string[];
  random?: () => number;
};

export function pickGreeting(ctx: GreetingContext): { id: string; zh: string; en: string; ask: boolean; streak?: number } {
  const rand = ctx.random ?? Math.random;
  const pick = (pool: Line[]) => {
    const fresh = pool.filter((item) => !ctx.recent.includes(item.id));
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(rand() * list.length)];
  };
  const shown = (l: Line, streak?: number) => ({ id: l.id, zh: l.zh, en: l.en, ask: !!l.ask, streak });

  const country = (ctx.country || "").toUpperCase();
  const holiday = holidaysOn(ctx.now).find((h) => h.regions === "all" || (h.regions === "CN" && country === "CN") || (h.regions === "US" && country === "US") || (h.regions === "zh" && (country === "CN" || ctx.lang === "zh")));
  if (holiday) return shown(holiday);
  if (ctx.firstVisit) return shown(SPECIAL.first);
  if (ctx.daysAway !== null && ctx.daysAway > 7) return shown(SPECIAL.away);
  if (ctx.checkedToday && rand() < 0.5) return shown(SPECIAL.checked);
  if (ctx.streak >= 3 && rand() < 0.4) return { id: "s3", zh: `连续第 ${ctx.streak} 天见到你`, en: `Day ${ctx.streak} in a row`, ask: false, streak: ctx.streak };
  const slot = timeSlot(ctx.now.getHours());
  // "今天也是你的一天" reads oddly after midnight; "睡到自然醒" only makes sense before the afternoon.
  const anytime = slot === "night" ? ANYTIME.filter((item) => item.id !== "g9") : ANYTIME;
  const weekday = (WEEKDAY[ctx.now.getDay()] ?? []).filter((item) => !item.id.endsWith("b") || slot === "morning" || slot === "noon");
  return shown(pick([...BY_TIME[slot], ...anytime, ...weekday]));
}

/** "晚饭吃了什么，瑄瑄？" / "Good evening, Xuan" — the name is dropped cleanly when there is none. */
export function formatGreeting(g: { zh: string; en: string; ask: boolean }, lang: "zh" | "en", name: string) {
  const who = name.trim();
  if (lang === "zh") return `${g.zh}${who ? `，${who}` : ""}${g.ask ? "？" : ""}`;
  return `${g.en}${who ? `, ${who}` : ""}${g.ask ? "?" : ""}`;
}
