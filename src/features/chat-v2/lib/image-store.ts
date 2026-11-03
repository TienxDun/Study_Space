const DB_NAME = "zenstudy-chat-v2";
const STORE_NAME = "images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function runWrite(db: IDBDatabase, run: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      run(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Ảnh gốc nằm trong IndexedDB; localStorage chỉ giữ thumb để không tràn quota. */
export async function saveChatImage(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  const db = await openDatabase();
  if (!db) return;
  await runWrite(db, (store) => {
    store.put(dataUrl, id);
  });
}

export async function loadChatImage(id: string): Promise<string | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () =>
        resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteChatImages(ids: Iterable<string>): Promise<void> {
  const list = Array.from(ids).filter(Boolean);
  if (list.length === 0) return;
  const db = await openDatabase();
  if (!db) return;
  await runWrite(db, (store) => {
    for (const id of list) store.delete(id);
  });
}

/** Dọn ảnh của các phiên đã bị cắt khỏi localStorage để IndexedDB không phình mãi. */
export async function pruneChatImages(keep: Set<string>): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === "string" && !keep.has(key)) store.delete(key);
      }
    };
  } catch {
    // IndexedDB bị chặn thì chỉ còn thumb trong localStorage.
  }
}
