import type { NextConfig } from "next";

// Static site: assets on R2, admin/api local only (git-ignored).
// Export to out/ only on Cloudflare Pages builds.
// Local dev/build keeps server mode so /admin + /api still run.
const isCloudflarePages =
  process.env.CF_PAGES === "1" ||
  process.env.CF_PAGES === "true" ||
  typeof process.env.CF_PAGES_BRANCH !== "undefined";
const isStaticExport = isCloudflarePages;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath } : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "framer-motion", "sonner"],
  },
  trailingSlash: true,
};

export default nextConfig;
