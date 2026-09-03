import { NextRequest, NextResponse } from "next/server";

type OpenverseAudio = {
  id: string; title: string; url: string; foreign_landing_url: string;
  creator?: string; license: string; license_url?: string; duration?: number;
  provider?: string; category?: string; tags?: Array<{ name?: string } | string>; genres?: string[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

const queryMap: Record<string, string> = {
  "下雨": "gentle rain field recording", "雨声": "gentle rain field recording",
  "雷雨": "thunderstorm field recording", "海洋": "ocean waves field recording",
  "海浪": "ocean waves field recording", "火": "fireplace crackling field recording",
  "火柴": "match ignition field recording", "壁炉": "fireplace crackling field recording",
  "篝火": "campfire crackling field recording", "森林": "forest nature field recording",
  "咖啡店": "quiet cafe room ambience", "风声": "soft wind field recording",
  "溪流": "gentle stream field recording", "鸟叫": "wild birds field recording",
  "鸟鸣": "wild birds field recording", "白噪音": "white noise", "棕噪音": "brown noise",
};

const chinesePattern = /[\u3400-\u9fff]/;
const nonAmbientPattern = /\b(speech|spoken|speaker|voice|vocal|talk|talking|dialog(?:ue)?|conversation|interview|podcast|narrat(?:ion|or)|reading|audiobook|lecture|sermon|announcement|radio|chant|sing(?:ing|er)?|song|music|melody|rap|whisper(?:ing)?|shout(?:ing)?|scream(?:ing)?|laugh(?:ing)?|cry(?:ing)?|person|people|peoples|man|woman|male|female|child|baby|crowd|fire\s?truck|siren|alarm|radar|detection|weapon|gun|gunfire|explosion|vehicle|engine|traffic|car|truck|motorcycle|boat|ship|yacht|language|pronunciation|phoneme|telephone)\b|说话|讲话|人声|对话|访谈|朗读|旁白|播报|演讲|歌声|唱歌|喊叫|尖叫|哭声|笑声|男声|女声|语音|语料|发音|人群|警报|雷达|武器|枪声|爆炸|车辆|引擎|交通|汽车|轮船|游艇|声優|話し声|会話|朗読|歌唱|スピーチ|ボイス/i;
const obviousDatasetPattern = /\bLL[-_ ]?Q\d+|\bspeaker\s*:|\brecorder\s*:|common voice|speech corpus|language lesson|dataset|sentence|utterance/i;
const environmentalPattern = /\b(rain|rainfall|raindrop|storm|thunder|ocean|sea|wave|surf|beach|river|stream|creek|brook|waterfall|water|wind|breeze|forest|woodland|woods|bird|cricket|insect|frog|fireplace|campfire|bonfire|fire|flame|burning|crackle|nature|ambience|ambient|field recording|room tone|white noise|brown noise|pink noise|fan|air conditioner|cafe|coffee shop)\b|雨声|下雨|雷雨|雷声|海浪|浪声|海洋|溪流|流水|瀑布|风声|森林|鸟鸣|虫鸣|蛙鸣|壁炉|柴火|篝火|燃烧|火焰|环境音|自然声|白噪音|棕噪音|粉红噪音/i;

function searchableText(item: OpenverseAudio) {
  const tags = (item.tags || []).map((tag) => typeof tag === "string" ? tag : tag.name || "").join(" ");
  return [item.title, item.creator, item.category, ...(item.genres || []), tags].filter(Boolean).join(" ");
}

function isAmbientOnly(item: OpenverseAudio) {
  const metadata = searchableText(item);
  if (nonAmbientPattern.test(metadata) || obviousDatasetPattern.test(metadata)) return false;
  if (item.category && /speech|music/i.test(item.category)) return false;
  if (!environmentalPattern.test(metadata)) return false;
  return !item.duration || item.duration >= 8;
}

function responseText(data: OpenAIResponse) {
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text).join("") || "";
}

async function translateAmbientQuery(raw: string) {
  if (!chinesePattern.test(raw)) return [raw];
  if (queryMap[raw]) return [queryMap[raw]];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ["nature ambience field recording"];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-5.6-luna",
        instructions: "Translate the Chinese search for pure environmental audio into 1 to 3 short English search queries. If it contains multiple sound sources, separate them into individual queries so each source is searched independently. Describe only sound sources. Never add speech, voices, people, songs, music, podcasts, vehicles, or ASMR. Return JSON only.",
        input: raw,
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 60,
        text: { verbosity: "low", format: { type: "json_schema", name: "ambient_sound_query", strict: true, schema: {
            type: "object", properties: { queries: { type: "array", items: { type: "string", minLength: 2, maxLength: 80 }, minItems: 1, maxItems: 3 } }, required: ["queries"], additionalProperties: false,
        } } },
      }),
    });
    if (!response.ok) throw new Error("translation failed");
    const data = await response.json() as OpenAIResponse;
    const parsed = JSON.parse(responseText(data)) as { queries?: string[] };
    const queries = (parsed.queries || []).map((query) => query.trim().slice(0, 80)).filter(Boolean).slice(0, 3);
    return queries.length ? queries : ["nature ambience field recording"];
  } catch {
    return ["nature ambience field recording"];
  }
}

async function searchOpenverse(query: string) {
  const params = new URLSearchParams({ q: query, license: "cc0,by", page_size: "20", mature: "false" });
  const response = await fetch(`https://api.openverse.org/v1/audio/?${params}`, {
    cache: "no-store",
    headers: { "User-Agent": "AlreaDough ambient sound search/1.0" },
  });
  if (!response.ok) throw new Error("Openverse unavailable");
  const data = await response.json() as { results?: OpenverseAudio[] };
  return data.results || [];
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || "rain";
  const translatedQueries = await translateAmbientQuery(raw);
  const translated = translatedQueries.join(" · ");
  const searched = chinesePattern.test(raw) ? [raw, ...translatedQueries] : translatedQueries;

  const batches = await Promise.allSettled(searched.map(searchOpenverse));
  if (batches.every((batch) => batch.status === "rejected")) {
    return NextResponse.json({ results: [], queries: { original: raw, translated, searched }, error: "AUDIO_SEARCH_UNAVAILABLE" }, {
      status: 502, headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" },
    });
  }

  const unique = new Map<string, OpenverseAudio>();
  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    const valid = batch.value.filter((item) => item.url && (item.license === "cc0" || item.license === "by") && isAmbientOnly(item)).slice(0, 6);
    for (const item of valid) unique.set(item.id || item.url, item);
  }
  const results = [...unique.values()].slice(0, 18).map((item) => ({
    id: item.id, title: item.title || raw, audio: item.url, source: item.foreign_landing_url,
    creator: item.creator || "Openverse contributor", license: item.license === "cc0" ? "CC0" : "CC BY",
    licenseUrl: item.license_url || "", duration: item.duration || 0, provider: item.provider || "Openverse",
  }));
  return NextResponse.json({ results, queries: { original: raw, translated, searched }, filter: "environment-only-v3" }, {
    headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" },
  });
}
