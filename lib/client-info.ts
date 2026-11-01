// Coarse, non-identifying facts about a visitor for beta product analytics. Pure functions (unit-testable).
// Deliberately NOT collected: the IP address, precise location, or any device fingerprint.

export type ClientInfo = { country: string | null; region: string | null; city: string | null; timezone: string | null; lang: string | null; device: string; os: string; browser: string };

export function parseUserAgent(ua: string): { device: string; os: string; browser: string } {
  const text = ua || "";
  const device = /iPad|Tablet/i.test(text) ? "tablet" : /Mobile|iPhone|Android.+Mobile/i.test(text) ? "mobile" : text ? "desktop" : "unknown";
  const os = /iPhone|iPad|iPod/i.test(text) ? "iOS" : /Android/i.test(text) ? "Android" : /Mac OS X|Macintosh/i.test(text) ? "macOS" : /Windows/i.test(text) ? "Windows" : /Linux/i.test(text) ? "Linux" : "unknown";
  const browser = /MicroMessenger/i.test(text) ? "WeChat" : /Edg\//i.test(text) ? "Edge" : /CriOS|Chrome\//i.test(text) ? "Chrome" : /FxiOS|Firefox\//i.test(text) ? "Firefox" : /Safari\//i.test(text) ? "Safari" : text ? "other" : "unknown";
  return { device, os, browser };
}

const clean = (value: unknown, max = 64) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

/** `cf` is Cloudflare's request.cf object when the runtime provides it; headers are the fallback. */
export function readClientInfo(headers: Headers, cf?: Record<string, unknown> | null): ClientInfo {
  const country = clean(cf?.country, 2) || clean(headers.get("cf-ipcountry"), 2);
  const language = clean((headers.get("accept-language") || "").split(",")[0], 16);
  return {
    country: country && country !== "XX" && country !== "T1" ? country.toUpperCase() : null,
    region: clean(cf?.region) || clean(headers.get("cf-region")),
    city: clean(cf?.city) || clean(headers.get("cf-ipcity")),
    timezone: clean(cf?.timezone) || null,
    lang: language,
    ...parseUserAgent(headers.get("user-agent") || ""),
  };
}
