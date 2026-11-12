"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ChatCircleDotsIcon,
  CircleNotchIcon,
  ImageSquareIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { GoogleIcon, useAuth } from "@/components/study/auth";
import { MobileSheetShell } from "@/components/study/mobile/sheets/core/MobileSheetShell";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  submitFeedback,
  type FeedbackKind,
} from "@/lib/feedback";
import {
  prepareFeedbackImage,
  type PreparedFeedbackImage,
} from "@/lib/feedback-image";

interface FeedbackSurfaceProps {
  onClose: () => void;
}

// Hộp thoại góp ý/báo lỗi chung (P3.16).
// Desktop: hộp kính tối giữa màn hình. Mobile: khay đáy dùng chung MobileSheetShell
// để khớp các sheet khác (kính mờ, viền sáng, nút Zen, nằm trên thanh điều hướng).
export function FeedbackDialog({ onClose }: FeedbackSurfaceProps) {
  return <FeedbackPanel variant="modal" isOpen onClose={onClose} />;
}

interface FeedbackSheetProps extends FeedbackSurfaceProps {
  isOpen: boolean;
  onBack?: () => void;
  backLabel?: string;
}

export function FeedbackSheet({ isOpen, onClose, onBack, backLabel }: FeedbackSheetProps) {
  return (
    <FeedbackPanel
      variant="sheet"
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
    />
  );
}

interface FeedbackPanelProps extends FeedbackSurfaceProps {
  variant: "modal" | "sheet";
  isOpen: boolean;
  onBack?: () => void;
  backLabel?: string;
}

