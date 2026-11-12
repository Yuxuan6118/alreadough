import { channelFor, isActive, paymentsConfig } from "@/lib/payments";
import { readClientInfo } from "@/lib/client-info";
import { readEntitlement } from "@/lib/payments-db";

// Tells the pricing page which channel to show: "stripe" (real checkout) or "reserve" (leave a contact only).
export async function GET(request: Request) {
  const config = paymentsConfig(process.env);
  const country = readClientInfo(request.headers).country;
  const deviceId = request.headers.get("x-already-session-id")?.trim().slice(0, 128) || "";
  let plan: string | null = null;
  let canManage = false;
  if (deviceId && config.enabled) {
    const entitlement = await readEntitlement(`device:${deviceId}`).catch(() => null);
    if (isActive(entitlement)) { plan = entitlement!.plan; canManage = entitlement!.method === "card"; }
  }
  return Response.json({ channel: channelFor(country, config), plan, canManage }, { headers: { "Cache-Control": "no-store" } });
}
