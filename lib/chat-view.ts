// Pure helpers for the founder chat viewer. No Cloudflare imports so they can be unit-tested with plain Node.

export type ViewMessage = { role: "user" | "ai"; text: string };
export type ViewConversation = { id: string; title: string; createdAt: string; messages: ViewMessage[] };
export type ViewUser = { label: string; updatedAt: string; messageCount: number; conversations: ViewConversation[] };

function messagesOf(value: unknown): ViewMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { role, text } = item as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "ai") || typeof text !== "string" || !text.trim()) return [];
    return [{ role, text: text.slice(0, 4000) } as ViewMessage];
  });
}

/**
 * Turn one synced "space" payload into readable conversations.
 * Only chat turns are returned: never the desire card, nickname, beliefs, stories, or media.
 */
export function extractConversations(payload: string): ViewConversation[] {
  let space: Record<string, unknown>;
  try { space = JSON.parse(payload) as Record<string, unknown>; } catch { return []; }
  if (!space || typeof space !== "object") return [];
  const out: ViewConversation[] = [];
  const current = messagesOf(space.messages);
  if (current.length) out.push({ id: typeof space.conversationId === "string" && space.conversationId ? space.conversationId : "current", title: "当前对话", createdAt: "", messages: current });
  if (Array.isArray(space.conversationArchive)) {
    for (const item of space.conversationArchive.slice(0, 30)) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { id?: unknown; title?: unknown; createdAt?: unknown; messages?: unknown };
      const messages = messagesOf(entry.messages);
      if (!messages.length) continue;
      out.push({ id: String(entry.id ?? out.length), title: typeof entry.title === "string" ? entry.title.slice(0, 60) : "对话", createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "", messages });
    }
  }
  return out;
}
