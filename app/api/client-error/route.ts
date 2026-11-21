import { recordClientError } from "@/lib/client-errors";

// A page crashed in someone's browser (app/global-error.tsx reports it here). Kept for the founder cockpit and
// written to the Worker log as an error. Always answers 204: reporting must never fail visibly.
export async function GET(request: Request) {
  try {
    await recordClientError(request);
  } catch (error) {
    console.error("client-error: could not record", String(error).slice(0, 200));
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
