"use client";

import { useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";
import type { UseAuthReturn } from "../types";

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
    // Nhận kết quả sau khi Google chuyển về nếu dùng redirect
    getRedirectResult(getFirebaseAuth()).catch((e) => {
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
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Ưu tiên mở popup để không làm đứt quãng nhạc/trang web; nếu bị chặn thì chuyển sang redirect
  const signIn = useCallback(async () => {
    if (!firebaseConfigured) {
      setAuthError("Chưa cấu hình Firebase Auth trong môi trường.");
      return;
    }
    setIsSigningIn(true);
    setAuthError("");
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

  const signOutNow = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setUser(null);
  }, []);

  // Vé gửi kèm mỗi câu hỏi sang Worker (Worker tự kiểm vé thật/giả).
  const getToken = useCallback(async (): Promise<string | null> => {
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
