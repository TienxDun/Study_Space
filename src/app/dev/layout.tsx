import type { ReactNode } from "react";

/** Ẩn lớp splash tĩnh của trang chủ (root layout luôn render nó).
 *  Dưới 640px lớp này phủ kín màn hình và chỉ MobileSplashScreen mới gỡ,
 *  mà trang /dev không render component đó -> DevTools 390px thành màn đen.
 *  Dùng CSS thay vì xoá DOM để không lệch hydrate. */
const HIDE_PRE_SPLASH = `#pre-splash{display:none}`;

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HIDE_PRE_SPLASH }} />
      {children}
    </>
  );
}
