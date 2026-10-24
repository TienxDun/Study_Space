"use client";

import { useState } from "react";
import Image from "next/image";
import {
  XIcon,
  WarningIcon,
  GlobeIcon,
  BriefcaseIcon,
  EnvelopeSimpleIcon,
  CoffeeIcon,
} from "@phosphor-icons/react";
import { siFacebook, siGithub } from "simple-icons";
import { ModalShell } from "../ui/ModalShell";
import { IconBtn } from "../ui/IconBtn";
import { BrandIcon } from "../ui/BrandIcon";
import { ZenStudyLogo } from "./brand/ZenStudyLogo";
import { APP_VERSION_LABEL } from "@/lib/version";

const FacebookBrandIcon = ({ className }: { className?: string }) => (
  <BrandIcon path={siFacebook.path} className={className} />
);
const GithubBrandIcon = ({ className }: { className?: string }) => (
  <BrandIcon path={siGithub.path} className={className} />
);


/**
 * TODO (bạn Dũng sửa ở đây):
 * - Câu chuyện bên dưới là mình viết nháp, bạn sửa lại cho đúng ý mình.
 * - Khi nào có link donate thì dán vào chỗ donateUrl, nút sẽ tự sáng lên.
 * - Khi nào gửi ảnh thì thay chỗ AVATAR thành <img ...> (mình để sẵn chú thích).
 */
const ABOUT_AUTHOR = {
  name: "Lều Tiến Dũng",
  role: "Frontend Developer · Sinh viên năm 4 HUFLIT",
  story: [
    "Mình là Dũng, sinh viên năm 4 ngành Kỹ thuật phần mềm. Lúc ôn thi mình hay mất tập trung vì phải mở nhiều tab cùng lúc: nhạc một tab, đồng hồ một tab, ghi chú một chỗ khác.",
    "Mình ước có một trang gom hết lại: hình nền đẹp để có cảm hứng, nhạc chill, đồng hồ học theo kiểu Pomodoro, chỗ ghi việc và ghi chú. Thế là mình tự làm ra ZenStudy Space.",
    "Web này mình làm miễn phí cho mọi người cùng dùng. Chúc bạn học tập vui vẻ và tập trung mỗi ngày.",
  ],
  contacts: [
    { label: "Portfolio", href: "https://www.tienxdun.id.vn/", icon: GlobeIcon },
    { label: "Facebook", href: "https://www.facebook.com/tienxdun", icon: FacebookBrandIcon },
    { label: "GitHub", href: "https://github.com/TienxDun", icon: GithubBrandIcon },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/leutiendung", icon: BriefcaseIcon },
    { label: "Email", href: "mailto:leutiendung.htt@gmail.com", icon: EnvelopeSimpleIcon },
  ] as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[],
  donateUrl: "",
};

const FEATURES: { name: string; desc: string; shortcut?: string }[] = [
  { name: "Không gian làm việc", desc: "Đổi hình nền, video để có cảm hứng học", shortcut: "B" },
  { name: "Đài phát", desc: "Nghe YouTube, Spotify ngay trong trang", shortcut: "E" },
  { name: "Bộ trộn âm thanh", desc: "Trộn tiếng mưa, thiên nhiên, nhạc chill", shortcut: "P" },
  { name: "Đồng hồ Pomodoro", desc: "Học 25 phút, nghỉ 5 phút, lặp lại", shortcut: "T" },
  { name: "Kế hoạch học tập", desc: "Ghi việc cần làm, bấm theo dõi từng việc", shortcut: "K" },
  { name: "Ghi chép nhanh", desc: "Ghi chú lẹ, lưu trên máy và tự đồng bộ khi đăng nhập", shortcut: "N" },
  { name: "Phòng học nhóm", desc: "Học chung với bạn bè qua gọi video", shortcut: "G" },
  { name: "Trợ lý học tập AI", desc: "Hỏi đáp bài tập, gợi ý ôn thi và tóm tắt", shortcut: "C" },
  { name: "Chế độ Zen", desc: "Ẩn hết nút để chỉ còn bạn và bài học", shortcut: "Z" },
  { name: "Toàn màn hình", desc: "Phóng to hết cỡ cho đỡ xao nhãng", shortcut: "F" },
];

const NOTES: string[] = [
  "Mặc định mọi thứ được lưu ngay trên máy để dùng offline. Đăng nhập Google để tự động sao lưu và đồng bộ cài đặt, ghi chú, việc cần làm, thống kê tập trung sang các thiết bị khác.",
  "Trợ lý AI trả lời độc lập từng câu để phản hồi siêu nhanh (khác với ChatGPT/Gemini nhớ đoạn chat dài). Hãy bật nút [🧠 Nhớ hội thoại] trên góc chat khi cần AI kết nối câu trước để giải tiếp.",
  "Thông tin do AI cung cấp có thể có sai sót hoặc nhầm lẫn, bạn hãy luôn đối chiếu lại với sách giáo khoa và tài liệu học tập chính thống.",
  "Trợ lý học tập AI cần đăng nhập Google để hỏi bài và lưu lịch sử hội thoại an toàn.",
  "Đồng hồ Pomodoro đang chạy mà lỡ tải lại trang (F5) thì vẫn chạy tiếp, không mất giờ.",
  "Xem video nền và nghe nhạc cần có mạng. Mạng yếu thì nên chọn hình tĩnh cho nhẹ.",
  "Muốn biết hết phím bấm, mở bảng phím tắt trong thanh trên cùng.",
];

