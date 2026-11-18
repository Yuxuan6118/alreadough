import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { deleteBetaRecords, requestIdentity } from "@/lib/beta-guard";
import { deleteAllVoiceData } from "@/lib/voice-db";

const MAX_PAYLOAD_BYTES = 750_000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function userId() {
  const requestHeaders = await headers();
  const platformId = requestHeaders.get("oai-authenticated-user-id");
  if (platformId) return platformId;
  // Account-free beta: the browser's persisted device session id owns the space.
  const device = requestHeaders.get("x-already-session-id")?.trim();
  return device ? `device:${device.slice(0, 128)}` : null;
}

let tableReady: Promise<unknown> | null = null;

function ensureTable() {
  if (tableReady) return tableReady;
  tableReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_spaces (
    user_id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`).run().catch((error) => {
    tableReady = null; // allow the next request to retry
    throw error;
  });
  return tableReady;
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
  const baseRevision = (body as { baseRevision?: unknown }).baseRevision;
  const updatedAt = new Date().toISOString();
  await ensureTable();
  if (typeof baseRevision === "number" && Number.isInteger(baseRevision) && baseRevision >= 0) {
    // Only save on top of the copy this device last saw; a device holding stale data must reload first instead of overwriting newer work.
    const result = baseRevision === 0
      ? await env.DB.prepare("INSERT INTO user_spaces (user_id, payload, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING").bind(id, payload, updatedAt).run()
      : await env.DB.prepare("UPDATE user_spaces SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?").bind(payload, updatedAt, id, baseRevision).run();
    if (!result.meta.changes) {
      const current = await env.DB.prepare("SELECT revision FROM user_spaces WHERE user_id = ?").bind(id).first<{ revision: number }>();
      return json({ error: "STALE_REVISION", revision: current?.revision || 0 }, 409);
    }
  } else {
    await env.DB.prepare(`INSERT INTO user_spaces (user_id, payload, revision, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      payload = excluded.payload,
      revision = user_spaces.revision + 1,
      updated_at = excluded.updated_at`)
    .bind(id, payload, updatedAt)
    .run();
  }
  const saved = await env.DB.prepare("SELECT revision FROM user_spaces WHERE user_id = ?").bind(id).first<{ revision: number }>();
  return json({ saved: true, revision: saved?.revision || 1, updatedAt });
}

export async function DELETE(request: Request) {
  const id = await userId();
  if (!id) return json({ authenticated: false }, 401);
  await ensureTable();
  await env.DB.prepare("DELETE FROM user_spaces WHERE user_id = ?").bind(id).run();
  // The synced space is only part of what we keep: chats, profile, events and reports go too.
  await deleteBetaRecords(request);
  // her cloned voice is deleted at the provider too; if that fails we say so instead of claiming everything is gone
  const deviceUser = requestIdentity(request);
  const voiceDeleted = deviceUser ? await deleteAllVoiceData(deviceUser).catch(() => false) : true;
  return json({ deleted: true, voiceDeleted });
}
