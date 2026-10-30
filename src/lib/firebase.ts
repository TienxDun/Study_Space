import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  setLogLevel,
  terminate,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig as config, firebaseConfigured } from "./firebase-config";

// Cờ cấu hình được tách sang module gọn (không kéo SDK). Re-export để tương
// thích ngược; component chỉ cần cờ nên import trực tiếp từ ./firebase-config.
export { firebaseConfigured };

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let firestoreLogLevelSet = false;

// Firestore mặc định log cảnh báo offline/backoff; production chỉ giữ lỗi để
// console không lộ đường dẫn tài liệu (chứa UID) từ các log chẩn đoán.
function configureFirestoreLogging(): void {
  if (firestoreLogLevelSet || typeof window === "undefined") return;
  firestoreLogLevelSet = true;
  setLogLevel(process.env.NODE_ENV === "production" ? "error" : "warn");
}

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const apps = getApps();
  app = apps.length > 0 ? apps[0] : initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  configureFirestoreLogging();
  if (db) return db;
  const fbApp = getFirebaseApp();
  try {
    // Cache IndexedDB: mở lại chỉ đọc phần mới, đỡ tốn lượt đọc Firestore (R1.4).
    db = initializeFirestore(fbApp, { localCache: persistentLocalCache({}) });
  } catch {
    db = getFirestore(fbApp); // HMR gọi 2 lần thì dùng lại cái cũ
  }
  return db;
}

/** Đóng Firestore để có thể xóa cache IndexedDB khi đăng xuất. */
export async function terminateFirebaseDb(): Promise<void> {
  if (!db) return;
  const current = db;
  db = null;
  try {
    await terminate(current);
  } catch {
    /* bỏ qua */
  }
}
