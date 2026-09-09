/**
 * localStorage helpers that never throw.
 *
 * Some browsers (private mode, storage disabled, embedded webviews, strict
 * cookie settings) throw on any `localStorage` access instead of returning
 * null. An unguarded access in a render or effect can leave the app stuck,
 * so every read/write goes through here.
 */

export function readStored(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the device-local copy is best effort */
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
