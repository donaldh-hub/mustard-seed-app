const DB_NAME = "mustard_seed_images";
const STORE_NAME = "pending_photos";
const KEY = "current";

interface StoredImage {
  data: ArrayBuffer;
  name: string;
  type: string;
  size: number;
  previewUrl: string;
  timestamp: number;
}

let memoryCache: { file: File; url: string } | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function persistImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  memoryCache = { file, url };

  try {
    const buffer = await file.arrayBuffer();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record: StoredImage = {
      data: buffer,
      name: file.name,
      type: file.type || "image/jpeg",
      size: file.size,
      previewUrl: "",
      timestamp: Date.now(),
    };
    store.put(record, KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[imageStore] IndexedDB persist failed, using memory only:", e);
  }

  return url;
}

export async function restoreImage(): Promise<{ file: File; url: string } | null> {
  if (memoryCache) return memoryCache;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);

    const record = await new Promise<StoredImage | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as StoredImage | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!record) return null;

    const MAX_AGE = 30 * 60 * 1000;
    if (Date.now() - record.timestamp > MAX_AGE) {
      await clearImage();
      return null;
    }

    const blob = new Blob([record.data], { type: record.type });
    const file = new File([blob], record.name, { type: record.type });
    const url = URL.createObjectURL(file);
    memoryCache = { file, url };
    return memoryCache;
  } catch (e) {
    console.warn("[imageStore] IndexedDB restore failed:", e);
    return null;
  }
}

export async function clearImage(): Promise<void> {
  if (memoryCache) {
    URL.revokeObjectURL(memoryCache.url);
    memoryCache = null;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[imageStore] IndexedDB clear failed:", e);
  }
}

export function getMemoryCache(): { file: File; url: string } | null {
  return memoryCache;
}
