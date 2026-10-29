"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  CircleNotchIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/use-auth";
import { firebaseConfigured } from "@/lib/firebase-config";
import {
  DeleteAccountError,
  deleteAccount,
  type DeleteAccountStep,
} from "@/lib/delete-account";
import { GoogleIcon } from "@/components/study/auth/components/GoogleIcon";

const STEP_LABELS: Record<DeleteAccountStep, string> = {
  chat: "Đang xoá lịch sử trò chuyện…",
  server: "Đang xoá dữ liệu và tài khoản…",
  local: "Đang dọn dữ liệu trên thiết bị…",
};

export function DeleteAccountPanel() {
  const { user, loading, isSigningIn, signIn } = useAuth();
  const [acknowledged, setAcknowledged] = useState(false);
  const [phase, setPhase] = useState<"idle" | "deleting" | "done">("idle");
  const [step, setStep] = useState<DeleteAccountStep | null>(null);
  const [error, setError] = useState("");

  const isDeleting = phase === "deleting";

  const handleDelete = async () => {
    if (!acknowledged || isDeleting) return;
    setError("");
    setPhase("deleting");
    try {
      await deleteAccount({ onProgress: setStep });
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof DeleteAccountError
          ? err.message
          : "Không xoá được tài khoản lúc này. Bạn thử lại nhé."
      );
      setPhase("idle");
    }
  };

  if (!firebaseConfigured) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        Bản web này chưa cấu hình đăng nhập nên không thể xoá tự động. Bạn gửi email
        theo hướng dẫn bên dưới để được hỗ trợ.
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-center space-y-2">
        <CheckCircleIcon className="w-9 h-9 text-emerald-400 mx-auto" weight="fill" />
        <p className="text-sm font-bold text-white">Đã xoá tài khoản</p>
        <p className="text-xs text-slate-300 leading-relaxed">
          Dữ liệu học tập, lịch sử trò chuyện và tài khoản ZenStudy đã bị xoá. Tài khoản
          Google của bạn vẫn còn nguyên.
        </p>
        <Link
          href="/"
          className="inline-block mt-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CircleNotchIcon className="w-3.5 h-3.5 animate-spin" />
          Đang kiểm tra đăng nhập…
        </div>
      ) : !user ? (
        <>
          <p className="text-xs text-slate-300 leading-relaxed">
            Đăng nhập bằng đúng tài khoản Google đã dùng cho ZenStudy để xoá tài khoản
            ngay tại đây. Dữ liệu sẽ bị xoá vĩnh viễn, không thể khôi phục.
          </p>
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={isSigningIn}
            className="min-h-[44px] w-full flex items-center justify-center gap-2 px-4 rounded-xl bg-white text-slate-950 text-sm font-bold active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {isSigningIn ? (
              <CircleNotchIcon className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Đăng nhập bằng Google
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-300 leading-relaxed">
            Đang đăng nhập:{" "}
            <span className="font-semibold text-white">{user.email}</span>
          </p>
          <label className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 w-3.5 h-3.5 accent-rose-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-300 leading-relaxed">
              Tôi hiểu dữ liệu sẽ bị xoá vĩnh viễn và không thể khôi phục.
            </span>
          </label>

          {isDeleting && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-slate-300">
              <CircleNotchIcon className="w-3.5 h-3.5 animate-spin text-rose-300 shrink-0" weight="bold" />
              <span>{step ? STEP_LABELS[step] : "Đang chuẩn bị…"}</span>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-400/30 text-[11px] text-rose-200 leading-relaxed"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!acknowledged || isDeleting}
            aria-busy={isDeleting || undefined}
            className="min-h-[44px] w-full flex items-center justify-center gap-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isDeleting ? (
              <CircleNotchIcon className="w-4 h-4 animate-spin" weight="bold" />
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
            {isDeleting ? "Đang xoá…" : "Xoá tài khoản vĩnh viễn"}
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Không cần chọn lại tài khoản Google: máy chủ xoá đúng tài khoản đang đăng
            nhập. Nếu cửa sổ đăng nhập bị chặn, hãy cho phép popup rồi thử lại.
          </p>
        </>
      )}
    </div>
  );
}
