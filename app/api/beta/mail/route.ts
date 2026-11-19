import { founderAuthorized } from "@/lib/founder-auth";
import { audienceStats, deleteLetter, listLetters, mailReady, postLetter, sendLetter } from "@/lib/mailing";
import { normalizeEmail } from "@/lib/member-auth";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!founderAuthorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  return Response.json({ ready: mailReady(), ...(await audienceStats()), letters: await listLetters() }, { headers: noStore });
}

// { audience: "test", testEmail, subject, body } emails one address (never posts to the inbox).
// { audience: "all", email, inbox, confirmCount, subject, body } emails every subscribed contact (when email)
// and/or posts the letter to the in-app inbox (when inbox). confirmCount must equal the current subscribed
// count when emailing, so a stale page or a slip of the finger cannot mail everyone.
export async function POST(request: Request) {
  if (!founderAuthorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  const input = await request.json().catch(() => null) as { audience?: unknown; testEmail?: unknown; confirmCount?: unknown; subject?: unknown; body?: unknown; email?: unknown; inbox?: unknown } | null;
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if ((!subject && !body) || subject.length > 200 || body.length > 20_000) return Response.json({ error: "INVALID_LETTER" }, { status: 400, headers: noStore });
  if (input?.audience === "test") {
    if (!mailReady()) return Response.json({ error: "MAIL_NOT_CONFIGURED" }, { status: 503, headers: noStore });
    const testEmail = normalizeEmail(input.testEmail);
    if (!testEmail) return Response.json({ error: "INVALID_EMAIL" }, { status: 400, headers: noStore });
    return Response.json(await sendLetter("test", subject, body, testEmail), { headers: noStore });
  }
  if (input?.audience === "all") {
    const email = input.email !== false;
    const inbox = input.inbox === true;
    if (!email && !inbox) return Response.json({ error: "NOTHING_TO_SEND" }, { status: 400, headers: noStore });
    if (email) {
      if (!mailReady()) return Response.json({ error: "MAIL_NOT_CONFIGURED" }, { status: 503, headers: noStore });
      const { subscribed } = await audienceStats();
      if (input.confirmCount !== subscribed) return Response.json({ error: "COUNT_MISMATCH", subscribed }, { status: 409, headers: noStore });
    }
    const posted = inbox ? await postLetter(subject, body) : null;
    const mailed = email ? await sendLetter("all", subject, body) : null;
    return Response.json({ recipients: mailed?.recipients ?? 0, delivered: mailed?.delivered ?? 0, failure: mailed?.failure ?? null, posted: Boolean(posted) }, { headers: noStore });
  }
  return Response.json({ error: "INVALID_AUDIENCE" }, { status: 400, headers: noStore });
}

export async function DELETE(request: Request) {
  if (!founderAuthorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("letter") || "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "INVALID_LETTER" }, { status: 400, headers: noStore });
  return Response.json({ deleted: await deleteLetter(id) }, { headers: noStore });
}
