import { OPENAI_BASE_URL, chatContent, type ChatCompletion } from "@/lib/openai-base";
import { NextRequest, NextResponse } from "next/server";

type OpenverseAudio = {
  id: string; title: string; url: string; foreign_landing_url: string;
  creator?: string; license: string; license_url?: string; duration?: number;
  provider?: string; category?: string; tags?: Array<{ name?: string } | string>; genres?: string[];
};

// Common Chinese searches: the English term plus related words, so one search reaches more recordings.
const queryMap: Record<string, string[]> = {
  "下雨": ["rain", "rain on leaves", "rain on roof"], "雨声": ["rain", "rain on leaves", "rain on roof"], "雨": ["rain", "rain on leaves", "rain on roof"],
  "雷雨": ["thunderstorm", "thunder rain", "storm"], "海洋": ["ocean waves", "sea shore", "surf"],
  "海浪": ["ocean waves", "sea shore", "surf"], "海": ["ocean waves", "sea shore", "surf"],
  "火": ["fireplace", "campfire", "fire crackling"], "壁炉": ["fireplace", "fire crackling", "wood fire"],
  "篝火": ["campfire", "bonfire", "fire crackling"], "火柴": ["match strike", "match ignition"],
  "森林": ["forest ambience", "woodland birds", "forest"], "咖啡店": ["cafe ambience", "coffee shop", "restaurant room tone"],
  "风": ["wind", "soft wind", "breeze"], "风声": ["wind", "soft wind", "breeze"],
  "溪流": ["stream", "creek", "brook water"], "河": ["river", "stream", "flowing water"],
  "鸟叫": ["birds", "birdsong", "dawn chorus"], "鸟鸣": ["birds", "birdsong", "dawn chorus"],
  "虫鸣": ["crickets", "insects night", "cicadas"], "蛙": ["frogs", "frog chorus", "pond night"],
  "白噪音": ["white noise"], "粉红噪音": ["pink noise"], "棕噪音": ["brown noise"],
};

const chinesePattern = /[\u3400-\u9fff]/;
const nonAmbientPattern = /\b(speech|spoken|speaker|voice|vocal|talk|talking|dialog(?:ue)?|conversation|interview|podcast|narrat(?:ion|or)|reading|audiobook|lecture|sermon|announcement|radio|chant|sing(?:ing|er)?|song|music|melody|rap|whisper(?:ing)?|shout(?:ing)?|scream(?:ing)?|laugh(?:ing)?|cry(?:ing)?|person|people|peoples|man|woman|male|female|child|baby|crowd|fire\s?truck|siren|alarm|radar|detection|weapon|gun|gunfire|explosion|vehicle|engine|traffic|car|truck|motorcycle|boat|ship|yacht|language|pronunciation|phoneme|telephone)\b|说话|讲话|人声|对话|访谈|朗读|旁白|播报|演讲|歌声|唱歌|喊叫|尖叫|哭声|笑声|男声|女声|语音|语料|发音|人群|警报|雷达|武器|枪声|爆炸|车辆|引擎|交通|汽车|轮船|游艇|声優|話し声|会話|朗読|歌唱|スピーチ|ボイス/i;
const obviousDatasetPattern = /\bLL[-_ ]?Q\d+|\bspeaker\s*:|\brecorder\s*:|common voice|speech corpus|language lesson|dataset|sentence|utterance/i;
const environmentalPattern = /\b(rain|rainfall|raindrop|storm|thunder|ocean|sea|wave|surf|beach|river|stream|creek|brook|waterfall|water|wind|breeze|forest|woodland|woods|bird|cricket|insect|frog|fireplace|campfire|bonfire|fire|flame|burning|crackle|crackling|cicadas?|crickets|frogs|birds|birdsong|waves|streams|match|nature|ambience|ambient|field recording|room tone|white noise|brown noise|pink noise|fan|air conditioner|cafe|coffee shop)\b|雨声|下雨|雷雨|雷声|海浪|浪声|海洋|溪流|流水|瀑布|风声|森林|鸟鸣|虫鸣|蛙鸣|壁炉|柴火|篝火|燃烧|火焰|环境音|自然声|白噪音|棕噪音|粉红噪音/i;

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

