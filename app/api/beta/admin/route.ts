import { listPayments } from "@/lib/payments-db";
import { founderAuthorized as authorized } from "@/lib/founder-auth";
import { founderOverview } from "@/lib/founder-overview";
import { founderSnapshot, listConversations, listProfiles, listReports, listUserChats, setBetaEnabled, setReportStatus } from "@/lib/beta-guard";

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  // Beta conversation samples as JSONL (one turn per line, with context and 👍/👎) for prompt tuning and evals.
  const view = new URL(request.url).searchParams.get("view");
  // Readable views for the founder chat page: full threads per user, and the rated reply samples.
  if (view === "chats") return Response.json({ users: await listUserChats() }, { headers: { "Cache-Control": "no-store" } });
  if (view === "overview") return Response.json(await founderOverview(), { headers: { "Cache-Control": "no-store" } });
  if (view === "payments") return Response.json(await listPayments(), { headers: { "Cache-Control": "no-store" } });
  if (view === "reports") return Response.json({ reports: await listReports() }, { headers: { "Cache-Control": "no-store" } });
  if (view === "profiles") return Response.json({ profiles: await listProfiles() }, { headers: { "Cache-Control": "no-store" } });
  if (view === "samples") return Response.json({ samples: await listConversations(300) }, { headers: { "Cache-Control": "no-store" } });
  if (new URL(request.url).searchParams.get("export") === "conversations") {
    const rows = await listConversations(2000);
    return new Response(rows.map((row: object) => JSON.stringify(row)).join("\n"), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return Response.json(await founderSnapshot(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  const body = await request.json().catch(() => null) as { enabled?: unknown; reportId?: unknown; status?: unknown } | null;
  if (typeof body?.reportId === "string" && (body.status === "handled" || body.status === "new")) {
    return Response.json({ updated: await setReportStatus(body.reportId, body.status) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (typeof body?.enabled !== "boolean") return Response.json({ error: "INVALID_SETTING" }, { status: 400 });
  await setBetaEnabled(body.enabled);
  return Response.json(await founderSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
