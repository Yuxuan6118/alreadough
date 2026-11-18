// Home-screen greeting ("欢迎回来，名字"): rotates by time of day, holidays (by IP country), and a few special moments.
// Pure functions so they can be tested; the page picks once per open and remembers recent picks to avoid repeats.

type Line = { id: string; zh: string; en: string; ask?: boolean };
type Holiday = Line & { regions: "all" | "CN" | "US" | "zh" };

const line = (id: string, zh: string, en: string, ask = false): Line => ({ id, zh, en, ask });

// Each line carries the hours it may appear in (device local time, [from, to), wrapping past midnight).
// Day parts, the way they are said in Chinese: 凌晨 1–6, 早上 6–9, 上午 9–11, 中午 11–13, 下午 13–17, 傍晚 17–19, 晚上 19–23, 深夜 23–1.
type TimedLine = Line & { from: number; to: number };
const timed = (id: string, from: number, to: number, zh: string, en: string, ask = false): TimedLine => ({ id, zh, en, ask, from, to });

const TIMED: TimedLine[] = [
  // 早上 / 上午
  timed("m1", 6, 10, "早上好", "Good morning"),
  timed("m2", 6, 10, "早安", "Morning"),
  timed("m3", 6, 10, "醒啦", "You're up"),
  timed("m4", 6, 11, "新的一天", "A new day"),
  timed("m5", 6, 10, "早，今天想先做什么", "Morning. What's first today", true),
  timed("m6", 7, 11, "咖啡泡好了吗", "Coffee ready", true),
  timed("m7", 6, 11, "新的一天从这里开始吧", "Let's start the day here"),
  timed("m8", 6, 10, "睡得好吗", "Sleep well", true),
  timed("m9", 9, 11, "上午好", "Good morning"),
  // 中午
  timed("n1", 11, 13, "中午好", "Hi, it's midday"),
  timed("n2", 11, 14, "吃过饭了吗", "Had lunch yet", true),
  timed("n3", 12, 14, "午休时间到啦", "Lunch break"),
  timed("n4", 11, 14, "上午过得怎么样", "How was your morning", true),
  // 下午
  timed("a1", 13, 17, "下午好", "Good afternoon"),
  timed("a2", 14, 17, "下午茶时间", "Teatime"),
  timed("a3", 13, 17, "休息一下吧", "Take a little break"),
  timed("a4", 13, 17, "下午也来待一会儿吧", "Stay a while this afternoon"),
  // 傍晚 / 晚上
  timed("e8", 17, 20, "下班了吗", "Off work yet", true),
  timed("e1", 18, 24, "晚上好", "Good evening"),
  timed("e2", 17, 23, "今天辛苦啦", "Long day today"),
  timed("e3", 17, 22, "到家了吗", "Home yet", true),
  timed("e4", 18, 21, "晚饭吃了什么", "What was dinner", true),
  timed("e5", 17, 23, "忙完了吗", "All done for today", true),
  timed("e6", 17, 24, "今天过得怎么样", "How was today", true),
  timed("e7", 19, 23, "窝进沙发了吗", "Settled in on the couch", true),
  // 深夜 / 凌晨
  timed("z2", 23, 3, "夜深了", "It's late"),
  timed("z1", 23, 4, "还没睡呀", "Still up", true),
  timed("z4", 22, 2, "睡前再聊聊", "One more chat before sleep"),
  timed("z6", 22, 2, "窝进被窝了吗", "Tucked in yet", true),
  timed("z5", 23, 5, "我夜里也在", "I'm here at night too"),
  timed("z3", 0, 5, "睡不着就来聊聊吧", "Can't sleep? Let's talk"),
  timed("z7", 4, 6, "这么早就醒啦", "Up so early", true),
  // 周末早上
  timed("w6b", 7, 13, "周末睡到自然醒了吗", "Sleep in this weekend", true),
];

const inHours = (item: { from: number; to: number }, hour: number) => (item.from < item.to ? hour >= item.from && hour < item.to : hour >= item.from || hour < item.to);
/** Lines that fit this hour (weekend-only lines only on Saturday and Sunday). */
export function linesAt(now: Date): Line[] {
  const hour = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  return TIMED.filter((item) => inHours(item, hour) && (item.id !== "w6b" || weekend));
}

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
  6: [line("w6", "周末愉快", "Happy weekend")],
  0: [line("w0", "周末愉快", "Happy weekend")],
};

const SPECIAL = {
  first: line("s1", "第一次见面", "Nice to meet you"),
  away: line("s2", "好久不见", "Long time no see"),
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

export type GreetingContext = {
  now: Date;
  lang: "zh" | "en";
  country: string | null;
  firstVisit: boolean;
  daysAway: number | null;
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
  if (ctx.streak >= 3 && rand() < 0.4) return { id: "s3", zh: `连续第 ${ctx.streak} 天见到你`, en: `Day ${ctx.streak} in a row`, ask: false, streak: ctx.streak };
  const hour = ctx.now.getHours();
  const lateNight = hour >= 23 || hour < 6;
  // "今天也是你的一天" reads oddly after midnight.
  const anytime = lateNight ? ANYTIME.filter((item) => item.id !== "g9") : ANYTIME;
  return shown(pick([...linesAt(ctx.now), ...anytime, ...(WEEKDAY[ctx.now.getDay()] ?? [])]));
}

/** "晚饭吃了什么，瑄瑄？" / "Good evening, Xuan" — the name is dropped cleanly when there is none. */
export function formatGreeting(g: { zh: string; en: string; ask: boolean }, lang: "zh" | "en", name: string) {
  const who = name.trim();
  if (lang === "zh") return `${g.zh}${who ? `，${who}` : ""}${g.ask ? "？" : ""}`;
  return `${g.en}${who ? `, ${who}` : ""}${g.ask ? "?" : ""}`;
}
