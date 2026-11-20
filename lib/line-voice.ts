// One affirmation line as audio, the same way everywhere in 潜音: her own reading if she chose to read it herself,
// otherwise the cloud voice (her clone when she has one and wants it, else the default voice). Kept on the device so a line is paid for once.

import { readStored } from "./safe-storage";
import { readSelfLine } from "./self-voice";
import { cacheKey, readCached, writeCached } from "./voice-cache";

export const KEY_VOICE_SOURCE = "already-voice-source-v1";
const KEY_USE_MINE = "already-use-my-voice-v1";
export type VoiceSource = "default" | "clone" | "self";

export function storedVoiceSource(): VoiceSource {
  const saved = readStored(KEY_VOICE_SOURCE);
  if (saved === "default" || saved === "clone" || saved === "self") return saved;
  return readStored(KEY_USE_MINE) === "off" ? "default" : "clone";
}

/** Who speaks, worked out once per session: needs her voice status from /api/voice. */
export type LineVoice = { source: VoiceSource; hasClone: boolean; createdAt: string | null; headers: Record<string, string> };

export async function loadLineVoice(headers: Record<string, string>): Promise<LineVoice> {
  let hasClone = false;
  let createdAt: string | null = null;
  try {
    const data = await (await fetch("/api/voice", { headers })).json() as { hasVoice?: boolean; createdAt?: string | null };
    hasClone = Boolean(data.hasVoice);
    createdAt = data.createdAt || null;
  } catch { /* fall back to the default voice */ }
  return { source: storedVoiceSource(), hasClone, createdAt, headers };
}

export async function lineAudio(text: string, voice: LineVoice): Promise<Blob> {
  if (voice.source === "self") {
    const own = await readSelfLine(text);
    if (own) return own;
  }
  const useMine = voice.hasClone && voice.source !== "default";
  const key = await cacheKey(useMine ? `mine:${voice.createdAt}` : "default", text);
  const cached = await readCached(key);
  if (cached) return cached;
  const response = await fetch("/api/voice/speak", { method: "POST", headers: voice.headers, body: JSON.stringify({ text, useMyVoice: useMine }) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "VOICE_FAILED");
  }
  const blob = await response.blob();
  await writeCached(key, blob);
  return blob;
}
