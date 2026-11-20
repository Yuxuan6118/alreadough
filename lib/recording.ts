// Browser-side: turn a microphone recording into the 24 kHz mono WAV the voice service wants.

import { encodeWav } from "./voice-limits";

/** Decode any recording or audio file to mono 24 kHz WAV; `maxSeconds` keeps only the start of a long file. */
export async function recordingToWav(blob: Blob, maxSeconds = Infinity): Promise<{ wav: Uint8Array; seconds: number }> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const rate = 24000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(Math.min(decoded.duration, maxSeconds) * rate)), rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { wav: encodeWav(rendered.getChannelData(0), rate), seconds: rendered.duration };
  } finally {
    void context.close();
  }
}

export function toDataUri(wav: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < wav.length; i += chunk) binary += String.fromCharCode(...wav.subarray(i, i + chunk));
  return `data:audio/wav;base64,${btoa(binary)}`;
}
