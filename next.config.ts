import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Project pages: https://tienxdun.github.io/Study_Space
  // Bỏ basePath nếu chuyển sang custom domain / Vercel.
  basePath: "/Study_Space",
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "sonner"],
  },
  trailingSlash: true,
};

export default nextConfig;
