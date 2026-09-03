import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const MAX_PAYLOAD_BYTES = 750_000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function userId() {
  const requestHeaders = await headers();
  return requestHeaders.get("oai-authenticated-user-id");
}

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_spaces (
    user_id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`).run();
}

export async function GET() {
  const id = await userId();
  if (!id) return json({ authenticated: false }, 401);
  await ensureTable();
  const record = await env.DB.prepare("SELECT payload, revision, updated_at AS updatedAt FROM user_spaces WHERE user_id = ?")
    .bind(id)
    .first<{ payload: string; revision: number; updatedAt: string }>();
  if (!record) return json({ authenticated: true, space: null });
  try {
    return json({ authenticated: true, space: JSON.parse(record.payload), revision: record.revision, updatedAt: record.updatedAt });
  } catch {
    return json({ authenticated: true, space: null });
  }
}

export async function PUT(request: Request) {
  const id = await userId();
  if (!id) return json({ authenticated: false }, 401);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || !("space" in body)) return json({ error: "INVALID_SPACE" }, 400);
  const payload = JSON.stringify((body as { space: unknown }).space);
  const updatedAt = new Date().toISOString();
  await ensureTable();
  await env.DB.prepare(`INSERT INTO user_spaces (user_id, payload, revision, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      payload = excluded.payload,
      revision = user_spaces.revision + 1,
      updated_at = excluded.updated_at`)
    .bind(id, payload, updatedAt)
    .run();
  const saved = await env.DB.prepare("SELECT revision FROM user_spaces WHERE user_id = ?").bind(id).first<{ revision: number }>();
  return json({ saved: true, revision: saved?.revision || 1, updatedAt });
}

export async function DELETE() {
  const id = await userId();
  if (!id) return json({ authenticated: false }, 401);
  await ensureTable();
  await env.DB.prepare("DELETE FROM user_spaces WHERE user_id = ?").bind(id).run();
  return json({ deleted: true });
}
