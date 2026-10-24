"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { firebaseConfigured } from "@/lib/firebase-config";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// Nút Google chính chủ (Google Identity Services): bấm ngay trong web,
// Google trả vé thẳng về trang, không chuyển trang, không qua trang trung gian.
// Tải script 1 lần duy nhất cho cả web.
let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window !== "undefined" && (window as unknown as { google?: { accounts?: { id?: unknown } } }).google?.accounts?.id) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("gis"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

type GisWindow = Window & {
  google?: {
    accounts?: {
      id?: {
        initialize: (opts: Record<string, unknown>) => void;
        renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        cancel: () => void;
      };
    };
  };
};

/** Nút "Sign in with Google" thật của Google. Chưa có CLIENT_ID thì ẩn. */
export function GoogleSignInButton() {
  const divRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !firebaseConfigured) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !divRef.current) return;
        const gid = (window as GisWindow).google?.accounts?.id;
        if (!gid) {
          setFailed("Không tải được nút Google, kiểm tra mạng nhé.");
          return;
        }
        gid.initialize({
          client_id: CLIENT_ID,
          callback: async (resp: { credential?: string }) => {
            setIsExchanging(true);
            try {
              if (!resp?.credential) throw new Error("empty");
              // Nạp Firebase SDK động: chỉ khi người dùng thực sự đăng nhập.
              const [{ GoogleAuthProvider, signInWithCredential }, fb] =
                await Promise.all([
                  import("firebase/auth"),
                  import("@/lib/firebase"),
                ]);
              await signInWithCredential(
                fb.getFirebaseAuth(),
                GoogleAuthProvider.credential(resp.credential)
              );
            } catch {
              setFailed("Đăng nhập lỗi, bạn thử lại nhé.");
            } finally {
              setIsExchanging(false);
            }
          },
        });
        gid.renderButton(divRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          locale: "vi",
        });
      })
      .catch(() => setFailed("Không tải được nút Google, kiểm tra mạng nhé."));
    return () => {
      cancelled = true;
      try {
        (window as GisWindow).google?.accounts?.id?.cancel();
      } catch {
        /* bỏ qua */
      }
    };
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div ref={divRef} className="min-h-10" aria-busy={isExchanging || undefined} />
        {isExchanging && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-slate-950/70 backdrop-blur-xs text-xs font-semibold text-white"
          >
            <CircleNotchIcon className="w-4 h-4 animate-spin text-emerald-300" weight="bold" />
            Đang đăng nhập…
          </div>
        )}
      </div>
      {failed && <p className="text-xs text-amber-300 leading-relaxed text-center">{failed}</p>}
    </div>
  );
}