async function translateAmbientQuery(raw: string) {
  if (!chinesePattern.test(raw)) return [raw];
  if (queryMap[raw]) return queryMap[raw];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ["nature ambience field recording"];

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_CHAT_MODEL || "deepseek-v4-flash-0731",
        messages: [
          { role: "system", content: 'Turn the Chinese search for an environmental sound into 2 to 4 short English search queries for a sound-effects library: first the plainest English name of the sound (1 to 2 words), then closely related words a sound library would use (for example 火 -> fireplace, campfire, fire crackling). If it names several sound sources, give each its own query. Describe only sound sources. Never add speech, voices, people, songs, music, podcasts, vehicles, or ASMR. Return only JSON: {"queries": string[]}.' },
          { role: "user", content: raw },
        ],
        response_format: { type: "json_object" },
        enable_thinking: false,
        max_tokens: 120,
      }),
    });
    if (!response.ok) throw new Error("translation failed");
    const data = await response.json() as ChatCompletion;
    const parsed = JSON.parse(chatContent(data).trim().replace(/^```(?:json)?\s*|\s*```$/g, "") || "{}") as { queries?: string[] };
    const queries = (parsed.queries || []).map((query) => query.trim().slice(0, 80)).filter(Boolean).slice(0, 4);
    return queries.length ? queries : ["nature ambience field recording"];
  } catch {
    return ["nature ambience field recording"];
  }
}

async function searchOpenverse(query: string) {
  const params = new URLSearchParams({ q: query, license: "cc0,by", page_size: "20", mature: "false" });
  const response = await fetch(`https://api.openverse.org/v1/audio/?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(9_000),
    headers: { "User-Agent": "AlreaDough ambient sound search/1.0" },
  });
  if (!response.ok) throw new Error("Openverse unavailable");
  const data = await response.json() as { results?: OpenverseAudio[] };
  return data.results || [];
}

type FreesoundSound = { id: number; name: string; username: string; license: string; duration: number; url: string; previews?: { "preview-hq-mp3"?: string } };

/** Freesound's own search, used when a free API key is set (FREESOUND_API_KEY). Only CC0 and CC BY. */
async function searchFreesound(query: string) {
  const token = process.env.FREESOUND_API_KEY;
  if (!token) return [];
  const params = new URLSearchParams({ query, filter: 'license:("Creative Commons 0" OR "Attribution") duration:[8 TO *]', fields: "id,name,username,license,duration,url,previews", page_size: "15", token });
  const response = await fetch(`https://freesound.org/apiv2/search/text/?${params}`, { cache: "no-store", signal: AbortSignal.timeout(9_000) });
  if (!response.ok) throw new Error("Freesound unavailable");
  const data = await response.json() as { results?: FreesoundSound[] };
  return (data.results || []).flatMap((item) => {
    const audio = item.previews?.["preview-hq-mp3"];
    if (!audio) return [];
    const cc0 = /publicdomain\/zero/i.test(item.license);
    return [{ id: `freesound-${item.id}`, title: item.name, url: audio, foreign_landing_url: item.url, creator: item.username, license: cc0 ? "cc0" : "by", license_url: item.license, duration: item.duration, provider: "freesound" } satisfies OpenverseAudio];
  });
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || "rain";
  const queries = await translateAmbientQuery(raw);
  const searches = queries.flatMap((query) => [searchOpenverse(query), searchFreesound(query)]);
  const batches = await Promise.allSettled(searches);

  // results from the first (plainest) query come first, then the related words
  const unique = new Map<string, OpenverseAudio>();
  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    const valid = batch.value.filter((item) => item.url && (item.license === "cc0" || item.license === "by") && isAmbientOnly(item)).slice(0, 8);
    for (const item of valid) if (!unique.has(item.url)) unique.set(item.url, item);
  }
  const results = [...unique.values()].slice(0, 18).map((item) => ({
    id: item.id, title: item.title || raw, audio: item.url, source: item.foreign_landing_url,
    creator: item.creator || "", license: item.license === "cc0" ? "CC0" : "CC BY",
    licenseUrl: item.license_url || "", duration: item.duration || 0, provider: item.provider || "Openverse",
  }));
  return NextResponse.json({ results, queries }, {
    headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" },
  });
}
