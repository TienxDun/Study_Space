import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig as config, firebaseConfigured } from "./firebase-config";

// Cờ cấu hình được tách sang module gọn (không kéo SDK). Re-export để tương
// thích ngược; component chỉ cần cờ nên import trực tiếp từ ./firebase-config.
export { firebaseConfigured };

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
