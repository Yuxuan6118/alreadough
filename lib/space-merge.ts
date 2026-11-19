// Three-way merge of the private space when two devices (or tabs) saved the same account.
// Pure functions so they can be tested with plain Node.
//
// base  = the copy this device last agreed with the cloud (null when it never synced)
// local = what this device has now
// cloud = the newer copy another device saved
//
// For each part: whoever changed it since base wins; if both changed it, this device wins.
// Lists of records are merged record by record (by id), so a story written here and a
// thought accepted on the phone both survive, and a deletion on either side sticks.

type Space = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Records are matched by `id`; records without one by their whole content. */
const keyOf = (item: unknown) => {
  if (item && typeof item === "object" && "id" in item) {
    const id = (item as { id: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return `id:${id}`;
  }
  return `json:${JSON.stringify(item)}`;
};

export function mergeList(base: unknown[] | null, local: unknown[], cloud: unknown[]): unknown[] {
  const baseMap = new Map((base || []).map((item) => [keyOf(item), item]));
  const localMap = new Map(local.map((item) => [keyOf(item), item]));
  const cloudMap = new Map(cloud.map((item) => [keyOf(item), item]));
  const localChanged = (key: string) => base !== null && (!baseMap.has(key) || !same(baseMap.get(key), localMap.get(key)));
  const cloudChanged = (key: string) => base !== null && (!baseMap.has(key) || !same(baseMap.get(key), cloudMap.get(key)));

  const pick = (key: string): unknown | undefined => {
    const inLocal = localMap.has(key);
    const inCloud = cloudMap.has(key);
    const inBase = base !== null && baseMap.has(key);
    if (inLocal && inCloud) return localChanged(key) ? localMap.get(key) : cloudMap.get(key);
    if (inLocal) return !inBase || localChanged(key) ? localMap.get(key) : undefined; // new here, or cloud deleted an unchanged one
    if (inCloud) return !inBase || cloudChanged(key) ? cloudMap.get(key) : undefined; // new there, or deleted here
    return undefined;
  };

  // keep this device's order, and slot records that only the cloud has in after their cloud neighbour
  const result: { key: string; item: unknown }[] = [];
  for (const item of local) {
    const key = keyOf(item);
    const chosen = pick(key);
    if (chosen !== undefined && !result.some((entry) => entry.key === key)) result.push({ key, item: chosen });
  }
  cloud.forEach((item, index) => {
    const key = keyOf(item);
    if (localMap.has(key) || result.some((entry) => entry.key === key)) return;
    const chosen = pick(key);
    if (chosen === undefined) return;
    let at = 0;
    for (let i = index - 1; i >= 0; i -= 1) {
      const found = result.findIndex((entry) => entry.key === keyOf(cloud[i]));
      if (found >= 0) { at = found + 1; break; }
    }
    // after that neighbour, step past records only this device has, so additions on each side stay in runs
    while (at < result.length && !cloudMap.has(result[at].key)) at += 1;
    result.splice(at, 0, { key, item: chosen });
  });
  return result.map((entry) => entry.item);
}

export function mergeObject(base: Space | null, local: Space, cloud: Space): Space {
  const merged: Space = {};
  for (const key of new Set([...Object.keys(cloud), ...Object.keys(local)])) {
    const localChanged = base !== null && !same(base[key], local[key]);
    merged[key] = localChanged || !(key in cloud) ? local[key] : cloud[key];
  }
  return merged;
}

const isObject = (value: unknown): value is Space => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Parts merged record by record; everything else is taken whole from the side that changed it. */
const LIST_KEYS = ["storyLibrary", "revisions", "checkIns", "board", "goalArchive", "otherGoals", "conversationArchive"];
/** Parts merged field by field. */
const OBJECT_KEYS = ["goal", "profile"];

export function mergeSpaces(base: Space | null, local: Space, cloud: Space): Space {
  const merged: Space = { ...mergeObject(base, local, cloud) };
  for (const key of LIST_KEYS) {
    const l = local[key]; const c = cloud[key];
    if (Array.isArray(l) && Array.isArray(c)) merged[key] = mergeList(Array.isArray(base?.[key]) ? base[key] as unknown[] : null, l, c);
  }
  for (const key of OBJECT_KEYS) {
    const l = local[key]; const c = cloud[key];
    if (isObject(l) && isObject(c) && "id" in l && l.id !== c.id) {
      // a different desire is active on each side: never mix two desires field by field
      const b = base?.[key];
      merged[key] = isObject(b) && b.id !== l.id ? l : c;
    } else if (isObject(l) && isObject(c)) {
      const b = base?.[key];
      merged[key] = mergeObject(isObject(b) ? b : null, l, c);
    }
  }
  // the open conversation and its messages travel together
  if (local.conversationId === cloud.conversationId) {
    const l = local.messages; const c = cloud.messages;
    if (Array.isArray(l) && Array.isArray(c)) merged.messages = mergeList(Array.isArray(base?.messages) ? base.messages as unknown[] : null, l, c);
  } else {
    const localSwitched = base !== null && local.conversationId !== base.conversationId;
    const side = localSwitched ? local : cloud;
    merged.conversationId = side.conversationId;
    merged.messages = side.messages;
  }
  return merged;
}
