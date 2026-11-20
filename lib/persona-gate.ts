import { beginBetaRequest } from "./beta-guard";
import { memberAccount } from "./member-auth";
import { isUnlimitedAccount, memberState, membershipEnabled } from "./membership";

// TA is a Dough Atelier feature. With membership switched off (local dev) everyone may use it.

export const PERSONA_MESSAGES: Record<string, Record<"zh" | "en", string>> = {
  ATELIER_REQUIRED: { zh: "和 TA 对话是丰盛工坊的功能。", en: "Talking with TA is part of Dough Atelier." },
  SIGN_IN_REQUIRED: { zh: "无法识别这台设备，请刷新页面后再试。", en: "This device could not be identified. Please refresh and try again." },
  MEMBERSHIP_SIGN_IN_REQUIRED: { zh: "请先到会员页用邮箱登录。", en: "Sign in with email on the membership page first." },
  MEMBERSHIP_LIMIT: { zh: "当前会员用量已经用完，可到会员页查看恢复时间。", en: "Your current allowance is used up. Check the membership page for its reset time." },
  AI_PAUSED: { zh: "AI 暂时不可用，请稍后再试。", en: "AI is temporarily unavailable. Please try again shortly." },
  BETA_BUDGET_PAUSED: { zh: "AI 现在请求有点多，请稍后再试一次。", en: "AI is getting a lot of requests right now. Please try again shortly." },
  AI_REQUEST_FAILED: { zh: "AI 暂时没有连接成功，请稍后再试。", en: "AI could not connect. Please try again shortly." },
};

export function personaError(code: string, lang: "zh" | "en", status: number) {
  return Response.json({ error: code, message: PERSONA_MESSAGES[code]?.[lang] || code }, { status, headers: { "Cache-Control": "no-store" } });
}

/** The strongest model we run; the Worker secret OPENAI_PERSONA_MODEL changes it without a code change. */
export function personaModel() {
  return process.env.OPENAI_PERSONA_MODEL || "qwen3.8-max";
}

export async function beginPersonaRequest(request: Request, sessionId: string) {
  if (membershipEnabled()) {
    const accountId = await memberAccount(request);
    if (!accountId) return { ok: false as const, code: "MEMBERSHIP_SIGN_IN_REQUIRED", status: 401 };
    const state = await memberState(accountId);
    if (state.plan !== "atelier" && !isUnlimitedAccount(accountId)) return { ok: false as const, code: "ATELIER_REQUIRED", status: 403 };
  }
  const gate = await beginBetaRequest(request, sessionId, "chat");
  if (!gate.ok) return { ok: false as const, code: gate.code, status: gate.code.includes("SIGN_IN") ? 401 : 429 };
  return { ok: true as const, ticket: gate.ticket };
}
