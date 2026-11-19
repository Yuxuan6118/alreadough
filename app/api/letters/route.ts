import { listLetters } from "@/lib/mailing";

// Letters from the founder to everyone, newest first. Same for every viewer, so a short shared cache is fine.
export async function GET() {
  try {
    return Response.json({ letters: await listLetters() }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ letters: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
