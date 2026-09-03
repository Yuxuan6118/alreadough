import { betaStatus } from "@/lib/beta-guard";

export async function GET(request: Request) {
  const sessionId = request.headers.get("x-already-session-id") || undefined;
  const status = await betaStatus(request, sessionId);
  return Response.json(status, { status: status.authenticated ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
