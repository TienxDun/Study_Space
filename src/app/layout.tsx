import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "sonner";
import { GoatCounter } from "@/components/analytics/GoatCounter";
import { StudyJsonLd } from "@/components/study/seo/StudyJsonLd";
import { MOBILE_SPLASH_ENABLED } from "@/lib/mobile-splash-flag";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
});

export const viewport: Viewport = {
  themeColor: "#090d16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zenstudy.space";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ZenStudy Space - Không Gian Học Bài Tập Trung & Nhạc Lo-fi Chill",
    template: "%s | ZenStudy Space",
  },
  description:
    "Web học bài tập trung miễn phí: 30+ bối cảnh sống động, bộ trộn 20 âm thanh thiên nhiên thư giãn, nhạc Lo-fi chill, đồng hồ Pomodoro và ghi chú thông minh.",
  applicationName: "ZenStudy Space",
  authors: [{ name: "TienxDun", url: "https://github.com/TienxDun" }],
  creator: "TienxDun",
  publisher: "ZenStudy Space",
  category: "productivity",
  classification: "Educational Technology & Productivity Workspace",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  keywords: [
    "ZenStudy Space",
    "ZenStudy",
    "zenstudy.space",
    "web học bài tập trung",
    "không gian học tập trực tuyến",
    "không gian học tập ảo",
    "virtual study space",
    "study with me việt nam",
    "nhạc lofi học bài",
    "tiếng mưa học bài",
    "bộ trộn âm thanh mưa",
    "tiếng ồn trắng học tập",
    "white noise online",
    "đồng hồ pomodoro online",
    "pomodoro timer",
    "bấm giờ học tập",
    "kanban task học tập",
    "ghi chú markdown online",
    "lofi chill study room",
    "tập trung học tập",
    "chống trì hoãn",
    "ambient sound mixer",
    "pomodoro study space",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: `${siteUrl}/`,
    siteName: "ZenStudy Space",
    title: "ZenStudy Space - Không Gian Học Bài Tập Trung & Nhạc Lo-fi Chill",
    description:
      "Web học bài tập trung miễn phí với 30+ bối cảnh sống động, 20 âm thanh mưa & thiên nhiên, nhạc Lo-fi chill và đồng hồ Pomodoro.",
    images: [
      {
        url: `${siteUrl}${basePath}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ZenStudy Space - Không Gian Học Bài Tập Trung & Nhạc Lo-fi Chill",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZenStudy Space - Không Gian Học Bài Tập Trung & Nhạc Lo-fi Chill",
    description:
      "Web học bài tập trung miễn phí với 30+ bối cảnh sống động, 20 âm thanh mưa & thiên nhiên, nhạc Lo-fi chill và đồng hồ Pomodoro.",
    images: [`${siteUrl}${basePath}/og-image.png`],
    creator: "@TienxDun",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico`, sizes: "any" },
      { url: `${basePath}/icon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  },
};

// Khung phải khớp từng pixel với MobileSplashScreen: logo 80px + lề 20px + chữ 24px
// + lề 8px + phụ đề 11px = 143px. Lệch khung là logo nhảy khi hai lớp bàn giao nhau.
const PRE_SPLASH_CSS = `#pre-splash{position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#05070D;color:#fff;pointer-events:none;font-family:var(--font-be-vietnam),system-ui,-apple-system,"Segoe UI",sans-serif}
#pre-splash .ps-body{display:flex;flex-direction:column;align-items:center;opacity:0;transition:opacity .2s ease-out}
#pre-splash .ps-logo{width:80px;height:80px;margin-bottom:20px;display:flex;align-items:center;justify-content:center}
#pre-splash .ps-logo img{width:72px;height:72px;object-fit:contain}
#pre-splash .ps-title{margin:0;font-size:24px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;line-height:1}
#pre-splash .ps-zen{color:#fff}
#pre-splash .ps-study{color:#38bdf8}
#pre-splash .ps-sub{margin:8px 0 0;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;line-height:1}
@media (min-width:640px){#pre-splash{display:none}}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Bản shell Android luôn chạy layout mobile: gắn dấu mobile-scope ngay từ
  // HTML tĩnh để chất liệu surface mobile có hiệu lực từ khung hình đầu.
  const isMobileShellBuild = process.env.NEXT_PUBLIC_MOBILE_SHELL === "1";

  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} font-sans h-full antialiased${
        isMobileShellBuild ? " mobile-scope" : ""
      }`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden bg-[#090d16] text-white">
        {/* Lớp Splash tĩnh: vẽ ngay từ HTML, không chờ JavaScript, để khỏi chớp màn hình
            trong khoảng splash Android tắt cho tới khi Splash React xuất hiện */}
        {MOBILE_SPLASH_ENABLED && (
          <>
            <style dangerouslySetInnerHTML={{ __html: PRE_SPLASH_CSS }} />
            <Script src={`${basePath}/pre-splash-gate.js`} strategy="beforeInteractive" />
            <div id="pre-splash" aria-hidden="true" suppressHydrationWarning>
              <div className="ps-body">
                <div className="ps-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${basePath}/brand/zenstudy-logo-icon.svg`}
                    alt=""
                    width={72}
                    height={72}
                  />
                </div>
                <p className="ps-title">
                  <span className="ps-zen">ZEN</span>
                  <span className="ps-study">STUDY</span>
                </p>
                <p className="ps-sub">Không gian học tập &amp; làm việc sâu</p>
              </div>
            </div>
          </>
        )}
        <StudyJsonLd siteUrl={siteUrl} />
        {children}
        <GoatCounter />
        <Toaster
          theme="dark"
          position="top-right"
          duration={1500}
          closeButton
          swipeDirections={["left", "right", "bottom"]}
          offset={{ top: 72, right: 24 }}
          style={{ "--width": "390px" } as React.CSSProperties}
          toastOptions={{
            className:
              "!items-start bg-black/40 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white rounded-2xl p-4 gap-3",
            // Tô thẳng vào thẻ để thắng màu nền mặc định của thư viện
            style: {
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow:
                "0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
            },
            descriptionClassName: "text-slate-300 text-xs mt-1 leading-relaxed",
            classNames: {
              icon: "mt-0.5 shrink-0",
              title: "font-semibold text-sm",
            },
          }}
        />
      </body>
    </html>
  );
}
