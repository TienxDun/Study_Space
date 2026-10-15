"use client";

import { useEffect, useState } from "react";

// Biết khi nào là màn nhỏ (điện thoại). Mặc định 640px theo sm: của Tailwind.
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}
