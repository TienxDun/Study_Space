import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  type Firestore,
} from "firebase/firestore";

// 4 mã công khai đọc từ env (xem .env.example). Thiếu thì firebaseConfigured = false,
// các component tự ẩn nút đăng nhập/chat thay vì crash lúc build tĩnh.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

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
