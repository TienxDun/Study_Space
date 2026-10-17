"use client";

import { useEffect, useState } from "react";

// Biết khi nào là màn nhỏ (điện thoại). Mặc định 640px theo sm: của Tailwind.
// Dùng matchMedia + sự kiện "change" thay cho resize: callback chỉ chạy đúng
// lúc vượt qua breakpoint, không phải mỗi pixel kéo cửa sổ.
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
