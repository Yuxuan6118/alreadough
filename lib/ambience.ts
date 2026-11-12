// A soft sound under the voice, made live in the browser (no file to download). Filtered noise, the same recipe as the studio.

export type AmbienceKind = "rain" | "ocean" | "off";

export type AmbienceHandle = { setVolume: (volume: number, seconds?: number) => void; stop: (fadeSeconds?: number) => void };

export function startAmbience(kind: AmbienceKind, volume = 0.5): AmbienceHandle | null {
  if (kind === "off" || typeof AudioContext === "undefined") return null;
  const context = new AudioContext();
  const length = context.sampleRate * 4;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = kind === "ocean" ? "lowpass" : "bandpass";
  filter.frequency.value = kind === "ocean" ? 420 : 1500;
  filter.Q.value = kind === "ocean" ? 0.8 : 0.45;
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
  const level = (v: number) => 0.08 * v;
  gain.gain.linearRampToValueAtTime(level(volume), context.currentTime + 2.5);
  return {
    setVolume(next, seconds = 0.4) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(level(next), context.currentTime + seconds);
    },
    stop(fadeSeconds = 2.5) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + fadeSeconds);
      window.setTimeout(() => { try { source.stop(); void context.close(); } catch { /* already closed */ } }, fadeSeconds * 1000 + 200);
    },
  };
}
