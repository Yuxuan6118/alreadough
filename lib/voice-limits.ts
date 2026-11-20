// Rules for the listening voice. Pure functions, so they can be tested without a server.

/** Alibaba bills one Chinese character as two. */
export function billedChars(text: string): number {
  let total = 0;
  for (const ch of text) total += /[㐀-鿿豈-﫿]/.test(ch) ? 2 : 1;
  return total;
}

export const VOICE_LIMITS = {
  /** one request */
  maxBilledPerRequest: 3000,
  /** per person per day, in billed characters (about 4,000 Chinese characters) */
  userDailyBilled: 8000,
  /** whole site per day, a cost backstop */
  globalDailyBilled: 600_000,
  /** how many times she can record or re-record in a day */
  enrollsPerDay: 5,
  /** the clone sample, in seconds */
  minSampleSeconds: 8,
  maxSampleSeconds: 60,
  /** the clone sample, as a data URI of WAV, in bytes */
  maxSampleBytes: 6_000_000,
} as const;

export type SpeakCheck = { ok: true; text: string; billed: number } | { ok: false; code: "EMPTY_TEXT" | "TEXT_TOO_LONG" };

/** Clean the text we are about to read aloud and make sure it is a sensible size. */
export function checkSpeakText(raw: unknown): SpeakCheck {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const text = typeof raw === "string" ? raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+\n/g, "\n").trim() : "";
  if (!text) return { ok: false, code: "EMPTY_TEXT" };
  const billed = billedChars(text);
  if (billed > VOICE_LIMITS.maxBilledPerRequest) return { ok: false, code: "TEXT_TOO_LONG" };
  return { ok: true, text, billed };
}

/** Does the person still have room today? Returns how many billed characters are left. */
export function remainingToday(usedByUser: number, usedBySite: number, need: number) {
  const userLeft = Math.max(0, VOICE_LIMITS.userDailyBilled - usedByUser);
  const siteLeft = Math.max(0, VOICE_LIMITS.globalDailyBilled - usedBySite);
  return { userLeft, siteLeft, allowed: need <= userLeft && need <= siteLeft };
}

/** Seconds of audio in a 16-bit PCM WAV file, or null when it is not one we can read. */
export function wavSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt ") byteRate = view.getUint32(offset + 16, true);
    if (id === "data") return byteRate > 0 ? Math.min(size, bytes.length - offset - 8) / byteRate : null;
    offset += 8 + size + (size % 2);
  }
  return null;
}

/** The sample must be a readable WAV of a sensible length. */
export function checkSample(bytes: Uint8Array): { ok: true; seconds: number } | { ok: false; code: "BAD_AUDIO" | "SAMPLE_TOO_SHORT" | "SAMPLE_TOO_LONG" } {
  const seconds = wavSeconds(bytes);
  if (seconds === null) return { ok: false, code: "BAD_AUDIO" };
  if (seconds < VOICE_LIMITS.minSampleSeconds) return { ok: false, code: "SAMPLE_TOO_SHORT" };
  if (seconds > VOICE_LIMITS.maxSampleSeconds) return { ok: false, code: "SAMPLE_TOO_LONG" };
  return { ok: true, seconds };
}

/** Browser-side: turn mono float samples into a 16-bit WAV. Lives here so it can be tested with plain Node. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}
