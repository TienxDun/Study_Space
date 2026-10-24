import { DeviceMobileIcon } from "@phosphor-icons/react";

/** Chặn giao diện khi điện thoại đang nằm ngang.
 *  Ẩn/hiện thuần bằng CSS (cùng điều kiện với useIsMobile) nên hiện ngay
 *  từ khung hình đầu tiên, không phụ thuộc JS và không nhấp nháy. */
export function MobileLandscapeGuard() {
  return (
    <div
      className="mobile-landscape-guard fixed inset-0 z-[100000] flex-col items-center justify-center gap-5 bg-[#05070D] px-8 text-center text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Vui lòng xoay dọc điện thoại để tiếp tục"
    >
      <DeviceMobileIcon
        aria-hidden="true"
        weight="duotone"
        className="mobile-rotate-hint w-16 h-16 text-sky-300 drop-shadow-[0_0_24px_rgba(56,189,248,0.35)]"
      />
      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight text-balance">
          Vui lòng xoay dọc điện thoại
        </p>
        <p className="text-sm text-slate-400 text-balance">
          StudySpace được tối ưu cho màn hình dọc.
        </p>
      </div>
    </div>
  );
}
