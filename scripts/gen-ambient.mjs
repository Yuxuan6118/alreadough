// Generates the built-in ambience loops served by /api/audio when (or alongside
// when) the external provider is unavailable. Pure synthesis — no third-party
// audio, no licensing. Output: public/ambient/*.wav (mono, seamless loops).
//
// Run: node scripts/gen-ambient.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "ambient");
const RATE = 18000;

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), 44 + i * 2);
  }
  return buf;
}

// one-pole low-pass, coefficient in [0,1) — higher = darker
function lowpass(input, coef) {
  const out = new Float64Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i += 1) { y += coef * (input[i] - y); out[i] = y; }
  return out;
}
function highpass(input, coef) {
  const lp = lowpass(input, coef);
  const out = new Float64Array(input.length);
  for (let i = 0; i < input.length; i += 1) out[i] = input[i] - lp[i];
  return out;
}
function whiteNoise(n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.random() * 2 - 1;
  return out;
}
function brownNoise(n) {
  const out = new Float64Array(n);
  let b = 0;
  for (let i = 0; i < n; i += 1) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; out[i] = b * 3.5; }
  return out;
}
function pinkNoise(n) {
  // Voss-McCartney approximation
  const out = new Float64Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i += 1) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}
function normalize(sig, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < sig.length; i += 1) max = Math.max(max, Math.abs(sig[i]));
  if (max === 0) return sig;
  const g = peak / max;
  for (let i = 0; i < sig.length; i += 1) sig[i] *= g;
  return sig;
}
// crossfade the tail into the head so the loop is seamless
function seamless(sig, fade) {
  const n = sig.length;
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    sig[i] = sig[i] * t + sig[n - fade + i] * (1 - t);
  }
  return sig.slice(0, n - fade);
}

const presets = {
  // steady textures — short loop is fine
  white:  () => normalize(seamless(lowpass(whiteNoise(RATE * 7), 0.35), RATE * 0.5), 0.7),
  pink:   () => normalize(seamless(pinkNoise(RATE * 7), RATE * 0.5), 0.8),
  brown:  () => normalize(seamless(brownNoise(RATE * 7), RATE * 0.5), 0.85),
  rain:   () => {
    const base = highpass(lowpass(whiteNoise(RATE * 9), 0.5), 0.02);
    // sprinkle brighter droplets
    for (let i = 0; i < base.length; i += 1) if (Math.random() < 0.0012) base[i] += (Math.random() * 2 - 1) * 1.5;
    return normalize(seamless(base, RATE * 0.5), 0.8);
  },
  wind:   () => {
    const n = RATE * 12;
    const noise = lowpass(brownNoise(n), 0.25);
    // slow gusts, whole cycles over the loop
    for (let i = 0; i < n; i += 1) {
      const env = 0.55 + 0.45 * Math.sin((2 * Math.PI * 3 * i) / n) * Math.sin((2 * Math.PI * 7 * i) / n);
      noise[i] *= env;
    }
    return normalize(seamless(noise, RATE * 0.5), 0.8);
  },
  ocean:  () => {
    const n = RATE * 12;
    const noise = lowpass(whiteNoise(n), 0.28);
    for (let i = 0; i < n; i += 1) {
      const swell = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin((2 * Math.PI * 3 * i) / n - Math.PI / 2), 2);
      noise[i] *= swell;
    }
    return normalize(seamless(noise, RATE * 0.5), 0.85);
  },
  fire:   () => {
    const n = RATE * 10;
    const bed = lowpass(brownNoise(n), 0.4);
    for (let i = 0; i < n; i += 1) {
      bed[i] *= 0.6;
      if (Math.random() < 0.002) {
        const len = Math.floor(RATE * (0.01 + Math.random() * 0.04));
        for (let k = 0; k < len && i + k < n; k += 1) bed[i + k] += (Math.random() * 2 - 1) * 1.2 * (1 - k / len);
      }
    }
    return normalize(seamless(bed, RATE * 0.5), 0.8);
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(presets)) {
  const sig = make();
  writeFileSync(join(OUT, `${name}.wav`), wav(sig));
  console.log(`${name}.wav  ${(sig.length / RATE).toFixed(1)}s  ${(sig.length * 2 / 1024).toFixed(0)}KB`);
}
