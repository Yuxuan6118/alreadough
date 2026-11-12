import { env } from "cloudflare:workers";
import { VOICE_LIMITS, remainingToday } from "./voice-limits";
import { deleteVoice } from "./voice-service";

// Her cloned voice (an id on the provider's side, never the recording) and how much voice she used today.

let ready: Promise<unknown> | null = null;
export function ensureVoiceTables() {
  if (ready) return ready;
  ready = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS user_voices (user_id TEXT PRIMARY KEY NOT NULL, voice_id TEXT NOT NULL, model TEXT NOT NULL, consented_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS voice_usage_daily (user_id TEXT NOT NULL, usage_date TEXT NOT NULL, chars INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0, enrolls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, usage_date))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS voice_global_daily (usage_date TEXT PRIMARY KEY NOT NULL, chars INTEGER NOT NULL DEFAULT 0)"),
  ]).catch((error) => { ready = null; throw error; });
  return ready;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function getVoice(userId: string) {
  await ensureVoiceTables();
  return env.DB.prepare("SELECT voice_id AS voiceId, model, created_at AS createdAt FROM user_voices WHERE user_id = ?").bind(userId).first<{ voiceId: string; model: string; createdAt: string }>();
}

export async function saveVoice(userId: string, voiceId: string, model: string) {
  await ensureVoiceTables();
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO user_voices (user_id, voice_id, model, consented_at, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET voice_id = excluded.voice_id, model = excluded.model, consented_at = excluded.consented_at, created_at = excluded.created_at")
    .bind(userId, voiceId, model, now, now).run();
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
  await ensureVoiceTables();
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
  await ensureVoiceTables();
  const voiceGone = await removeVoice(userId);
  await env.DB.prepare("DELETE FROM voice_usage_daily WHERE user_id = ?").bind(userId).run();
  return voiceGone;
}
