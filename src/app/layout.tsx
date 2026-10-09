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
  maximumScale: 1,
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zenstudy.space";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ZenStudy Space - Không Gian Học Tập Tương Tác & Tập Trung 4K",
    template: "%s | ZenStudy Space",
  },
  description:
    "Không gian học tập ảo nhập vai đỉnh cao tại ZenStudy Space (zenstudy.space): 50+ bối cảnh Video 4K sống động, bộ trộn 20 âm thanh mưa & thiên nhiên thư giãn, nhạc Lo-fi chill, Pomodoro timer thông minh, Kanban to-do và ghi chú Markdown.",
  applicationName: "ZenStudy Space",
  authors: [{ name: "TienxDun", url: "https://github.com/TienxDun" }],
  creator: "TienxDun",
  publisher: "ZenStudy Space",
  category: "productivity",
  classification: "Educational Technology & Productivity Workspace",
  keywords: [
    "ZenStudy Space",
    "ZenStudy",
    "zenstudy.space",
    "zen study",
    "không gian học tập zen",
    "study space online",
    "không gian học tập trực tuyến",
    "web học bài tập trung",
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
    "virtual study space 4k",
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
    title: "ZenStudy Space - Không Gian Học Tập Tương Tác & Tập Trung 4K",
    description:
      "Tập trung học tập và làm việc hiệu quả với 50+ bối cảnh Video 4K, 20 âm thanh môi trường thư giãn, nhạc Lo-fi và đồng hồ Pomodoro tại ZenStudy Space.",
    images: [
      {
        url: `${basePath}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ZenStudy Space - Không Gian Học Tập Tương Tác & Tập Trung 4K",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZenStudy Space - Không Gian Học Tập Tương Tác & Tập Trung 4K",
    description:
      "Không gian học tập ảo nhập vai tại zenstudy.space với 50+ bối cảnh 4K, 20 âm thanh thiên nhiên, nhạc Lo-fi và Pomodoro.",
    images: [`${basePath}/og-image.png`],
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
    ],
    apple: [
      { url: `${basePath}/icon.svg`, sizes: "180x180", type: "image/svg+xml" },
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
          duration={3500}
          offset={{ top: 72, right: 24 }}
          style={{ "--width": "390px" } as React.CSSProperties}
          toastOptions={{
            className:
              "!items-start bg-[#14161f]/95 backdrop-blur-2xl border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-white rounded-2xl p-4 gap-3",
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
