import { NextRequest, NextResponse } from "next/server";

type OpenverseAudio = {
  id: string;
  title: string;
  url: string;
  foreign_landing_url: string;
  creator?: string;
  license: string;
  license_url?: string;
  duration?: number;
  provider?: string;
};

const queryMap: Record<string, string> = {
  "下雨": "gentle rain ambience",
  "雨声": "gentle rain ambience",
  "海洋": "ocean waves ambience",
  "海浪": "ocean waves ambience",
  "火柴": "match burning fire ambience",
  "壁炉": "fireplace crackling ambience",
  "森林": "forest birds ambience",
  "咖啡店": "quiet coffee shop ambience",
  "风声": "soft wind ambience",
  "溪流": "gentle stream ambience",
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || "rain";
  const q = queryMap[raw] || raw;
  const params = new URLSearchParams({ q, license: "cc0,by", page_size: "18", mature: "false" });
  try {
    const response = await fetch(`https://api.openverse.org/v1/audio/?${params}`, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error("Openverse unavailable");
    const data = await response.json() as { results?: OpenverseAudio[] };
    const results = (data.results || []).filter((item) => item.url && (item.license === "cc0" || item.license === "by")).map((item) => ({
      id: item.id,
      title: item.title || raw,
      audio: item.url,
      source: item.foreign_landing_url,
      creator: item.creator || "Openverse contributor",
      license: item.license === "cc0" ? "CC0" : "CC BY",
      licenseUrl: item.license_url || "",
      duration: item.duration || 0,
      provider: item.provider || "Openverse",
    }));
    return NextResponse.json({ results, query: q }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ results: [], error: "AUDIO_SEARCH_UNAVAILABLE" }, { status: 502 });
  }
}
