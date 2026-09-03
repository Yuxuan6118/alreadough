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
  category?: string;
  tags?: Array<{ name?: string } | string>;
  genres?: string[];
};

const queryMap: Record<string, string> = {
  "下雨": "gentle rain ambience",
  "雨声": "gentle rain ambience",
  "海洋": "ocean waves ambience",
  "海浪": "ocean waves ambience",
  "火": "fireplace crackling ambience",
  "火柴": "match burning fire ambience",
  "壁炉": "fireplace crackling ambience",
  "森林": "forest birds ambience",
  "咖啡店": "quiet coffee shop ambience",
  "风声": "soft wind ambience",
  "溪流": "gentle stream ambience",
};

const nonAmbientPattern = /\b(speech|spoken|speaker|voice|vocal|talk|talking|dialog(?:ue)?|conversation|interview|podcast|narrat(?:ion|or)|reading|audiobook|lecture|sermon|announcement|radio|chant|sing(?:ing|er)?|song|music|rap|whisper(?:ing)?|shout(?:ing)?|scream(?:ing)?|laugh(?:ing)?|cry(?:ing)?|man|woman|male|female|child|baby|crowd|fire\s?truck|siren)\b|说话|讲话|人声|对话|访谈|朗读|旁白|播报|演讲|歌声|唱歌|喊叫|尖叫|哭声|笑声|男声|女声|声優|話し声|会話|朗読|歌唱|スピーチ/i;
const obviousDatasetPattern = /\bLL-Q\d+|\bspeaker\s*:|\brecorder\s*:|common voice|speech corpus|language lesson/i;

function searchableText(item: OpenverseAudio) {
  const tags = (item.tags || []).map((tag) => typeof tag === "string" ? tag : tag.name || "").join(" ");
  return [item.title, item.creator, item.category, ...(item.genres || []), tags].filter(Boolean).join(" ");
}

function isAmbientOnly(item: OpenverseAudio) {
  const metadata = searchableText(item);
  if (nonAmbientPattern.test(metadata) || obviousDatasetPattern.test(metadata)) return false;
  if (item.category && /speech|music/i.test(item.category)) return false;
  return !item.duration || item.duration >= 8;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || "rain";
  const q = queryMap[raw] || raw;
  const params = new URLSearchParams({ q, license: "cc0,by", page_size: "20", mature: "false" });
  try {
    const response = await fetch(`https://api.openverse.org/v1/audio/?${params}`, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error("Openverse unavailable");
    const data = await response.json() as { results?: OpenverseAudio[] };
    const results = (data.results || []).filter((item) => item.url && (item.license === "cc0" || item.license === "by") && isAmbientOnly(item)).slice(0, 18).map((item) => ({
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
