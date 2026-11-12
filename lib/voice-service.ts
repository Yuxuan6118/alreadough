// The cloud voice (Alibaba Model Studio). Server only. One model for every voice so a clone and a default voice sound alike.

export const VOICE_MODEL = process.env.VOICE_MODEL || "qwen-audio-3.1-tts-flash";
/** the voice used when she has not recorded her own */
export const DEFAULT_VOICE = process.env.VOICE_DEFAULT || "longanhuan_v3.1";

function endpoint() {
  // OPENAI_BASE_URL points at the same account as the chat model, e.g. https://dashscope.aliyuncs.com/compatible-mode/v1
  const origin = new URL(process.env.OPENAI_BASE_URL || "https://dashscope.aliyuncs.com").origin;
  return `${origin}/api/v1/services/audio/tts`;
}

async function call(path: string, body: unknown) {
  const response = await fetch(`${endpoint()}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { output?: Record<string, unknown>; code?: string; message?: string; usage?: unknown };
  return { ok: response.ok, status: response.status, data };
}

export async function createVoice(dataUri: string): Promise<{ ok: true; voiceId: string } | { ok: false; reason: string }> {
  const created = await call("customization", { model: "voice-enrollment", input: { action: "create_voice", target_model: VOICE_MODEL, prefix: "already", audio: dataUri } });
  const voiceId = created.data.output?.voice_id;
  if (!created.ok || typeof voiceId !== "string") return { ok: false, reason: created.data.message || `create failed (${created.status})` };
  // the provider reviews the sample; it normally takes a few seconds
  for (let attempt = 0; attempt < 12; attempt++) {
    const queried = await call("customization", { model: "voice-enrollment", input: { action: "query_voice", voice_id: voiceId } });
    const status = queried.data.output?.status;
    if (status === "OK") return { ok: true, voiceId };
    if (status === "UNDEPLOYED") { await deleteVoice(voiceId); return { ok: false, reason: "The sample was not accepted." }; }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  await deleteVoice(voiceId);
  return { ok: false, reason: "The voice took too long to be ready." };
}

export async function deleteVoice(voiceId: string): Promise<boolean> {
  const deleted = await call("customization", { model: "voice-enrollment", input: { action: "delete_voice", voice_id: voiceId } });
  // a voice that is already gone counts as deleted
  return deleted.ok || deleted.data.code === "BadRequest.ResourceNotExist";
}

export async function synthesize(text: string, voice: string): Promise<{ ok: true; audio: ArrayBuffer; contentType: string } | { ok: false; reason: string }> {
  const result = await call("SpeechSynthesizer", { model: VOICE_MODEL, input: { text, voice, format: "mp3", sample_rate: 24000 } });
  const audio = result.data.output?.audio as { url?: string } | undefined;
  if (!result.ok || !audio?.url) return { ok: false, reason: result.data.message || `synthesis failed (${result.status})` };
  const file = await fetch(audio.url);
  if (!file.ok) return { ok: false, reason: "The audio could not be fetched." };
  return { ok: true, audio: await file.arrayBuffer(), contentType: file.headers.get("content-type") || "audio/mpeg" };
}
