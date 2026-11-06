"use client";

import { toast } from "sonner";

/**
 * Preview toàn bộ toast dùng trong UI mobile.
 * Toaster thật nằm ở src/app/layout.tsx, nên bấm là thấy đúng vị trí/option như production.
 * Muốn thấy mobileOffset: mở DevTools → device toolbar → chọn 390px.
 * Trang dev-only, bị scripts/strip-admin-export.mjs xoá khỏi bản web export.
 */

interface Demo {
  label: string;
  note?: string;
  fire: () => void;
}

const sections: { title: string; where: string; demos: Demo[] }[] = [
  {
    title: "Zen mode",
    where: "top-center · 2s · id cố định",
    demos: [
      {
        label: "Bật Zen",
        fire: () =>
          toast("Đã bật chế độ Zen (Chạm đúp để thoát)", {
            id: "zen-mode-toggle",
            duration: 2000,
            position: "top-center",
          }),
      },
      {
        label: "Thoát Zen",
        fire: () =>
          toast("Đã thoát chế độ Zen", {
            id: "zen-mode-toggle",
            duration: 2000,
            position: "top-center",
          }),
      },
    ],
  },
  {
    title: "Đổi bối cảnh",
    where: "top-center · 2s · id cố định",
    demos: [
      {
        label: "Đổi cảnh nhanh",
        fire: () =>
          toast("Đã đổi bối cảnh: Office Space", {
            id: "scene-quick-change",
            duration: 2000,
            position: "top-center",
          }),
      },
    ],
  },
  {
    title: "Hoàn tác xoá",
    where: "top-center mặc định · 5s · có action",
    demos: [
      {
        label: "Xoá thẻ công việc",
        note: "action Hoàn tác, clear state khi hết giờ",
        fire: () =>
          toast.success('Đã xóa "Ôn chương 3 — Đạo hàm"', {
            duration: 5000,
            action: { label: "Hoàn tác", onClick: () => toast.info("Đã khôi phục thẻ") },
          }),
      },
      {
        label: "Xoá ghi chú",
        fire: () =>
          toast.success('Đã xóa "Công thức lượng giác"', {
            duration: 5000,
            action: { label: "Hoàn tác", onClick: () => toast.success("Đã khôi phục ghi chú") },
          }),
      },
    ],
  },
  {
    title: "Chặn thoát",
    where: "bottom-center · 2s · id cố định",
    demos: [
      {
        label: "Nhấn back lần 1 (màn chính)",
        fire: () =>
          toast("Nhấn một lần nữa để thoát", {
            id: "back-to-exit-toast",
            duration: 2000,
            position: "bottom-center",
          }),
      },
      {
        label: "Nhấn back lần 1 (Zen)",
        fire: () =>
          toast("Nhấn Back lần nữa để thoát chế độ Zen", {
            id: "back-to-exit-zen-toast",
            duration: 2000,
            position: "bottom-center",
          }),
      },
    ],
  },
  {
    title: "Đồng bộ",
    where: "top-right mặc định · loading → success/error",
    demos: [
      {
        label: "Đồng bộ: loading → thành công",
        fire: () => {
          const id = toast.loading("Đang đồng bộ dữ liệu lên đám mây...");
          setTimeout(
            () => toast.success("Đã đồng bộ dữ liệu lên đám mây thành công!", { id }),
            1400
          );
        },
      },
      {
        label: "Đồng bộ: loading → lỗi",
        fire: () => {
          const id = toast.loading("Đang đồng bộ dữ liệu...");
          setTimeout(
            () =>
              toast.error("Chưa thể kết nối máy chủ, dữ liệu đã lưu an toàn trên máy.", { id }),
            1400
          );
        },
      },
    ],
  },
  {
    title: "Phòng học nhóm",
    where: "top-right mặc định",
    demos: [
      { label: "Vào/giơ tay", fire: () => toast.info("Minh Anh đang giơ tay ✋") },
      { label: "Rời phòng", fire: () => toast.info("Đã rời phòng học nhóm") },
      { label: "Copy link mời", fire: () => toast.success("Đã copy link mời") },
      { label: "Giới hạn phiên", fire: () => toast.error("Phiên học đã đạt giới hạn 120 phút") },
    ],
  },
  {
    title: "Trợ lý AI",
    where: "top-right mặc định · id chat-notice",
    demos: [
      { label: "Trả lời xong", fire: () => toast("Trợ lý đã trả lời xong", { id: "chat-notice", duration: 2500 }) },
    ],
  },
  {
    title: "Hệ thống",
    where: "top-right mặc định",
    demos: [
      { label: "Lưu thất bại (bộ nhớ đầy)", fire: () => toast.error("Bộ nhớ máy đầy, chưa lưu được") },
      { label: "Âm thanh", fire: () => toast.success("Đang phát: Lo-fi Focus") },
      { label: "Pomodoro xong", fire: () => toast.success("Hoàn thành phiên Pomodoro! Nghỉ 5 phút nhé") },
      { label: "Chưa đăng nhập", fire: () => toast.info("Đăng nhập Google để tự động sao lưu dữ liệu lên đám mây nhé.") },
    ],
  },
  {
    title: "Kiểu cơ bản",
    where: "để so sánh style chung",
    demos: [
      { label: "success", fire: () => toast.success("Đã lưu vào danh sách") },
      { label: "error", fire: () => toast.error("Không thể copy link") },
      { label: "info", fire: () => toast.info("Đã dừng phát đài này") },
      { label: "warning", fire: () => toast.warning("Bạn đang dùng bản xem trước") },
      { label: "plain", fire: () => toast("Thông báo không icon") },
    ],
  },
];

export default function DevToastsPage() {
  const runAll = () => {
    const all = sections.flatMap((s) => s.demos);
    toast.dismiss();
    all.forEach((d, i) => setTimeout(d.fire, i * 1600));
  };

  return (
    <main className="min-h-dvh bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Dev · Mobile UI
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Preview toast mobile</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Toaster thật ở <code>src/app/layout.tsx</code> — bấm là ra đúng vị trí, thời lượng và
            action như trong app. Để thấy <code>mobileOffset</code>, mở DevTools → device toolbar →
            rộng 390px; trên desktop toast hiện theo <code>offset.top = 72</code>.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runAll}
            className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-950 active:scale-95"
          >
            Chạy lần lượt tất cả
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss()}
            className="h-9 rounded-xl border border-white/15 bg-white/5 px-3.5 text-xs font-semibold text-slate-200 active:scale-95"
          >
            Xoá hết toast
          </button>
          <span className="text-[11px] text-slate-500">
            {sections.reduce((n, s) => n + s.demos.length, 0)} kiểu toast
          </span>
        </div>

        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <span className="font-mono text-[10.5px] text-slate-500">{section.where}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {section.demos.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={demo.fire}
                  title={demo.note}
                  className="min-h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.12] active:scale-95"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </section>
        ))}

        <p className="pb-6 text-[11px] leading-relaxed text-slate-500">
          Ghi chú: 2 toast chặn thoát vẫn ở <code>bottom-center</code> (đúng như code hiện tại). Muốn
          đồng bộ lên top thì sửa <code>useMobileStack.ts</code>.
        </p>
      </div>
    </main>
  );
}