function AboutSection({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
      <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
        {icon}
        <span>{title}</span>
      </h4>
      {children}
    </section>
  );
}

export interface StudyAboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Bảng giới thiệu: người làm web + cách dùng + điều cần biết. */
export const StudyAboutModal = ({ isOpen, onClose }: StudyAboutModalProps) => {
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelKey="about-modal"
      backdropClassName="hidden sm:block z-[60] bg-black/60 backdrop-blur-md"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      panelClassName="hidden sm:block fixed inset-0 m-auto z-[70] w-[calc(100%-2rem)] max-w-[560px] h-fit max-h-[min(680px,calc(100vh-64px))] glass-panel hover:bg-black/45 text-white overflow-y-auto custom-study-scroll p-5 sm:p-6 space-y-4 transform-gpu will-change-[transform,opacity]"
      ariaLabel="Giới thiệu website"
    >
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />
      {/* Đầu bảng: logo + tên web */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <ZenStudyLogo variant="icon" className="h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white tracking-wide text-balance">
              Giới thiệu ZenStudy Space
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Không gian học tập giúp bạn tập trung hơn · <span className="font-mono text-emerald-400/90 font-semibold">{APP_VERSION_LABEL}</span>
            </p>
          </div>
        </div>
        <IconBtn
          onClick={onClose}
          title="Đóng (Esc)"
          icon={<XIcon className="w-4 h-4" />}
          className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
        />
      </div>

      {/* Thẻ tác giả: ảnh + tên + chuyện + nút liên hệ */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-500/15 via-white/[0.03] to-transparent p-4 text-center space-y-3">
        <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent pointer-events-none" />
        <button
          type="button"
          onClick={() => setIsAvatarOpen(true)}
          title="Bấm để xem ảnh to"
          aria-label="Xem ảnh to của Lều Tiến Dũng"
          className="mx-auto block rounded-full cursor-zoom-in transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
        >
          <Image
            src="/authors/leu-tien-dung.webp"
            alt="Ảnh của Lều Tiến Dũng"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover object-[center_12%] border-2 border-emerald-400/50 shadow-[0_0_24px_rgba(52,211,153,0.4)] pointer-events-none"
          />
        </button>
        {isAvatarOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ảnh to của Lều Tiến Dũng"
            onClick={() => setIsAvatarOpen(false)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 cursor-zoom-out"
          >
            <div
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src="/authors/leu-tien-dung.webp"
                alt="Ảnh to của Lều Tiến Dũng"
                width={360}
                height={360}
                className="w-auto h-auto max-w-[min(360px,85vw)] max-h-[75vh] rounded-2xl object-contain border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
              />
              <button
                type="button"
                onClick={() => setIsAvatarOpen(false)}
                title="Thu lại"
                aria-label="Thu ảnh lại"
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black/70 border border-white/25 text-white flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div>
          <div className="text-sm font-extrabold text-white">{ABOUT_AUTHOR.name}</div>
          <div className="text-xs text-emerald-300 font-medium">{ABOUT_AUTHOR.role}</div>
        </div>
        <div className="space-y-2 text-left">
          {ABOUT_AUTHOR.story.map((line, idx) => (
            <p key={idx} className="text-xs text-slate-300 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {ABOUT_AUTHOR.contacts.map((c) => {
            const Icon = c.icon;
            const isMail = c.href.startsWith("mailto:");
            return (
              <a
                key={c.label}
                href={c.href}
                {...(isMail ? {} : { target: "_blank", rel: "noreferrer" })}
                title={c.label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 hover:text-white transition-[color,background-color,border-color,transform] active:scale-95"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.label}</span>
              </a>
            );
          })}
          {ABOUT_AUTHOR.donateUrl ? (
            <a
              href={ABOUT_AUTHOR.donateUrl}
              target="_blank"
              rel="noreferrer"
              title="Ủng hộ tác giả"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 transition-[color,background-color,border-color,transform] active:scale-95"
            >
              <CoffeeIcon className="w-3.5 h-3.5" />
              <span>Mời mình ly cà phê</span>
            </a>
          ) : (
            <span
              title="Sắp có link ủng hộ"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/[0.03] border border-white/[0.06] text-slate-400"
            >
              <CoffeeIcon className="w-3.5 h-3.5" />
              <span>Ủng hộ (sắp có)</span>
            </span>
          )}
        </div>
      </div>

      {/* Các tính năng chính */}
      <AboutSection title="Web này có gì">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.name}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200">{f.name}</div>
                <div className="text-xs text-slate-400">{f.desc}</div>
              </div>
              {f.shortcut && (
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-slate-300 font-semibold border border-white/10 shrink-0">
                  {f.shortcut}
                </kbd>
              )}
            </div>
          ))}
        </div>
      </AboutSection>

      {/* Điều cần biết */}
      <AboutSection
        icon={<WarningIcon className="w-3.5 h-3.5 text-amber-400" />}
        title="Điều cần biết khi dùng"
      >
        <ul className="space-y-1.5">
          {NOTES.map((n, idx) => (
            <li
              key={idx}
              className="text-xs text-slate-300 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] leading-relaxed"
            >
              {n}
            </li>
          ))}
        </ul>
      </AboutSection>
    </ModalShell>
  );
};
