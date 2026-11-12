// Audio the device has already paid for. Keyed by who is speaking and the exact text, so the same line is never synthesized twice.

const DB = "already-voice-cache-v1";
const STORE = "lines";
const MAX_ENTRIES = 120;

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheKey(owner: string, text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${owner}\n${text}`));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export async function readCached(key: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise<Blob | null>((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as { blob: Blob } | undefined)?.blob || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeCached(key: string, blob: Blob) {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.put({ blob, at: Date.now() }, key);
      const count = store.count();
      count.onsuccess = () => {
        if (count.result <= MAX_ENTRIES) return;
        // drop the oldest few
        const entries: Array<{ key: IDBValidKey; at: number }> = [];
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (current) { entries.push({ key: current.key, at: (current.value as { at: number }).at }); current.continue(); return; }
          entries.sort((a, b) => a.at - b.at).slice(0, count.result - MAX_ENTRIES).forEach((entry) => store.delete(entry.key));
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* the cache is a convenience; playback still works without it */
  }
}

/** Forget everything: used when she deletes her voice or clears her data. */
export function clearVoiceCache() {
  try { indexedDB.deleteDatabase(DB); } catch { /* nothing to clear */ }
}
