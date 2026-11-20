import { env } from "cloudflare:workers";
import { VOICE_LIMITS, remainingToday } from "./voice-limits";
import { deleteVoice } from "./voice-service";
import { requestOwner } from "./request-owner";

// Her cloned voice (an id on the provider's side, never the recording) and how much voice she used today.

const today = () => new Date().toISOString().slice(0, 10);

export async function getVoice(userId: string) {
  return env.DB.prepare("SELECT voice_id AS voiceId, model, created_at AS createdAt FROM user_voices WHERE user_id = ?").bind(userId).first<{ voiceId: string; model: string; createdAt: string }>();
}

export async function saveVoice(userId: string, voiceId: string, model: string) {
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO user_voices (user_id, voice_id, model, consented_at, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET voice_id = excluded.voice_id, model = excluded.model, consented_at = excluded.consented_at, created_at = excluded.created_at")
    .bind(userId, voiceId, model, now, now).run();
}

/**
 * Voices used to belong to a device id. The first time a signed-in account brings that device along, the voice
 * moves to the account; if the account already has its own voice, the device's copy is deleted at the provider.
 */
export async function adoptDeviceVoice(accountKey: string, deviceKey: string | null) {
  if (!deviceKey || deviceKey === accountKey) return;
  await env.DB.prepare("UPDATE user_voices SET user_id = ? WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM user_voices WHERE user_id = ?)").bind(accountKey, deviceKey, accountKey).run();
  if (await getVoice(deviceKey)) await removeVoice(deviceKey);
}

/** The account (or, with membership off, the device) whose voice and daily allowance a request uses. */
export async function voiceOwner(request: Request) {
  const owner = await requestOwner(request);
  if (!owner) return null;
  if (owner.accountId) await adoptDeviceVoice(owner.key, owner.deviceKey);
  return owner.key;
}

/** Remove her voice at the provider and here. Returns false only if the provider could not delete it. */
export async function removeVoice(userId: string): Promise<boolean> {
  const existing = await getVoice(userId);
  if (!existing) return true;
  const deleted = await deleteVoice(existing.voiceId);
  if (deleted) await env.DB.prepare("DELETE FROM user_voices WHERE user_id = ?").bind(userId).run();
  return deleted;
}

export async function usageFor(userId: string) {
  const day = today();
  const [mine, site] = await Promise.all([
    env.DB.prepare("SELECT chars, enrolls FROM voice_usage_daily WHERE user_id = ? AND usage_date = ?").bind(userId, day).first<{ chars: number; enrolls: number }>(),
    env.DB.prepare("SELECT chars FROM voice_global_daily WHERE usage_date = ?").bind(day).first<{ chars: number }>(),
  ]);
  return { userChars: mine?.chars || 0, enrolls: mine?.enrolls || 0, siteChars: site?.chars || 0 };
}

/** Reserve billed characters before calling the provider. Returns null when today's limit is reached. */
export async function reserveChars(userId: string, need: number): Promise<{ userLeft: number } | null> {
  const used = await usageFor(userId);
  const room = remainingToday(used.userChars, used.siteChars, need);
  if (!room.allowed) return null;
  const day = today();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO voice_usage_daily (user_id, usage_date, chars, requests) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, usage_date) DO UPDATE SET chars = chars + excluded.chars, requests = requests + 1").bind(userId, day, need),
    env.DB.prepare("INSERT INTO voice_global_daily (usage_date, chars) VALUES (?, ?) ON CONFLICT(usage_date) DO UPDATE SET chars = chars + excluded.chars").bind(day, need),
  ]);
  return { userLeft: room.userLeft - need };
}

/** Give characters back when the provider call failed. */
export async function refundChars(userId: string, amount: number) {
  const day = today();
  await env.DB.batch([
    env.DB.prepare("UPDATE voice_usage_daily SET chars = MAX(chars - ?, 0), requests = MAX(requests - 1, 0) WHERE user_id = ? AND usage_date = ?").bind(amount, userId, day),
    env.DB.prepare("UPDATE voice_global_daily SET chars = MAX(chars - ?, 0) WHERE usage_date = ?").bind(amount, day),
  ]);
}

export async function recordEnroll(userId: string): Promise<boolean> {
  const used = await usageFor(userId);
  if (used.enrolls >= VOICE_LIMITS.enrollsPerDay) return false;
  await env.DB.prepare("INSERT INTO voice_usage_daily (user_id, usage_date, enrolls) VALUES (?, ?, 1) ON CONFLICT(user_id, usage_date) DO UPDATE SET enrolls = enrolls + 1").bind(userId, today()).run();
  return true;
}

/** "Delete my data": the voice at the provider, then every row about her voice and usage. */
export async function deleteAllVoiceData(userId: string): Promise<boolean> {
  const voiceGone = await removeVoice(userId);
  await env.DB.prepare("DELETE FROM voice_usage_daily WHERE user_id = ?").bind(userId).run();
  return voiceGone;
}
