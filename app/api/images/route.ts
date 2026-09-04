import { NextRequest, NextResponse } from "next/server";

type LicensedImage = { id: string; title: string; image: string; source: string; credit: string; license: string; provider: string; query: string; score: number; downloadLocation?: string };
type SearchPlan = { original: string; translated: string; queries: string[] };
type RawImage = Omit<LicensedImage, "score">;

const stripHtml = (value = "") => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
const hasChinese = (value: string) => /[\u3400-\u9fff]/.test(value);
const AESTHETIC = "candid everyday phone photo personal diary natural light authentic moment";
const lifestyleWords = /(candid|everyday|casual|diary|snapshot|phone|iphone|film|personal|home|couple|friends|travel|street|cozy|natural|real|moment|生活|日常|旅行|朋友|情侣)/gi;
const studioWords = /(studio|isolated|product photography|render|3d|vector|illustration|business portrait|white background)/gi;

function fallbackPlan(original: string): SearchPlan {
  const dictionary: Array<[RegExp, string]> = [
    [/北海道/, "Hokkaido winter trip"], [/东京/, "Tokyo travel diary"], [/日本/, "Japan travel diary"], [/纽约/, "New York city diary"],
    [/韩国/, "Seoul beauty trip"], [/购物|奢侈品/, "luxury shopping candid"], [/旅行/, "travel diary"], [/约会|浪漫/, "romantic date candid"],
    [/家|房/, "cozy lived in home"], [/事业|工作/, "creative work life"], [/学习|学业/, "study life diary"], [/金钱|丰盛/, "abundant everyday life"],
    [/闺蜜|朋友/, "best friends candid"], [/男朋友|伴侣|情侣/, "couple candid"], [/医美|美容/, "beauty clinic lifestyle"],
  ];
  let translated = original;
  for (const [pattern, replacement] of dictionary) translated = translated.replace(pattern, ` ${replacement} `);
  translated = translated.replace(/[\u3400-\u9fff]+/g, " ").replace(/\s+/g, " ").trim() || "beautiful everyday life";
  const subjects = translated.split(/[,，、;；|/]+/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  const queries = [...subjects, `${translated} ${AESTHETIC}`].map((item) => item.replace(/\s+/g, " ").trim()).slice(0, 4);
  return { original, translated, queries: [...new Set(queries)] };
}

function responseText(data: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  return data.output_text || data.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text || "").join("") || "";
}

async function buildSearchPlan(original: string): Promise<SearchPlan> {
  const fallback = fallbackPlan(original);
  if (!hasChinese(original) || !process.env.OPENAI_API_KEY) return fallback;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || "gpt-5.6-luna",
        instructions: "Turn a Chinese vision-board search into concise English photo-search queries. Preserve distinct subjects, places, people, actions, and mood. Produce 3-5 separate queries, not one comma-stuffed sentence. At least one query should target candid personal phone-photo aesthetics with words such as candid, everyday, diary, snapshot, natural light, or photo dump. Never add celebrity names or copyrighted platform names.",
        input: original, store: false, reasoning: { effort: "none" }, max_output_tokens: 180,
        text: { format: { type: "json_schema", name: "vision_search_plan", strict: true, schema: { type: "object", additionalProperties: false, properties: { translated: { type: "string" }, queries: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } } }, required: ["translated", "queries"] } } },
      }),
    });
    if (!response.ok) return fallback;
    const parsed = JSON.parse(responseText(await response.json())) as { translated?: string; queries?: string[] };
    const queries = (parsed.queries || []).map((item) => item.trim().slice(0, 100)).filter(Boolean).slice(0, 5);
    return queries.length < 3 ? fallback : { original, translated: parsed.translated?.trim() || queries[0], queries: [...new Set(queries)] };
  } catch { return fallback; }
}

function qualityScore(item: RawImage, queryIndex: number) {
  const haystack = `${item.title} ${item.query}`;
  return (item.provider === "Pexels" ? 8 : item.provider === "Unsplash" ? 6 : 2) + (haystack.match(lifestyleWords) || []).length * 5 - (haystack.match(studioWords) || []).length * 7 - queryIndex;
}

