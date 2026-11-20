import { env } from "cloudflare:workers";
import { deleteBetaRecords } from "@/lib/beta-guard";
import { sha256 } from "@/lib/member-auth";
import { requestOwner } from "@/lib/request-owner";
import { deleteAllVoiceData } from "@/lib/voice-db";

const MAX_PAYLOAD_BYTES = 750_000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * The space belongs to the signed-in account. A device that synced before accounts existed brings its space
 * along the first time it signs in; the device row is then removed, so the old device id opens nothing.
 * If the account already has a space, the device's copy is still on that device and merges in on its next save.
 */
async function spaceOwner(request: Request) {
  const owner = await requestOwner(request);
  if (!owner) return null;
  if (owner.accountId && owner.deviceKey) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user_spaces (user_id, payload, revision, updated_at) SELECT ?, payload, revision, updated_at FROM user_spaces WHERE user_id = ? ON CONFLICT(user_id) DO NOTHING").bind(owner.key, owner.deviceKey),
      env.DB.prepare("DELETE FROM user_spaces WHERE user_id = ?").bind(owner.deviceKey),
    ]);
  }
  // A short tag of whose space this is, so a device can tell when its last synced copy belonged to someone else.
  return { ...owner, tag: (await sha256(`space:${owner.key}`)).slice(0, 16) };
}

export async function GET(request: Request) {
  const owner = await spaceOwner(request);
  if (!owner) return json({ authenticated: false }, 401);
  const id = owner.key;
  const record = await env.DB.prepare("SELECT payload, revision, updated_at AS updatedAt FROM user_spaces WHERE user_id = ?")
    .bind(id)
    .first<{ payload: string; revision: number; updatedAt: string }>();
  if (!record) return json({ authenticated: true, owner: owner.tag, space: null });
  try {
    return json({ authenticated: true, owner: owner.tag, space: JSON.parse(record.payload), revision: record.revision, updatedAt: record.updatedAt });
  } catch {
    return json({ authenticated: true, owner: owner.tag, space: null });
  }
}

export async function PUT(request: Request) {
  const owner = await spaceOwner(request);
  if (!owner) return json({ authenticated: false }, 401);
  const id = owner.key;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || !("space" in body)) return json({ error: "INVALID_SPACE" }, 400);
  const payload = JSON.stringify((body as { space: unknown }).space);
  const baseRevision = (body as { baseRevision?: unknown }).baseRevision;
  const updatedAt = new Date().toISOString();
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
  return json({ saved: true, owner: owner.tag, revision: saved?.revision || 1, updatedAt });
}

export async function DELETE(request: Request) {
  const owner = await spaceOwner(request);
  if (!owner) return json({ authenticated: false }, 401);
  const id = owner.key;
  await env.DB.prepare("DELETE FROM user_spaces WHERE user_id = ?").bind(id).run();
  // The synced space is only part of what we keep: chats, profile, events and reports go too.
  await deleteBetaRecords(request);
  // her cloned voice is deleted at the provider too; if that fails we say so instead of claiming everything is gone
  const voiceDeleted = await deleteAllVoiceData(id).catch(() => false);
  return json({ deleted: true, voiceDeleted });
}
