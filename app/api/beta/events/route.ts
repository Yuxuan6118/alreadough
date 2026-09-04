import { recordAnonymousEvent } from "@/lib/beta-guard";

type EventBody = { sessionId?: string; eventType?: string; mode?: string; wishCategory?: string; coachMode?: string; language?: string; feedback?: string; ratingBefore?: number; ratingAfter?: number; durationSeconds?: number };

export async function POST(request: Request) {
  let body: EventBody;
  try { body = await request.json() as EventBody; } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  if (!body.eventType || !body.sessionId) return Response.json({ error: "INVALID_EVENT" }, { status: 400 });
  const recorded = await recordAnonymousEvent(request, body.sessionId, { eventType: body.eventType, mode: body.mode, wishCategory: body.wishCategory, coachMode: body.coachMode, language: body.language, feedback: body.feedback, ratingBefore: body.ratingBefore, ratingAfter: body.ratingAfter, durationSeconds: body.durationSeconds });
  return Response.json({ recorded }, { status: recorded ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
