import { blindResults, recordBlindVotes } from "@/lib/blind-votes";

// Public blind tests (/test): GET returns everyone's votes so far, POST stores one visitor's picks.
// No sign-in; votes are anonymous (see migrations/0005_blind_votes.sql).

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const results = await blindResults(new URL(request.url).searchParams.get("test") || "");
  return results ? json(results) : json({ error: "UNKNOWN_TEST" }, 404);
}

export async function POST(request: Request) {
  let body: { testId?: unknown; voter?: unknown; picks?: unknown };
  try {
    const text = await request.text();
    if (text.length > 4000) return json({ error: "TOO_LARGE" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const saved = await recordBlindVotes(body ?? {}, address);
  if (!saved.ok) return json({ error: saved.error }, saved.error === "TOO_MANY" ? 429 : 400);
  const results = await blindResults(String(body.testId));
  return json({ saved: saved.saved, results });
}
