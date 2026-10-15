import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "sonner";
import { StudyJsonLd } from "@/components/study/seo/StudyJsonLd";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden bg-[#090d16] text-white">
        <StudyJsonLd siteUrl={siteUrl} />
        {children}
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
