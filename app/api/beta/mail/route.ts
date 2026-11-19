import { founderAuthorized } from "@/lib/founder-auth";
import { audienceStats, mailReady, sendLetter } from "@/lib/mailing";
import { normalizeEmail } from "@/lib/member-auth";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!founderAuthorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  return Response.json({ ready: mailReady(), ...(await audienceStats()) }, { headers: noStore });
}

// { audience: "test", testEmail, subject, body } sends one letter to that address.
// { audience: "all", confirmCount, subject, body } sends to every subscribed contact; confirmCount must
// equal the current subscribed count, so a stale page or a slip of the finger cannot mail everyone.
export async function POST(request: Request) {
  if (!founderAuthorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  if (!mailReady()) return Response.json({ error: "MAIL_NOT_CONFIGURED" }, { status: 503, headers: noStore });
  const input = await request.json().catch(() => null) as { audience?: unknown; testEmail?: unknown; confirmCount?: unknown; subject?: unknown; body?: unknown } | null;
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!subject || subject.length > 200 || !body || body.length > 20_000) return Response.json({ error: "INVALID_LETTER" }, { status: 400, headers: noStore });
  if (input?.audience === "test") {
    const testEmail = normalizeEmail(input.testEmail);
    if (!testEmail) return Response.json({ error: "INVALID_EMAIL" }, { status: 400, headers: noStore });
    return Response.json(await sendLetter("test", subject, body, testEmail), { headers: noStore });
  }
  if (input?.audience === "all") {
    const { subscribed } = await audienceStats();
    if (input.confirmCount !== subscribed) return Response.json({ error: "COUNT_MISMATCH", subscribed }, { status: 409, headers: noStore });
    return Response.json(await sendLetter("all", subject, body), { headers: noStore });
  }
  return Response.json({ error: "INVALID_AUDIENCE" }, { status: 400, headers: noStore });
}
