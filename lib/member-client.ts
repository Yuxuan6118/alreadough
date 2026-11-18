// Browser-side membership helpers shared by the pricing page and the in-app membership panel.
// The numbers mirror MEMBER_LIMITS in lib/membership.ts (server); keep the two in step.

export type MemberPlanId = "soft" | "deep" | "atelier";
type Lang = "zh" | "en";

export const MEMBER_PLANS = [
  { id: "soft", name: { zh: "轻揉", en: "Soft Start" }, price: 0, session: 15, week: 60 },
  { id: "deep", name: { zh: "醒发", en: "Deep Practice" }, price: 39, session: 60, week: 400 },
  { id: "atelier", name: { zh: "丰盛工坊", en: "Dough Atelier" }, price: 149, session: 200, week: 1500 },
] as const;

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
  unlimited?: boolean;
};
export type MemberStatus = {
  enabled: boolean;
  emailAvailable: boolean;
  googleAvailable?: boolean;
  authenticated: boolean;
  checkoutAvailable: boolean;
  /** Card / Apple Pay / Google Pay through Waffo Pancake. */
  cardCheckoutAvailable?: boolean;
  membership: Membership | null;
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
