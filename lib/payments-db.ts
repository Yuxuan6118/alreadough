import { env } from "cloudflare:workers";
import type { Billing, EntitlementChange, PaymentMethod, PlanId } from "./payments";

export type StoredEntitlement = { plan: PlanId; billing: Billing; method: PaymentMethod; status: string; periodEnd: string };

export async function readEntitlement(deviceId: string): Promise<StoredEntitlement | null> {
  return env.DB.prepare("SELECT plan, billing, method, status, period_end AS periodEnd FROM entitlements WHERE device_id = ?").bind(deviceId).first<StoredEntitlement>();
}

export async function readStripeCustomer(deviceId: string) {
  const row = await env.DB.prepare("SELECT stripe_customer AS customer FROM entitlements WHERE device_id = ?").bind(deviceId).first<{ customer: string | null }>();
  return row?.customer || null;
}

/** Stripe resends events, so each id is remembered. Mark an event only AFTER it was applied, so a failed write is retried. */
export async function hasSeenEvent(id: string) {
  return !!(await env.DB.prepare("SELECT id FROM payment_events WHERE id = ?").bind(id).first());
}

export async function markEventSeen(id: string, type: string) {
  await env.DB.prepare("INSERT OR IGNORE INTO payment_events (id, type, received_at) VALUES (?, ?, ?)").bind(id, type, new Date().toISOString()).run();
}

export async function applyEntitlementChange(change: EntitlementChange) {
  const now = new Date().toISOString();
  if (change.kind === "grant") {
    await env.DB.prepare(`INSERT INTO entitlements (device_id, plan, billing, method, status, period_end, stripe_customer, stripe_subscription, last_reference, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET plan = excluded.plan, billing = excluded.billing, method = excluded.method, status = 'active',
        period_end = excluded.period_end, stripe_customer = excluded.stripe_customer, stripe_subscription = excluded.stripe_subscription,
        last_reference = excluded.last_reference, updated_at = excluded.updated_at`)
      .bind(change.deviceId, change.plan, change.billing, change.method, change.periodEnd, change.customer, change.subscription, change.reference, now).run();
  } else if (change.kind === "extend") {
    await env.DB.prepare("UPDATE entitlements SET period_end = ?, status = 'active', updated_at = ? WHERE stripe_subscription = ?").bind(change.periodEnd, now, change.subscription).run();
  } else if (change.kind === "revoke") {
    await env.DB.prepare("UPDATE entitlements SET status = 'canceled', updated_at = ? WHERE stripe_subscription = ?").bind(now, change.subscription).run();
  }
}

export async function saveInterest(entry: { deviceId: string; plan: PlanId; billing: Billing; contact: string | null; country: string | null; lang: string }) {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO payment_interest (device_id, plan, billing, contact, country, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET plan = excluded.plan, billing = excluded.billing, contact = COALESCE(excluded.contact, payment_interest.contact),
      country = excluded.country, lang = excluded.lang, updated_at = excluded.updated_at`)
    .bind(entry.deviceId, entry.plan, entry.billing, entry.contact, entry.country, entry.lang, now, now).run();
}

/** For the founder only: who reserved what, and who currently has an active entitlement. */
export async function listPayments() {
  const interest = await env.DB.prepare("SELECT device_id AS deviceId, plan, billing, contact, country, lang, created_at AS createdAt, updated_at AS updatedAt FROM payment_interest ORDER BY updated_at DESC LIMIT 500").all();
  const entitlements = await env.DB.prepare("SELECT device_id AS deviceId, plan, billing, method, status, period_end AS periodEnd, updated_at AS updatedAt FROM entitlements ORDER BY updated_at DESC LIMIT 500").all();
  return { interest: interest.results, entitlements: entitlements.results };
}
