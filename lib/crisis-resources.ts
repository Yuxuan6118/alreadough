// Where to turn in a crisis. Pure function so it can be unit-tested; numbers checked against official announcements (12356: national mental health hotline, live since 2025-05; 988: US Suicide & Crisis Lifeline).
/** Where to turn in a crisis, by the country Cloudflare reports; unknown country with Chinese text gets the mainland line. */
export function crisisResources(lang: "zh" | "en", country?: string | null) {
  const c = (country || "").toUpperCase();
  const zh = lang === "zh";
  if (c === "CN" || (!c && zh)) return zh ? "你也可以拨打全国心理援助热线 12356；危险就在眼前，请拨 120 或 110。" : "You can also call China's national mental health hotline, 12356. If danger is immediate, call 120 or 110.";
  if (c === "US") return zh ? "在美国，你可以拨打或发短信到 988（自杀与危机生命线）；危险就在眼前，请拨 911。" : "In the US you can call or text 988 (Suicide & Crisis Lifeline). If danger is immediate, call 911.";
  if (c === "TW") return zh ? "在台湾，你可以拨打 1925（安心专线）；危险就在眼前，请拨 119。" : "In Taiwan you can call 1925. If danger is immediate, call 119.";
  return "";
}
