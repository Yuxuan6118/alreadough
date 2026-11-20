import { desirePreservingSafetyReply } from "@/lib/already-ai";
import { finishMemberRequest, settleBetaRequest, type TokenUsage } from "@/lib/beta-guard";
import { readClientInfo } from "@/lib/client-info";
import { OPENAI_BASE_URL, chatUsage } from "@/lib/openai-base";
import { PERSONA_LIMITS, buildPersonaReminder, buildPersonaSystem, sanitizePersona, type PersonaLang } from "@/lib/persona";
import { beginPersonaRequest, personaError, personaModel } from "@/lib/persona-gate";

// One message from TA, streamed as plain text. Her persona and chat live on her device; the server keeps neither,
// and these turns are not written to the beta conversation log.

type Body = {
  lang?: unknown;
  sessionId?: unknown;
  herName?: unknown;
  persona?: unknown;
  messages?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; } catch { return personaError("INVALID_JSON", "zh", 400); }
  const lang: PersonaLang = body.lang === "en" ? "en" : "zh";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  const persona = sanitizePersona(body.persona);
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages = raw.slice(-PERSONA_LIMITS.history)
    .map((m) => m as { role?: unknown; text?: unknown })
    .filter((m) => (m.role === "her" || m.role === "ta") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role as "her" | "ta", text: (m.text as string).slice(0, 4000) }));
  const last = messages[messages.length - 1];
  if (!sessionId || !persona || !last || last.role !== "her") return personaError("INVALID_REQUEST", lang, 400);

  // A crisis is answered plainly, outside the role.
  const country = readClientInfo(request.headers, (request as Request & { cf?: Record<string, unknown> }).cf).country;
  const herName = typeof body.herName === "string" ? body.herName.slice(0, 40) : "";
  const safety = desirePreservingSafetyReply(last.text, lang, persona.taNameForHer || herName || (lang === "zh" ? "你" : "you"), country);
  if (safety) return new Response(safety, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "x-persona-route": "safety" } });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return personaError("AI_PAUSED", lang, 503);
  const gate = await beginPersonaRequest(request, sessionId);
  if (!gate.ok) return personaError(gate.code, lang, gate.status);

  const recent = messages.slice(-6).map((m) => m.text).join("\n");
  const turn = messages.filter((m) => m.role === "her").length;
  const model = personaModel();
  const startedAt = Date.now();
  const chat = [
    { role: "system", content: buildPersonaSystem(persona, lang, herName, recent, turn) },
    ...messages.map((m) => ({ role: m.role === "her" ? "user" : "assistant", content: m.text })),
  ];
  // the reminder rides on her last message so it sits after the history, closest to the reply
  chat[chat.length - 1] = { role: "user", content: `${last.text}\n\n${buildPersonaReminder(persona, lang)}` };

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: chat, temperature: 0.9, stream: true, stream_options: { include_usage: true }, enable_thinking: false }),
    });
  } catch (error) {
    console.error("persona upstream threw", String(error));
    upstream = new Response(null, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    console.error("persona upstream failed", upstream.status, await upstream.text().catch(() => ""));
    await settleBetaRequest(gate.ticket, null, { success: false, latencyMs: Date.now() - startedAt });
    await finishMemberRequest(gate.ticket, null, false);
    return personaError("AI_REQUEST_FAILED", lang, 502);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let usage: TokenUsage = null;
  let wrote = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const data = line.replace(/^data:\s*/, "").trim();
            if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
            try {
              const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; usage?: unknown };
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) { controller.enqueue(encoder.encode(text)); wrote = true; }
              if (chunk.usage) usage = chatUsage(chunk as Parameters<typeof chatUsage>[0]);
            } catch { /* a partial or keep-alive line */ }
          }
        }
      } catch (error) {
        console.error("persona stream broke", String(error));
      } finally {
        await settleBetaRequest(gate.ticket, usage, { success: wrote, latencyMs: Date.now() - startedAt }).catch(() => undefined);
        await finishMemberRequest(gate.ticket, usage, wrote).catch(() => undefined);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "x-persona-route": "model" } });
}