async function searchPexels(query: string): Promise<RawImage[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8`, { headers: { Authorization: key }, next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json() as { photos?: Array<{ id: number; alt?: string; url: string; photographer: string; src: { large: string } }> };
  return (data.photos || []).map((photo) => ({ id: `pexels-${photo.id}`, title: photo.alt || query, image: photo.src.large, source: photo.url, credit: `${photo.photographer} / Pexels`, license: "Pexels License", provider: "Pexels", query }));
}

async function searchUnsplash(query: string): Promise<RawImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8&content_filter=high`, { headers: { Authorization: `Client-ID ${key}` }, next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json() as { results?: Array<{ id: string; alt_description?: string; description?: string; links: { html: string; download_location: string }; urls: { regular: string }; user: { name: string } }> };
  return (data.results || []).map((photo) => ({ id: `unsplash-${photo.id}`, title: photo.alt_description || photo.description || query, image: photo.urls.regular, source: `${photo.links.html}?utm_source=alreadough&utm_medium=referral`, credit: `${photo.user.name} / Unsplash`, license: "Unsplash License", provider: "Unsplash", query, downloadLocation: photo.links.download_location }));
}

async function searchCommons(query: string): Promise<RawImage[]> {
  const params = new URLSearchParams({ action: "query", generator: "search", gsrnamespace: "6", gsrlimit: "18", gsrsearch: `${query} incategory:Photographs`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900", format: "json", origin: "*" });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json() as { query?: { pages?: Record<string, { pageid?: number; title?: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string; extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } } }> }> } };
  return Object.values(data.query?.pages || {}).flatMap((page) => {
    const info = page.imageinfo?.[0];
    const license = info?.extmetadata?.LicenseShortName?.value || "";
    const commercial = /(CC0|CC BY|Creative Commons Attribution|Public domain)/i.test(license) && !/(NC|ND|NonCommercial|NoDerivatives)/i.test(license);
    if (!info?.thumburl || !info.descriptionurl || !commercial) return [];
    return [{ id: `commons-${page.pageid || info.thumburl}`, title: (page.title || query).replace(/^File:/, "").replace(/\.[^.]+$/, ""), image: info.thumburl, source: info.descriptionurl, credit: `${stripHtml(info.extmetadata?.Artist?.value) || "Wikimedia contributor"} / Wikimedia Commons`, license, provider: "Wikimedia Commons", query }];
  }).slice(0, 8);
}

function dedupeAndRank(groups: RawImage[][], queries: string[]) {
  const unique = new Map<string, LicensedImage>();
  groups.forEach((group, queryIndex) => group.forEach((item) => { if (!unique.has(item.id)) unique.set(item.id, { ...item, score: qualityScore(item, queryIndex) }); }));
  const ranked = [...unique.values()].sort((a, b) => b.score - a.score);
  const buckets = queries.map((query) => ranked.filter((item) => item.query === query));
  const mixed: LicensedImage[] = [];
  while (mixed.length < 24 && buckets.some((bucket) => bucket.length)) for (const bucket of buckets) { const next = bucket.shift(); if (next && !mixed.some((item) => item.id === next.id)) mixed.push(next); if (mixed.length >= 24) break; }
  return mixed;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120);
  if (!query) return NextResponse.json({ results: [] });
  try {
    const plan = await buildSearchPlan(query);
    const searches = await Promise.all(plan.queries.flatMap((searchQuery) => [searchPexels(searchQuery), searchUnsplash(searchQuery)]));
    let results = dedupeAndRank(searches, plan.queries);
    if (results.length < 8) results = dedupeAndRank([...searches, ...await Promise.all(plan.queries.slice(0, 3).map(searchCommons))], plan.queries);
    return NextResponse.json({ results, plan, providers: [...new Set(results.map((item) => item.provider))], policy: "commercial-license-filtered" });
  } catch { return NextResponse.json({ results: [], error: "IMAGE_SEARCH_UNAVAILABLE" }, { status: 502 }); }
}

export async function POST(request: NextRequest) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const body = await request.json().catch(() => ({})) as { downloadLocation?: string };
  if (!key || !body.downloadLocation?.startsWith("https://api.unsplash.com/")) return NextResponse.json({ ok: true });
  await fetch(body.downloadLocation, { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" }).catch(() => null);
  return NextResponse.json({ ok: true });
}