function FeedbackPanel({ variant, isOpen, onClose, onBack, backLabel }: FeedbackPanelProps) {
  const { user, loading, isSigningIn, signIn, getToken } = useAuth();
  const [kind, setKind] = useState<FeedbackKind | "">("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState<PreparedFeedbackImage | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [imageNotice, setImageNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const close = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  const dropImage = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImage(null);
    setImageNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Khay đáy giữ trong DOM sau lần mở đầu (như các sheet khác): đóng thì xoá form.
  useEffect(() => {
    if (variant !== "sheet" || isOpen) return;
    setKind("");
    setMessage("");
    setContact("");
    setSubmitting(false);
    setPreparingImage(false);
    dropImage();
  }, [variant, isOpen, dropImage]);

  // Ảnh xem trước dùng blob URL: thu hồi khi rời trang để không giữ bộ nhớ.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const handlePickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageNotice("");
    setPreparingImage(true);
    const result = await prepareFeedbackImage(file);
    setPreparingImage(false);
    if (!result.ok) {
      setImageNotice(result.notice);
      return;
    }
    dropImage();
    previewUrlRef.current = result.image.previewUrl;
    setImage(result.image);
  };

  // Modal tự bắt Esc; khay đáy đã được MobileSheetShell lo.
  useEffect(() => {
    if (variant !== "modal") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, close]);

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < FEEDBACK_MESSAGE_MIN;
  const canSubmit = Boolean(kind) && trimmed.length >= FEEDBACK_MESSAGE_MIN && Boolean(user);

  const handleSubmit = async () => {
    if (!canSubmit || !kind || submitting || preparingImage) return;
    setSubmitting(true);
    const result = await submitFeedback({
      getToken,
      kind,
      message: trimmed,
      contact,
      name: user?.displayName || "",
      image: image?.blob,
    });
    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.notice, { id: "feedback-notice", duration: 6000 });
      return;
    }
    toast.success("Đã gửi góp ý, cảm ơn bạn!", { id: "feedback-notice", duration: 6000 });
    onClose();
  };

  const fields = (
    <>
      {!loading && !user ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-white/60">Đăng nhập để gửi góp ý.</p>
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={isSigningIn}
            className="relative group overflow-hidden w-full px-5 py-2.5 rounded-full text-xs font-bold text-slate-950 bg-white hover:bg-slate-100 shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {isSigningIn ? (
              <>
                <CircleNotchIcon className="w-4 h-4 animate-spin text-slate-700" />
                <span>Đang mở Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Đăng nhập với Google</span>
              </>
            )}
          </button>
        </div>
      ) : null}

      <fieldset className="mt-4" disabled={submitting}>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Loại góp ý">
          {FEEDBACK_KINDS.map((item) => {
            const checked = kind === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setKind(item.value)}
                className={cn(
                  "h-10 rounded-xl border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  checked
                    ? "border-emerald-300/50 bg-emerald-500/20 text-white"
                    : "border-white/10 bg-black/30 text-zinc-300 hover:border-white/20 hover:text-white"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <textarea
          aria-label="Nội dung góp ý"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={submitting}
          maxLength={FEEDBACK_MESSAGE_MAX}
          rows={4}
          placeholder="Mô tả lỗi hoặc điều bạn muốn thêm"
          className="lg-input lg-input-inset w-full resize-none px-3 py-2.5 text-sm text-white disabled:opacity-60"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className={tooShort ? "text-amber-300" : "text-white/45"}>
            {tooShort ? `Cần thêm ${FEEDBACK_MESSAGE_MIN - trimmed.length} ký tự` : ""}
          </span>
          <span className="text-white/45 tabular-nums">
            {message.length}/{FEEDBACK_MESSAGE_MAX}
          </span>
        </div>
      </div>

      <input
        type="email"
        inputMode="email"
        aria-label="Email liên hệ (không bắt buộc)"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        disabled={submitting}
        maxLength={FEEDBACK_CONTACT_MAX}
        placeholder="Email liên hệ (không bắt buộc)"
        className="lg-input lg-input-inset mt-3 h-10 w-full px-3 text-sm text-white disabled:opacity-60"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void handlePickImage(e)}
        className="hidden"
        tabIndex={-1}
      />
      <div className="mt-3">
        {image ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 p-2">
            <span
              role="img"
              aria-label="Ảnh đính kèm"
              className="h-11 w-11 shrink-0 rounded-lg bg-cover bg-center"
              style={{ backgroundImage: `url("${image.previewUrl}")` }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/80">{image.name}</p>
              <p className="text-[11px] text-white/45 tabular-nums">
                {Math.max(1, Math.round(image.blob.size / 1024))} KB
              </p>
            </div>
            <button
              type="button"
              onClick={dropImage}
              disabled={submitting}
              aria-label="Bỏ ảnh đính kèm"
              className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <XIcon size={13} weight="bold" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting || preparingImage}
            className="h-10 w-full rounded-xl border border-dashed border-white/15 bg-black/20 text-xs font-medium text-zinc-300 hover:border-white/25 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {preparingImage ? (
              <CircleNotchIcon size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <ImageSquareIcon size={15} aria-hidden="true" />
            )}
            {preparingImage ? "Đang nén ảnh…" : "Đính kèm ảnh (tối đa 1 MB)"}
          </button>
        )}
        {imageNotice ? (
          <p className="mt-1.5 text-[11px] leading-snug text-amber-300">{imageNotice}</p>
        ) : null}
      </div>
    </>
  );

  const actions = (
    <>
      <button
        type="button"
        onClick={close}
        disabled={submitting}
        className="h-10 px-3.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
      >
        Hủy
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit || submitting || preparingImage}
        className={cn(
          "h-10 px-4 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
          submitting
            ? "bg-emerald-500 text-slate-950 opacity-70 cursor-wait"
            : canSubmit
              ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-[0.98] cursor-pointer"
              : "bg-white/[0.06] text-white/35 cursor-not-allowed"
        )}
      >
        {submitting ? "Đang gửi…" : "Gửi"}
      </button>
    </>
  );

  if (variant === "sheet") {
    return (
      <MobileSheetShell
        isOpen={isOpen}
        onClose={close}
        onBack={onBack}
        backLabel={backLabel}
        sheetId="feedback"
        title="Gửi góp ý"
        maxHeightClassName="h-auto max-h-[82dvh]"
        footer={
          <div className="flex items-center justify-end gap-2 px-4 py-3">{actions}</div>
        }
      >
        {/* my-auto: khay thường ôm nội dung, còn chế độ mở rộng thì form đứng giữa
            thay vì dồn lên trên và để khoảng trống lớn phía dưới. */}
        <div className="my-auto flex flex-col px-4 py-3 text-white">
          <p className="text-[11px] leading-relaxed text-white/50">
            Chỉ quản trị viên ZenStudy đọc được.
          </p>
          {fields}
        </div>
      </MobileSheetShell>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gửi góp ý hoặc báo lỗi"
      onClick={close}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto custom-study-scroll rounded-2xl border border-white/12 bg-[#0b0f16]/98 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/10 border border-sky-400/25 text-sky-300">
              <ChatCircleDotsIcon size={17} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Gửi góp ý</h2>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Chỉ quản trị viên ZenStudy đọc được.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            aria-label="Đóng"
            title="Đóng (Esc)"
            className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <XIcon size={15} weight="bold" aria-hidden="true" />
          </button>
        </div>
        {fields}
        <div className="mt-4 flex items-center justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
