// Browser-side membership helpers shared by the pricing page and the in-app membership panel.
// The numbers mirror MEMBER_LIMITS in lib/membership.ts (server); keep the two in step.

export type MemberPlanId = "soft" | "deep" | "atelier";
type Lang = "zh" | "en";

// stories: scripts a week, mirroring STORY_LIMITS (server)
export const MEMBER_PLANS = [
  { id: "soft", name: { zh: "抟土", en: "Kaolin" }, price: 0, session: 6, week: 15, stories: 1 },
  { id: "deep", name: { zh: "炼石", en: "Celadon" }, price: 39, session: 30, week: 100, stories: 5 },
  { id: "atelier", name: { zh: "天成", en: "Porcelain" }, price: 149, session: 80, week: 300, stories: 20 },
] as const;

/**
 * What Porcelain gives, said without naming models: its conversations, scripts and reframes are written by the best
 * model; Kaolin and Celadon use the value model (app/api/companion). Founder's wording brief 2026-11-21: make 天成 feel
 * like the way to the fulfilled day, without promising a result.
 */
export const PORCELAIN_PROMISE = {
  zh: "让愿望天成：和已经选择了你的那一版 TA 说话，陪伴和剧本都给到最多，让你每天都住在愿望已经实现的那一天里。",
  en: "Let it come true: talk with the version of TA who has already chosen you, with the most companionship and scripts, so that every day you live in the day it has already happened.",
} as const;

/** A chat pack, mirroring CHAT_PACK, ORDER_PRICE_FEN.chats and WAFFO_PRICE_CENTS.chats on the server. */
export const CHAT_PACK = { replies: 100, alipay: 15, card: "US$2.99" } as const;

export type MemberUsage = { fiveUnits: number; weekUnits: number; fiveResetMs: number; weekResetMs: number };
export type Membership = {
  plan: MemberPlanId;
  trial: boolean;
  referral: boolean;
  referralUsed: boolean;
  referralEndMs: number | null;
  periodEndMs: number | null;
  usage: MemberUsage;
  limits: { fiveHours: number; week: number };
  /** Story scripts this week: used, the plan's allowance, and when it resets (Monday). */
  story?: { used: number; limit: number; resetMs: number };
  /** The new account's first seven days of Porcelain (atelier). */
  welcome?: boolean;
  unlimited?: boolean;
  /** Replies left in her chat packs; used once the plan's 5-hour or weekly allowance runs out. */
  chatCredits?: number;
};
export type MemberStatus = {
  enabled: boolean;
  emailAvailable: boolean;
  googleAvailable?: boolean;
  authenticated: boolean;
  checkoutAvailable: boolean;
  /** Card / Apple Pay / Google Pay through Waffo Pancake. */
  cardCheckoutAvailable?: boolean;
  /** Card checkout for one screenshot import (needs its own Waffo product). */
  screenshotCardAvailable?: boolean;
  /** Card checkout for a chat pack (needs its own Waffo product, WAFFO_PRODUCT_CHATS). */
  chatCardAvailable?: boolean;
  membership: Membership | null;
  /** TA screenshot import: included with paid Atelier, or single uses bought one at a time. */
  screenshots?: { mode: "included" | "credit" | "buy"; credits: number; weekLeft: number | null } | null;
};

export function planName(plan: MemberPlanId, lang: Lang) {
  return MEMBER_PLANS.find((item) => item.id === plan)?.name[lang] || plan;
}

export async function fetchMemberStatus(): Promise<MemberStatus | null> {
  const response = await fetch("/api/member/status", { cache: "no-store" });
  return response.ok ? (await response.json() as MemberStatus) : null;
}

/** POST to a member endpoint; throws Error(code) with the server's error code on failure. */
export async function memberPost<T = Record<string, unknown>>(path: string, body: Record<string, string> = {}): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "REQUEST_FAILED");
  return data;
}

/** ZPay checkout answers with a form to post; posting it opens the Alipay page. */
export function submitCheckoutForm(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function memberErrorText(reason: string, lang: Lang) {
  const zh = lang === "zh";
  if (reason === "TOO_MANY_REQUESTS") return zh ? "操作太频繁，请稍后重试。" : "Too many attempts. Please try later.";
  if (reason === "INVALID_CODE") return zh ? "验证码不正确或已过期。" : "The code is incorrect or expired.";
  if (reason === "INVALID_REFERRAL") return zh ? "邀请码不对，再检查一下。" : "That invitation code did not work.";
  if (reason === "REFERRAL_USED") return zh ? "这个账户已经用过邀请码了。" : "This account has already used an invitation code.";
  return zh ? "暂时没成功，请稍后再试。" : "That did not work. Please try again.";
}

export function usagePercent(units: number, limit: number) {
  if (!limit) return 0;
  return Math.max(0, Math.min(100, Math.round((units / limit) * 100)));
}

/** Which allowance is used up, if any. Founder (unlimited) accounts are never out. */
export function exhaustedWindow(membership: Membership | null | undefined): "five" | "week" | null {
  if (!membership || membership.unlimited) return null;
  if (membership.usage.weekUnits >= membership.limits.week) return "week";
  if (membership.usage.fiveUnits >= membership.limits.fiveHours) return "five";
  return null;
}

/** "今天 23:00" / "明天 03:00" / "周一 08:00", like the reset times in other AI apps. */
export function resetLabel(ms: number, lang: Lang, now = Date.now()) {
  const zh = lang === "zh";
  const at = new Date(ms);
  const time = at.toLocaleTimeString(zh ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: !zh });
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(at) - startOfDay(new Date(now))) / 86_400_000);
  if (days <= 0) return zh ? `今天 ${time}` : `today ${time}`;
  if (days === 1) return zh ? `明天 ${time}` : `tomorrow ${time}`;
  if (days < 7) return `${at.toLocaleDateString(zh ? "zh-CN" : "en-US", { weekday: "short" })} ${time}`;
  return `${at.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric" })} ${time}`;
}
