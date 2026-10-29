"use client";

import { broadcastWipe } from "./local-data";
import type { CollectionReference, DocumentData } from "firebase/firestore";
import {
  clearLocalUserData,
  deleteCloudAccount,
  startCloudSync,
  stopCloudSync,
} from "./simple-cloud-sync";
import { firebaseConfigured } from "./firebase-config";

export type DeleteAccountStep = "chat" | "server" | "local";

export type DeleteAccountErrorCode =
  | "OFFLINE"
  | "NOT_CONFIGURED"
  | "NOT_SIGNED_IN"
  | "SERVER_FAILED"
  | "CHAT_FAILED";

export class DeleteAccountError extends Error {
  readonly code: DeleteAccountErrorCode;
  readonly detail?: unknown;

  constructor(code: DeleteAccountErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "DeleteAccountError";
    this.code = code;
    this.detail = detail;
  }
}

export interface DeleteAccountDeps {
  stopSync: () => void;
  deleteChat: () => Promise<void>;
  deleteServer: () => Promise<void>;
  signOutLocal: () => Promise<void>;
  wipeLocal: () => Promise<void>;
  isOnline: () => boolean;
}

// Thứ tự cố định: Firestore phải xoá trước vì Worker xoá tài khoản Firebase
// trong cùng lượt gọi; xoá tài khoản xong là mất quyền ghi Firestore.
// Dọn máy phải sau cùng để không kích hoạt autosave đẩy snapshot trở lại.
export async function runAccountDeletion(
  deps: DeleteAccountDeps,
  onProgress?: (step: DeleteAccountStep) => void
): Promise<void> {
  if (!deps.isOnline()) {
    throw new DeleteAccountError(
      "OFFLINE",
      "Bạn đang offline. Kết nối mạng rồi thử lại để xoá dữ liệu trên máy chủ nhé."
    );
  }

  onProgress?.("chat");
  deps.stopSync();
  await deps.deleteChat();

  onProgress?.("server");
  await deps.deleteServer();

  onProgress?.("local");
  await deps.signOutLocal();
  await deps.wipeLocal();
}

async function deleteChatHistory(uid: string): Promise<void> {
  const fs = await import("firebase/firestore");
  const { getFirebaseDb } = await import("./firebase");
  const db = getFirebaseDb();

  // Tin nhắn nằm trong subcollection nên phải xoá theo lô, Firestore không hỗ trợ xoá đệ quy phía client.
  const deleteMessages = async (
    messagesRef: CollectionReference<DocumentData, DocumentData>
  ) => {
    for (let round = 0; round < 200; round++) {
      const snap = await fs.getDocs(fs.query(messagesRef, fs.limit(100)));
      if (snap.empty) return;
      const batch = fs.writeBatch(db);
      snap.docs.forEach((messageDoc) => batch.delete(messageDoc.ref));
      await batch.commit();
    }
    throw new Error("Quá nhiều tin nhắn để xoá trong một lượt.");
  };

  const deleteConversation = async (cid: string) => {
    const sessions = await fs.getDocs(
      fs.collection(db, "conversations", cid, "sessions")
    );
    for (const session of sessions.docs) {
      await deleteMessages(
        fs.collection(db, "conversations", cid, "sessions", session.id, "messages")
      );
      await fs.deleteDoc(session.ref);
    }
    // Document cha chỉ còn metadata. Rules cũ chưa cho xoá cha nên bỏ qua lỗi quyền
    // để tài khoản vẫn xoá được trước khi rules mới được publish.
    try {
      await fs.deleteDoc(fs.doc(db, "conversations", cid));
    } catch (err) {
      const code = String((err as { code?: string })?.code || "");
      if (code !== "permission-denied") throw err;
    }
  };

  await deleteConversation(uid);

  // Bản cũ có thể lưu hội thoại dưới id ngẫu nhiên kèm ownerUid.
  const legacy = await fs.getDocs(
    fs.query(fs.collection(db, "conversations"), fs.where("ownerUid", "==", uid))
  );
  for (const conversation of legacy.docs) {
    if (conversation.id === uid) continue;
    await deleteConversation(conversation.id);
  }

  try {
    await fs.deleteDoc(fs.doc(db, "users", uid));
  } catch {
    /* hồ sơ chưa từng tạo thì bỏ qua */
  }
}

// Firestore giữ cache IndexedDB trên máy; đóng rồi xoá để người dùng kế tiếp
// trên cùng thiết bị không đọc lại được tin nhắn cũ.
async function clearFirestoreCaches(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (typeof factory.databases !== "function") return;

  try {
    const list = await factory.databases();
    await Promise.all(
      list
        .filter((entry) => entry.name && entry.name.startsWith("firestore/"))
        .map(
          (entry) =>
            new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(entry.name as string);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            })
        )
    );
  } catch {
    /* trình duyệt không hỗ trợ thì bỏ qua */
  }
}

async function wipeLocalAccountData(): Promise<void> {
  broadcastWipe();
  clearLocalUserData();
  const { terminateFirebaseDb } = await import("./firebase");
  await terminateFirebaseDb();
  await clearFirestoreCaches();
}

export async function deleteAccount(options: {
  onProgress?: (step: DeleteAccountStep) => void;
} = {}): Promise<void> {
  if (!firebaseConfigured) {
    throw new DeleteAccountError(
      "NOT_CONFIGURED",
      "Bản này chưa cấu hình đăng nhập nên không có tài khoản để xoá."
    );
  }

  const { getFirebaseAuth } = await import("./firebase");
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new DeleteAccountError(
      "NOT_SIGNED_IN",
      "Bạn cần đăng nhập bằng Google trước khi xoá tài khoản."
    );
  }

  let syncStopped = false;
  let serverDone = false;

  const deps: DeleteAccountDeps = {
    isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
    stopSync: () => {
      syncStopped = true;
      stopCloudSync();
    },
    deleteChat: async () => {
      try {
        await deleteChatHistory(user.uid);
      } catch (err) {
        throw new DeleteAccountError(
          "CHAT_FAILED",
          "Không xoá được lịch sử trò chuyện nên tài khoản chưa bị xoá. Bạn thử lại nhé.",
          err
        );
      }
    },
    deleteServer: async () => {
      try {
        const token = await user.getIdToken();
        await deleteCloudAccount(token);
        serverDone = true;
      } catch (err) {
        const status = (err as { status?: number })?.status;
        throw new DeleteAccountError(
          "SERVER_FAILED",
          status === 503
            ? "Máy chủ chưa cấu hình xoá tài khoản. Dữ liệu trên máy vẫn giữ nguyên, bạn thử lại sau hoặc liên hệ hỗ trợ."
            : "Chưa xoá xong trên máy chủ nên tài khoản có thể vẫn còn. Bạn kiểm tra mạng rồi thử lại nhé.",
          err
        );
      }
    },
    signOutLocal: async () => {
      try {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      } catch {
        /* tài khoản đã bị xoá phía máy chủ, lỗi đăng xuất cục bộ không chặn dọn máy */
      }
    },
    wipeLocal: wipeLocalAccountData,
  };

  try {
    await runAccountDeletion(deps, options.onProgress);
  } catch (err) {
    // Chưa xoá xong tài khoản: bật lại autosave để app không ngừng đồng bộ.
    if (syncStopped && !serverDone && auth.currentUser) {
      const uid = auth.currentUser.uid;
      void startCloudSync(uid, () =>
        auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)
      ).catch(() => {});
    }
    throw err;
  }
}
