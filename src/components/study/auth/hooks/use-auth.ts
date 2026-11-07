"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { firebaseConfigured } from "@/lib/firebase-config";
import { cloudConfigured, syncNow, clearLocalUserData } from "@/lib/simple-cloud-sync";
import { broadcastWipe, hasStoredUserData } from "@/lib/local-data";
import { trackEvent } from "@/lib/analytics";
import { isNativeApp, signInWithGoogleNative, signOutGoogleNative } from "@/lib/google-sign-in";
import { toast } from "sonner";
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signingOutRef = useRef(false);
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
        getRedirectResult(getFirebaseAuth())
          .then((cred) => {
            if (cred?.user) {
              trackEvent("auth-login");
              toast.success("Đăng nhập thành công!");
            }
          })
          .catch((e: { code?: string }) => {
            const code = String(e?.code || "");
            if (code === "auth/user-cancelled" || code === "auth/popup-closed-by-user") return;
            const message =
              code === "auth/unauthorized-domain"
                ? "Domain này chưa được duyệt trong Firebase (Authentication > Settings > Authorized domains)."
                : code === "auth/network-request-failed"
                  ? "Mạng chập chờn hoặc bị chặn, bạn thử lại nhé."
                  : code === "auth/web-storage-unsupported"
                    ? "Trình duyệt đang chặn bộ nhớ bên thứ ba, bạn cho phép cookie bên thứ ba rồi thử lại."
                    : `Đăng nhập lỗi (${code || "không rõ"}), bạn thử lại nhé.`;
            setAuthError(message);
            toast.error(message);
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
      const msg = "Chưa cấu hình Firebase Auth trong môi trường.";
      setAuthError(msg);
      toast.error(msg);
      return;
    }
    setIsSigningIn(true);
    setAuthError("");
    // App Android: hộp chọn tài khoản gốc của máy, không dùng popup/redirect.
    if (isNativeApp()) {
      try {
        const { cancelled } = await signInWithGoogleNative();
        if (!cancelled) {
          trackEvent("auth-login");
          toast.success("Đăng nhập thành công!");
        }
      } catch {
        const msg = "Đăng nhập Google thất bại, bạn thử lại nhé.";
        setAuthError(msg);
        toast.error(msg);
      } finally {
        setIsSigningIn(false);
      }
      return;
    }
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
      trackEvent("auth-login");
      toast.success("Đăng nhập thành công!");
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
          const msg = "Không thể mở trang đăng nhập Google.";
          setAuthError(msg);
          toast.error(msg);
        }
        return;
      }
      const msg =
        code === "auth/unauthorized-domain"
          ? "Domain này chưa được duyệt trong Firebase (Authentication > Settings > Authorized domains)."
          : code === "auth/network-request-failed"
            ? "Mạng chập chờn, bạn kiểm tra kết nối nhé."
            : `Đăng nhập thất bại (${code || err?.message || "lỗi kết nối"}).`;
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  // Đăng xuất = kết thúc phiên + xóa sạch dữ liệu của tài khoản khỏi máy này,
  // để người dùng tiếp theo không đọc được ghi chú/task/chat của người trước.
  const signOutNow = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIsSigningOut(true);

    try {
      const { signOut, getFirebaseAuth } = await loadAuthSdk();
      const auth = getFirebaseAuth();

      // Cố đẩy nốt thay đổi đang chờ lên mây nếu có mạng
      if (auth.currentUser && cloudConfigured() && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          await syncNow();
        } catch {}
      }

      // Với tài khoản khách (chưa đăng nhập): hỏi xác nhận trước khi xóa dữ liệu cục bộ
      if (!auth.currentUser && hasStoredUserData()) {
        const ok =
          typeof window !== "undefined" &&
          window.confirm(
            "Bạn đang dùng tài khoản khách (chưa đăng nhập). Đăng xuất sẽ xóa toàn bộ dữ liệu trên thiết bị này. Bạn có chắc chắn muốn tiếp tục?"
          );
        if (!ok) return;
      }

      try {
        await signOut(auth);
      } catch {
        /* vẫn xóa dữ liệu cục bộ */
      }
      if (isNativeApp()) await signOutGoogleNative();
      broadcastWipe();
      clearLocalUserData();
      setUser(null);
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      signingOutRef.current = false;
      setIsSigningOut(false);
    }
  }, []);

  // Vé gửi kèm mỗi câu hỏi sang Worker (Worker tự kiểm vé thật/giả).
  const getToken = useCallback(async (forceRefresh?: boolean): Promise<string | null> => {
    const { getFirebaseAuth } = await loadAuthSdk();
    const u = getFirebaseAuth().currentUser;
    if (!u) return null;
    try {
      return await u.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }, []);

  return {
    user,
    loading,
    isSigningIn,
    isSigningOut,
    authError,
    redirectError: authError,
    clearError: () => setAuthError(""),
    signIn,
    signOut: signOutNow,
    getToken,
    isConfigured: firebaseConfigured,
  };
}
