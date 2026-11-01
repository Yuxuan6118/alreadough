import { betaStatus, touchProfile } from "@/lib/beta-guard";

export async function GET(request: Request) {
  const sessionId = request.headers.get("x-already-session-id") || undefined;
  const status = await betaStatus(request, sessionId);
  if (status.authenticated) await touchProfile(request, sessionId);
  return Response.json(status, { status: status.authenticated ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
