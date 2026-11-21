import { betaStatus } from "@/lib/beta-guard";
import { getVoice, voiceDailyAllowance, voiceOwner, recordEnroll, removeVoice, saveVoice, usageFor } from "@/lib/voice-db";
import { VOICE_LIMITS, checkSample } from "@/lib/voice-limits";
import { VOICE_MODEL, createVoice, deleteVoice } from "@/lib/voice-service";

// Her own voice: whether she has one, record it, delete it.

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const userId = await voiceOwner(request);
  if (!userId) return json({ authenticated: false }, 401);
  const voice = await getVoice(userId);
  const [used, daily] = await Promise.all([usageFor(userId), voiceDailyAllowance(request)]);
  return json({ hasVoice: Boolean(voice), createdAt: voice?.createdAt || null, charsLeftToday: Math.max(0, daily - used.userChars) });
}

export async function POST(request: Request) {
  const userId = await voiceOwner(request);
  if (!userId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  const status = await betaStatus(request);
  if (!status.authenticated || !status.enabled) return json({ error: "AI_PAUSED" }, 429);
  if (!process.env.OPENAI_API_KEY) return json({ error: "VOICE_NOT_CONFIGURED" }, 503);

  let body: { consent?: unknown; audio?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "INVALID_JSON" }, 400); }
  if (body.consent !== true) return json({ error: "CONSENT_REQUIRED" }, 400);
  const dataUri = typeof body.audio === "string" ? body.audio : "";
  const match = /^data:audio\/wav;base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  if (!match || dataUri.length > VOICE_LIMITS.maxSampleBytes * 1.4) return json({ error: "BAD_AUDIO" }, 400);
  const bytes = Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
  const sample = checkSample(bytes);
  if (!sample.ok) return json({ error: sample.code }, 400);

  if (!(await recordEnroll(userId))) return json({ error: "TOO_MANY_RECORDINGS" }, 429);
  const created = await createVoice(dataUri);
  if (!created.ok) return json({ error: "VOICE_FAILED", message: created.reason }, 502);

  // replace the old voice only after the new one is ready
  const previous = await getVoice(userId);
  await saveVoice(userId, created.voiceId, VOICE_MODEL);
  if (previous && previous.voiceId !== created.voiceId) await deleteVoice(previous.voiceId);
  return json({ hasVoice: true });
}

export async function DELETE(request: Request) {
  const userId = await voiceOwner(request);
  if (!userId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  const deleted = await removeVoice(userId);
  return json({ deleted }, deleted ? 200 : 502);
}
