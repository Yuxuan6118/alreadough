import { grantPaidOrder, readMemberOrder } from "@/lib/membership";
import { confirmZpayOrder, moneyFen, parseZpayQuery, verifyZpay, zpayConfig } from "@/lib/zpay";

export async function GET(request: Request) {
  const config = zpayConfig();
  if (!config.enabled) return new Response("payments off", { status: 503 });
  const fields = parseZpayQuery(request.url);
  if (!fields || !verifyZpay(fields, config.key) || fields.pid !== config.pid || fields.type !== "alipay" || fields.trade_status !== "TRADE_SUCCESS")
    return new Response("invalid notification", { status: 400 });
  const order = /^[a-f0-9]{32}$/.test(fields.out_trade_no || "") ? await readMemberOrder(fields.out_trade_no) : null;
  if (!order || moneyFen(fields.money || "") !== order.amountFen) return new Response("order mismatch", { status: 400 });
  if (order.status === "paid") return new Response("success");
  try {
    if (!(await confirmZpayOrder(order.orderId, { ...config, amountFen: order.amountFen }))) return new Response("provider verification failed", { status: 503 });
    await grantPaidOrder(order, fields.trade_no || "");
    return new Response("success");
  } catch { return new Response("retry", { status: 503 }); }
}
