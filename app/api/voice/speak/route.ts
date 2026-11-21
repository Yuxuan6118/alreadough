import { betaStatus } from "@/lib/beta-guard";
import { getVoice, voiceDailyAllowance, voiceOwner, refundChars, reserveChars } from "@/lib/voice-db";
import { checkSpeakText } from "@/lib/voice-limits";
import { DEFAULT_VOICE, synthesize } from "@/lib/voice-service";

// Read a piece of text aloud, in her own voice when she has one. The device keeps the audio, so a text is never paid for twice.

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const userId = await voiceOwner(request);
  if (!userId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  const status = await betaStatus(request);
  if (!status.authenticated || !status.enabled) return json({ error: "AI_PAUSED" }, 429);
  if (!process.env.OPENAI_API_KEY) return json({ error: "VOICE_NOT_CONFIGURED" }, 503);

  let body: { text?: unknown; useMyVoice?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "INVALID_JSON" }, 400); }
  const checked = checkSpeakText(body.text);
  if (!checked.ok) return json({ error: checked.code }, 400);

  const mine = body.useMyVoice === false ? null : await getVoice(userId);
  const reservation = await reserveChars(userId, checked.billed, await voiceDailyAllowance(request));
  if (!reservation) return json({ error: "VOICE_DAILY_LIMIT" }, 429);

  const spoken = await synthesize(checked.text, mine?.voiceId || DEFAULT_VOICE);
  if (!spoken.ok) {
    await refundChars(userId, checked.billed);
    return json({ error: "VOICE_FAILED", message: spoken.reason }, 502);
  }
  return new Response(spoken.audio, {
    headers: {
      "Content-Type": spoken.contentType,
      "Cache-Control": "no-store",
      "x-voice-owner": mine ? "mine" : "default",
      "x-voice-chars-left": String(reservation.userLeft),
    },
  });
}
