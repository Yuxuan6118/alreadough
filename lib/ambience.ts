// A soft sound under the voice.
// rain, ocean and fire are real CC0 field recordings, streamed straight from Freesound's public preview files
// (nothing is stored on our site). brown is a low, even rumble drawn in the browser; it covers a soft voice well.

export type AmbienceKind = "rain" | "ocean" | "fire" | "brown" | "off";
export type SoundKind = Exclude<AmbienceKind, "off">;
export type AmbienceHandle = { setVolume: (volume: number, seconds?: number) => void; stop: (fadeSeconds?: number) => void };

/** CC0 recordings on Freesound (pages: /people/Garuda1982/sounds/757276, /people/YevgVerh/sounds/827530, /people/silencyo/sounds/81801). */
export const AMBIENCE_STREAMS: Record<Exclude<SoundKind, "brown">, string> = {
  rain: "https://cdn.freesound.org/previews/757/757276_2061858-hq.mp3",
  ocean: "https://cdn.freesound.org/previews/827/827530_2718606-hq.mp3",
  fire: "https://cdn.freesound.org/previews/81/81801_280284-hq.mp3",
};

/** How loud each kind sits at volume 1, so switching between them keeps a similar level. */
export const AMBIENCE_LEVEL: Record<SoundKind, number> = { rain: 1, ocean: 0.45, fire: 1, brown: 0.18 };

const BLEND_SECONDS = 3;
const BROWN_SECONDS = 24;

function brownChannel(rate: number, seed: number) {
  const total = Math.floor(rate * (BROWN_SECONDS + BLEND_SECONDS));
  const data = new Float32Array(total);
  let state = seed >>> 0;
  let last = 0;
  for (let i = 0; i < total; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    last = (last + 0.02 * ((state / 4294967296) * 2 - 1)) / 1.02;
    data[i] = last * 3.4;
  }
  return data;
}

/** Blend the tail into the start and cut it off, so the drawn brown noise loops seamlessly. */
function brownBuffer(context: BaseAudioContext) {
  const channels = [brownChannel(context.sampleRate, 7), brownChannel(context.sampleRate, 19)];
  const total = channels[0].length;
  const blend = Math.floor(context.sampleRate * BLEND_SECONDS);
  const loop = total - blend;
  const buffer = context.createBuffer(2, loop, context.sampleRate);
  channels.forEach((data, index) => {
    const out = new Float32Array(loop);
    out.set(data.subarray(0, loop));
    for (let i = 0; i < blend; i++) {
      const w = i / blend;
      out[i] = data[i] * Math.sin(w * Math.PI / 2) + data[loop + i] * Math.cos(w * Math.PI / 2);
    }
    buffer.copyToChannel(out, index);
  });
  return buffer;
}

/** A looping brown-noise source; connect `output` to your own gain. */
export function brownSource(context: BaseAudioContext) {
  const source = context.createBufferSource();
  source.buffer = brownBuffer(context);
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 520;
  source.connect(filter);
  return { source, output: filter as AudioNode };
}

/** Start an ambience right away; it fades in once the stream can play. */
export function startAmbience(kind: AmbienceKind, volume = 0.5): AmbienceHandle | null {
  if (kind === "off" || typeof AudioContext === "undefined") return null;
  const context = new AudioContext();
  void context.resume();
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const level = (v: number) => AMBIENCE_LEVEL[kind] * v;
  let stopSource = () => undefined as void;

  if (kind === "brown") {
    const { source, output } = brownSource(context);
    output.connect(gain);
    source.start();
    stopSource = () => { try { source.stop(); } catch { /* already stopped */ } };
  } else {
    const element = new Audio();
    element.crossOrigin = "anonymous";
    element.loop = true;
    element.preload = "auto";
    element.src = AMBIENCE_STREAMS[kind];
    context.createMediaElementSource(element).connect(gain);
    void element.play().catch(() => undefined);
    stopSource = () => { element.pause(); element.removeAttribute("src"); element.load(); };
  }
  gain.gain.setValueAtTime(0, context.currentTime);
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
      window.setTimeout(() => { stopSource(); void context.close().catch(() => undefined); }, fadeSeconds * 1000 + 200);
    },
  };
}
