"use client";

import { useEffect, useState, useCallback } from "react";
import { firebaseConfigured } from "@/lib/firebase-config";
import { cloudConfigured, hasUnsyncedChanges, syncNow } from "@/lib/cloud-sync";
import { broadcastWipe, hasStoredUserData, wipeLocalUserData } from "@/lib/local-data";
import type { UseAuthReturn } from "../types";
import type { User } from "firebase/auth";

// Firebase SDK chỉ được nạp động khi thực sự cần (sau khi trang đã hydrate),
// nhờ vậy ~670KB SDK không nằm trên critical path của lần tải đầu.
async function loadAuthSdk() {
  const [auth, fb] = await Promise.all([
    import("firebase/auth"),
    import("@/lib/firebase"),
  ]);
  return {
    onAuthStateChanged: auth.onAuthStateChanged,
    getRedirectResult: auth.getRedirectResult,
    GoogleAuthProvider: auth.GoogleAuthProvider,
    signInWithPopup: auth.signInWithPopup,
    signInWithRedirect: auth.signInWithRedirect,
    signOut: auth.signOut,
    getFirebaseAuth: fb.getFirebaseAuth,
  };
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const { onAuthStateChanged, getRedirectResult, getFirebaseAuth } =
          await loadAuthSdk();
        if (cancelled) return;
        // Nhận kết quả sau khi Google chuyển về nếu dùng redirect
        getRedirectResult(getFirebaseAuth()).catch((e: { code?: string }) => {
          const code = String(e?.code || "");
          if (code === "auth/user-cancelled" || code === "auth/popup-closed-by-user") return;
          setAuthError(
            code === "auth/unauthorized-domain"
              ? "Domain này chưa được duyệt trong Firebase (Authentication > Settings > Authorized domains)."
              : code === "auth/network-request-failed"
                ? "Mạng chập chờn hoặc bị chặn, bạn thử lại nhé."
                : code === "auth/web-storage-unsupported"
                  ? "Trình duyệt đang chặn bộ nhớ bên thứ ba, bạn cho phép cookie bên thứ ba rồi thử lại."
                  : `Đăng nhập lỗi (${code || "không rõ"}), bạn thử lại nhé.`
          );
        });
        unsubscribe = onAuthStateChanged(getFirebaseAuth(), (u: User | null) => {
          setUser(u);
          setLoading(false);
        });
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Ưu tiên mở popup để không làm đứt quãng nhạc/trang web; nếu bị chặn thì chuyển sang redirect
  const signIn = useCallback(async () => {
    if (!firebaseConfigured) {
      setAuthError("Chưa cấu hình Firebase Auth trong môi trường.");
      return;
    }
    setIsSigningIn(true);
    setAuthError("");
    const {
      GoogleAuthProvider,
      signInWithPopup,
      signInWithRedirect,
      getFirebaseAuth,
    } = await loadAuthSdk();
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = String(err?.code || "");
      if (code === "auth/user-cancelled" || code === "auth/popup-closed-by-user") {
        return;
      }
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, provider);
        } catch {
          setAuthError("Không thể mở trang đăng nhập Google.");
        }
        return;
      }
      setAuthError(
        code === "auth/unauthorized-domain"
          ? "Domain này chưa được duyệt trong Firebase (Authentication > Settings > Authorized domains)."
          : code === "auth/network-request-failed"
            ? "Mạng chập chờn, bạn kiểm tra kết nối nhé."
            : `Đăng nhập thất bại (${code || err?.message || "lỗi kết nối"}).`
      );
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  // Đăng xuất = kết thúc phiên + xóa sạch dữ liệu của tài khoản khỏi máy này,
  // để người dùng tiếp theo không đọc được ghi chú/task/chat của người trước.
  const signOutNow = useCallback(async () => {
    const { signOut, getFirebaseAuth } = await loadAuthSdk();
    const auth = getFirebaseAuth();

    // Cố đẩy nốt thay đổi đang chờ lên mây trước khi xóa.
    if (auth.currentUser && cloudConfigured()) {
      try {
        await syncNow();
      } catch {
        /* mất mạng -> hỏi người dùng bên dưới */
      }
    }

    const needsWarning = cloudConfigured() ? hasUnsyncedChanges() : hasStoredUserData();
    if (needsWarning) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          cloudConfigured()
            ? "Dữ liệu chưa lưu lên máy chủ sẽ bị xóa khỏi máy này khi đăng xuất. Vẫn tiếp tục?"
            : "Chưa bật đồng bộ nên đăng xuất sẽ xóa dữ liệu trên máy này. Vẫn tiếp tục?"
        );
      if (!ok) return;
    }

    try {
      await signOut(auth);
    } catch {
      /* vẫn xóa dữ liệu cục bộ */
    }
    broadcastWipe();
    await wipeLocalUserData();
    setUser(null);
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  // Vé gửi kèm mỗi câu hỏi sang Worker (Worker tự kiểm vé thật/giả).
  const getToken = useCallback(async (): Promise<string | null> => {
    const { getFirebaseAuth } = await loadAuthSdk();
    const u = getFirebaseAuth().currentUser;
    if (!u) return null;
    try {
      return await u.getIdToken();
    } catch {
      return null;
    }
  }, []);

  return {
    user,
    loading,
    isSigningIn,
    authError,
    redirectError: authError,
    clearError: () => setAuthError(""),
    signIn,
    signOut: signOutNow,
    getToken,
    isConfigured: firebaseConfigured,
  };
}
