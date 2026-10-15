import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return {
    name: "ZenStudy Space - Không Gian Học Tập Tương Tác & Tập Trung",
    short_name: "ZenStudy",
    description:
      "Không gian học tập tương tác nhập vai tại zenstudy.space với 30+ bối cảnh video sống động, 20 âm thanh môi trường thư giãn, Pomodoro và Lo-fi chill.",
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#090d16",
    icons: [
      {
        src: `${basePath}/favicon.ico`,
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: `${basePath}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icon-maskable-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: `${basePath}/og-image.png`,
        sizes: "1200x630",
        type: "image/png",
      },
    ],
  };
}
