import { NextRequest, NextResponse } from "next/server";

type LicensedImage = {
  title: string;
  image: string;
  source: string;
  credit: string;
  license: string;
  provider: string;
  downloadLocation?: string;
};

const stripHtml = (value = "") => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

async function searchPexels(query: string): Promise<LicensedImage[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`, { headers: { Authorization: key }, next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json() as { photos?: Array<{ id: number; alt?: string; url: string; photographer: string; photographer_url: string; src: { large: string } }> };
  return (data.photos || []).map((photo) => ({
    title: photo.alt || query,
    image: photo.src.large,
    source: photo.url,
    credit: `${photo.photographer} · Pexels`,
    license: "Pexels License",
    provider: "Pexels",
  }));
}

async function searchUnsplash(query: string): Promise<LicensedImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=portrait`, { headers: { Authorization: `Client-ID ${key}` }, next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json() as { results?: Array<{ id: string; alt_description?: string; links: { html: string; download_location: string }; urls: { regular: string }; user: { name: string } }> };
  return (data.results || []).map((photo) => ({
    title: photo.alt_description || query,
    image: photo.urls.regular,
    source: `${photo.links.html}?utm_source=already&utm_medium=referral`,
    credit: `${photo.user.name} · Unsplash`,
    license: "Unsplash License",
    provider: "Unsplash",
    downloadLocation: photo.links.download_location,
  }));
}

async function searchCommons(query: string): Promise<LicensedImage[]> {
  const translated: Record<string, string> = {
    "冬日旅行": "candid winter travel diary",
    "理想的新家": "cozy dream home phone photo",
    "浪漫约会": "candid romantic date photo diary",
    "丰盛日常": "beautiful abundant everyday life photo dump",
  };
  const commonsQuery = translated[query] || query;
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrnamespace: "6", gsrlimit: "30",
    gsrsearch: `${commonsQuery} incategory:Photographs`, prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "900", format: "json", origin: "*",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const data = await response.json() as { query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string; extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } } }> }> } };
  return Object.values(data.query?.pages || {}).flatMap((page) => {
    const info = page.imageinfo?.[0];
    const license = info?.extmetadata?.LicenseShortName?.value || "";
    const commerciallyReusable = /(CC0|CC BY|Creative Commons Attribution|Public domain)/i.test(license) && !/(NC|ND|NonCommercial|NoDerivatives)/i.test(license);
    if (!info?.thumburl || !info.descriptionurl || !commerciallyReusable) return [];
    return [{
      title: (page.title || query).replace(/^File:/, "").replace(/\.[^.]+$/, ""),
      image: info.thumburl,
      source: info.descriptionurl,
      credit: `${stripHtml(info.extmetadata?.Artist?.value) || "Wikimedia contributor"} · Wikimedia Commons`,
      license,
      provider: "Wikimedia Commons",
    }];
  }).slice(0, 12);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120);
  if (!query) return NextResponse.json({ results: [] });
  try {
    const [pexels, unsplash] = await Promise.all([searchPexels(query), searchUnsplash(query)]);
    const premium = [...pexels.slice(0, 6), ...unsplash.slice(0, 6)];
    const results = premium.length ? premium : await searchCommons(query);
    return NextResponse.json({ results, providers: [...new Set(results.map((item) => item.provider))] });
  } catch {
    return NextResponse.json({ results: [], error: "IMAGE_SEARCH_UNAVAILABLE" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const body = await request.json().catch(() => ({})) as { downloadLocation?: string };
  if (!key || !body.downloadLocation?.startsWith("https://api.unsplash.com/")) return NextResponse.json({ ok: true });
  await fetch(body.downloadLocation, { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" }).catch(() => null);
  return NextResponse.json({ ok: true });
}
