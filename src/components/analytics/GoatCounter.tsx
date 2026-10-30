"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getGoatCounterConfig,
  isLocalHostname,
  shouldTrackPath,
} from "@/lib/analytics";

/**
 * Tải count.js một lần; count.js tự đếm pageview đầu tiên.
 * Các lần điều hướng nội bộ sau đó (App Router) đếm tay để không bỏ sót.
 */
export function GoatCounter() {
  const config = getGoatCounterConfig();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!config) return;
    if (process.env.NODE_ENV !== "production") return;
    if (isLocalHostname(window.location.hostname)) return;
    setEnabled(true);
  }, [config]);

  useEffect(() => {
    if (!enabled || !pathname) return;
    const prev = lastPathRef.current;
    lastPathRef.current = pathname;
    // Lần đầu để count.js tự đếm khi script tải xong.
    if (prev === null || prev === pathname) return;
    if (!shouldTrackPath(pathname)) return;
    window.goatcounter?.count({ path: pathname, title: document.title });
  }, [enabled, pathname]);

  if (!config || !enabled) return null;

  const scriptProps = {
    src: config.scriptSrc,
    strategy: "lazyOnload" as const,
    "data-goatcounter": config.endpoint,
  };
  return <Script {...scriptProps} />;
}
