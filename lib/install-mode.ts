// Which "put it on the home screen" instructions fit this browser. Pure functions (unit-testable).
// iPhone only lets Safari add a site to the home screen, so every other iPhone browser (Chrome, QQ,
// in-app browsers) is told to reopen the page in Safari.

export type InstallMode = "android" | "ios-safari" | "ios-other" | "wechat-ios" | "wechat-android";

const NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser|Brave|Focus|QQ\/|MQQBrowser|UCBrowser|Quark|baidu|XiaoHongShu|Instagram|FBAN|FBAV|Line\/|Weibo|Snapchat|TikTok|musical_ly|Bytedance|aweme|Alipay|DingTalk/i;

export function detectInstallMode(userAgent: string, touchPoints = 0): InstallMode | null {
  const ua = userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return null;
  if (/MicroMessenger/i.test(ua)) return ios ? "wechat-ios" : "wechat-android";
  if (android) return "android";
  return /Safari\//.test(ua) && !NOT_SAFARI.test(ua) ? "ios-safari" : "ios-other";
}

/** Local calendar day, so a tip can appear once per day. */
export function localDayKey(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
