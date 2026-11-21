import { createHash, timingSafeEqual } from "node:crypto";

export const ZPAY_CHECKOUT_URL = "https://zpayz.cn/submit.php";
const ZPAY_ORDER_URL = "https://zpayz.cn/api.php";

export function zpayConfig() {
  const pid = process.env.ZPAY_PID || "";
  const key = process.env.ZPAY_KEY || "";
  return { enabled: process.env.ZPAY_ENABLED === "1" && !!pid && !!key, pid, key, cid: process.env.ZPAY_ALIPAY_CID || "" };
}

export function signZpay(fields: Record<string, string>, key: string) {
  const canonical = Object.entries(fields)
    .filter(([name, value]) => name !== "sign" && name !== "sign_type" && value !== "")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`).join("&");
  return createHash("md5").update(canonical + key, "utf8").digest("hex");
}

export function verifyZpay(fields: Record<string, string>, key: string) {
  if (fields.sign_type !== "MD5" || !/^[a-f0-9]{32}$/i.test(fields.sign || "")) return false;
  const actual = Buffer.from(fields.sign.toLowerCase(), "hex");
  const expected = Buffer.from(signZpay(fields, key), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function zpayFields(args: { pid: string; key: string; cid: string; orderId: string; amountFen: number; plan: "deep" | "atelier" | "screenshots" | "chats"; origin: string }) {
  const fields: Record<string, string> = {
    pid: args.pid,
    type: "alipay",
    out_trade_no: args.orderId,
    name: args.plan === "deep" ? "AlreaDough 炼石会员 30天" : args.plan === "screenshots" ? "AlreaDough 截图识别 1次" : args.plan === "chats" ? "AlreaDough 对话加油包 100次" : "AlreaDough 天成会员 30天",
    money: (args.amountFen / 100).toFixed(2),
    notify_url: `${args.origin}/api/pay/zpay/notify`,
    return_url: `${args.origin}/checkout?paid=alipay${args.plan === "screenshots" || args.plan === "chats" ? `&item=${args.plan}` : ""}`,
  };
  if (args.cid) fields.cid = args.cid;
  return { ...fields, sign: signZpay(fields, args.key), sign_type: "MD5" };
}

export function parseZpayQuery(url: string) {
  const params = new URL(url).searchParams;
  const fields: Record<string, string> = {};
  for (const [name, value] of params) {
    if (name in fields) return null;
    fields[name] = value;
  }
  return fields;
}

export function moneyFen(value: string) {
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
}

export async function confirmZpayOrder(orderId: string, expected: { pid: string; key: string; amountFen: number }) {
  const url = new URL(ZPAY_ORDER_URL);
  url.search = new URLSearchParams({ act: "order", pid: expected.pid, key: expected.key, out_trade_no: orderId }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(4_000), cache: "no-store" });
  if (!response.ok) return false;
  const data = await response.json() as { code?: number | string; status?: number | string; pid?: number | string; out_trade_no?: string; money?: string; type?: string };
  return Number(data.code) === 1 && Number(data.status) === 1 && String(data.pid) === expected.pid
    && data.out_trade_no === orderId && data.type === "alipay" && moneyFen(String(data.money)) === expected.amountFen;
}
