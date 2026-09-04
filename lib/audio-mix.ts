export type TrackEdit = { fadeIn: number; fadeOut: number };

type MixTrack = { url: string; volume: number; rate?: number; loop: boolean; edit: TrackEdit };
type MixOptions = { durationSeconds: number; voice?: MixTrack; music?: MixTrack; ambience?: MixTrack; generatedAmbience?: "rain" | "brown" | "ocean" };

async function decode(context: BaseAudioContext, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("AUDIO_FETCH_FAILED");
  return context.decodeAudioData(await response.arrayBuffer());
}

function connectTrack(context: OfflineAudioContext, buffer: AudioBuffer, track: MixTrack, duration: number) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = track.rate || 1;
  source.loop = track.loop;
  source.loopStart = 0;
  source.loopEnd = buffer.duration;
  const volume = Math.max(0, Math.min(1, track.volume));
  gain.gain.setValueAtTime(track.edit.fadeIn > 0 ? 0 : volume, 0);
  if (track.edit.fadeIn > 0) gain.gain.linearRampToValueAtTime(volume, Math.min(duration, track.edit.fadeIn));
  if (track.edit.fadeOut > 0) {
    gain.gain.setValueAtTime(volume, Math.max(0, duration - track.edit.fadeOut));
    gain.gain.linearRampToValueAtTime(0, duration);
  }
  source.connect(gain).connect(context.destination);
  source.start(0);
  source.stop(duration);
}

function connectGeneratedAmbience(context: OfflineAudioContext, kind: "rain" | "brown" | "ocean", duration: number, volume: number) {
  const length = context.sampleRate * 4;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    data[index] = kind === "brown" ? brown * 3.5 : white;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer; source.loop = true;
  filter.type = kind === "ocean" ? "lowpass" : "bandpass";
  filter.frequency.value = kind === "rain" ? 1500 : kind === "ocean" ? 420 : 720;
  filter.Q.value = kind === "rain" ? 0.45 : 0.8;
  gain.gain.value = (kind === "brown" ? 0.12 : 0.08) * volume;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(0); source.stop(duration);
}

function wavBlob(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const output = new ArrayBuffer(length);
  const view = new DataView(output);
  const write = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
  write(0, "RIFF"); view.setUint32(4, length - 8, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, length - 44, true);
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let sample = 0; sample < buffer.length; sample += 1) for (let channel = 0; channel < channels; channel += 1) {
    const value = Math.max(-1, Math.min(1, channelData[channel][sample]));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true); offset += 2;
  }
  return new Blob([output], { type: "audio/wav" });
}

export async function renderSubMix(options: MixOptions) {
  const duration = Math.max(5, Math.min(600, options.durationSeconds));
  const sampleRate = 32000;
  const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const tracks = [options.voice, options.music, options.ambience].filter((track): track is MixTrack => Boolean(track?.url));
  const decoded = await Promise.all(tracks.map(async (track) => ({ track, buffer: await decode(context, track.url) })));
  decoded.forEach(({ track, buffer }) => connectTrack(context, buffer, track, duration));
  if (options.generatedAmbience) connectGeneratedAmbience(context, options.generatedAmbience, duration, options.ambience?.volume || 0.28);
  return wavBlob(await context.startRendering());
}
