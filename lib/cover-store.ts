// Story covers she uploads from her own computer or photo library stay on this device (like private
// vision photos): the synced story only keeps a "local-cover:<id>" reference, so sync stays small.

export const LOCAL_COVER_PREFIX = "local-cover:";
export const COVER_DB = "already-private-covers-v1";
const STORE = "covers";
const MAX_EDGE = 1600;

export const isLocalCover = (image?: string) => Boolean(image?.startsWith(LOCAL_COVER_PREFIX));

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(COVER_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const database = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Shrink a photo to at most 1600px on its long edge and re-encode it as JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("encode failed")), "image/jpeg", 0.86));
}

/** Saves the photo on this device and returns the reference to keep on the story. */
export async function saveLocalCover(file: File) {
  const blob = await shrink(file);
  const id = crypto.randomUUID();
  await run("readwrite", (store) => { store.put(blob, id); });
  return `${LOCAL_COVER_PREFIX}${id}`;
}

export async function readLocalCover(image: string) {
  return run<Blob | undefined>("readonly", (store) => store.get(image.slice(LOCAL_COVER_PREFIX.length)));
}

export async function deleteLocalCover(image?: string) {
  if (!isLocalCover(image)) return;
  await run("readwrite", (store) => { store.delete(image!.slice(LOCAL_COVER_PREFIX.length)); }).catch(() => null);
}
