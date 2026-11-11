// Cross-device sync without accounts: the device id that names the cloud space doubles as a sync code.
// Typing it on another device points that device at the same space. Pure helpers, easy to unit-test.

const uuidInside = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Ids made when crypto.randomUUID is unavailable look like d-<time>-<random>.
const fallbackId = /^d-\d{10,}-[a-z0-9]{6,}$/i;

/** The sync code hidden in whatever she pasted (extra spaces, line breaks and surrounding words are fine), or null. */
export function normalizeSyncCode(input: string): string | null {
  const text = (input || "").trim();
  const uuid = text.match(uuidInside);
  if (uuid) return uuid[0].toLowerCase();
  const compact = text.replace(/\s+/g, "").toLowerCase();
  return fallbackId.test(compact) ? compact : null;
}

/** Only real device ids can be shown as a sync code. The placeholder used before the app has loaded cannot. */
export function isShareableSyncCode(sessionId: string): boolean {
  return normalizeSyncCode(sessionId) === sessionId;
}
