import { recordReport } from "@/lib/beta-guard";

type ReportBody = { sessionId?: string; reason?: string; detail?: string; replyExcerpt?: string; lang?: string };

// The complaint / report channel: a user flags an AI reply or any content. The founder reads these in the cockpit.
export async function POST(request: Request) {
  let body: ReportBody;
  try { body = await request.json() as ReportBody; } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  if (typeof body.reason !== "string" || typeof body.sessionId !== "string") return Response.json({ error: "INVALID_REPORT" }, { status: 400 });
  const result = await recordReport(request, body.sessionId, { reason: body.reason, detail: body.detail, replyExcerpt: body.replyExcerpt, lang: body.lang });
  if (!result.ok) return Response.json({ error: result.code }, { status: result.code === "TOO_MANY_REPORTS" ? 429 : result.code === "SIGN_IN_REQUIRED" ? 401 : 400, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ok: true, id: result.id }, { headers: { "Cache-Control": "no-store" } });
}
