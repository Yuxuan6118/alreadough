import { readClientInfo } from "@/lib/client-info";

// Only the two-letter country of the visitor's IP, so the home greeting can pick holidays for that country.
export async function GET(request: Request) {
  const country = readClientInfo(request.headers).country;
  return Response.json({ country }, { headers: { "Cache-Control": "no-store" } });
}
