import type { NextConfig } from "next";

// Chỉ bật basePath khi build tự động trên GitHub Actions cho GitHub Pages.
// Khi chạy ở Local (npm run dev) hoặc deploy Vercel / Custom domain sẽ chạy trực tiếp tại root "/".
const isGithubPages = process.env.GITHUB_ACTIONS === "true" && !process.env.VERCEL;
const basePath = isGithubPages ? "/Study_Space" : "";

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath ? { basePath } : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "sonner"],
  },
  trailingSlash: true,
};

export default nextConfig;
