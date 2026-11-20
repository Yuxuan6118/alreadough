import { claimWindow, memberAccount } from "./member-auth";
import { membershipEnabled } from "./membership";

/**
 * Who owns a request to a paid or private feature (synced space, voice, photo and sound search).
 * With membership on, only a signed-in account counts: the device id the browser makes up is not proof of anything.
 * With membership off (local development), the device id is still accepted.
 */
export type RequestOwner = { key: string; accountId: string | null; deviceKey: string | null };

export function deviceKey(request: Request) {
  const device = (request.headers.get("x-already-session-id") || "").trim();
  return device ? `device:${device.slice(0, 128)}` : null;
}

export async function requestOwner(request: Request): Promise<RequestOwner | null> {
  const device = deviceKey(request);
  const accountId = await memberAccount(request);
  if (accountId) return { key: `account:${accountId}`, accountId, deviceKey: device };
  if (membershipEnabled() || !device) return null;
  return { key: device, accountId: null, deviceKey: device };
}

/** Per-owner daily allowance for searches that call paid or rate-limited services. False when used up. */
export function claimDaily(owner: RequestOwner, bucket: string, max: number) {
  return claimWindow(`${bucket}:${owner.key}`, 86_400_000, max);
}

export const unauthorized = () => Response.json({ error: "SIGN_IN_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
export const tooMany = () => Response.json({ error: "DAILY_LIMIT" }, { status: 429, headers: { "Cache-Control": "no-store" } });
