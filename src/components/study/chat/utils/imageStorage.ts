// Quản lý bộ nhớ đệm ảnh Full HD/Gốc cục bộ bằng IndexedDB trên trình duyệt.
// Giữ ảnh sắc nét 100% khi xem lại trong chat mà không tốn dung lượng của Firestore.

export const CHAT_MEDIA_DB_NAME = "StudySpaceChatMediaDB";
const DB_NAME = CHAT_MEDIA_DB_NAME;
const STORE_NAME = "chat_images";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveLocalImage(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  try {
    const db = await openDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ id, dataUrl, createdAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    /* bỏ qua lỗi cache */
  }
}

export async function getLocalImage(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const item = req.result as { dataUrl?: string } | undefined;
          resolve(item?.dataUrl || null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/** Xóa toàn bộ ảnh chat đã lưu trên máy (dùng khi đăng xuất / đổi tài khoản). */
export function deleteLocalImages(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      const done = () => resolve();
      req.onsuccess = done;
      req.onerror = done;
      req.onblocked = done;
    } catch {
      resolve();
    }
  });
}
