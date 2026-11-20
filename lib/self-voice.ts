// Lines she read aloud herself. Kept only on this device, one recording per line, never sent anywhere.
// Separate from the synthesized-voice cache, so deleting a cloned voice never removes her own readings.

const DB = "already-self-voice-v1";
const STORE = "lines";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const keyFor = (text: string) => text.replace(/\s+/g, " ").trim();

export async function readSelfLine(text: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise<Blob | null>((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get(keyFor(text));
      request.onsuccess = () => resolve((request.result as { blob: Blob } | undefined)?.blob || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeSelfLine(text: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ blob, at: Date.now() }, keyFor(text));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Which of these lines she has already read. */
export async function selfLinesDone(texts: string[]): Promise<Set<string>> {
  const done = new Set<string>();
  await Promise.all(texts.map(async (text) => { if (await readSelfLine(text)) done.add(text); }));
  return done;
}

export function clearSelfVoice() {
  try { indexedDB.deleteDatabase(DB); } catch { /* nothing to clear */ }
}
