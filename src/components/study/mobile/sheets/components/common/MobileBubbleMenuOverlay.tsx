"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface MobileBubbleMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nút 3 chấm làm mốc neo menu ngay bên dưới nó */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Khóa duy nhất theo từng menu để AnimatePresence chạy đúng hiệu ứng đóng */
  menuKey: string;
  children: React.ReactNode;
}

/**
 * Menu nổi của card trong sheet mobile: luôn portal thẳng ra document.body.
 *
 * Vì thẻ card mang class `sheet-stagger-item` nên nó có transform (dù chỉ là ma trận
 * đơn vị), biến nó thành containing block của mọi phần tử `position: fixed` bên trong.
 * Hệ quả: lớp nền bắt chạm chỉ phủ đúng ô của thẻ card, chạm ra chỗ khác trong sheet
 * không đóng được menu mà còn lọt thao tác xuống phần tử bên dưới.
 * Portal ra body giúp lớp nền phủ đúng toàn màn hình và menu neo đúng dưới nút 3 chấm.
 */
export function MobileBubbleMenuOverlay({
  isOpen,
  onClose,
  anchorRef,
  menuKey,
  children,
}: MobileBubbleMenuOverlayProps) {
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setAnchor(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, [isOpen, anchorRef]);

  if (typeof document === "undefined" || !document.body) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && anchor && (
        <>
          {/* Lớp nền mờ tối phủ toàn màn hình bắt chạm ngoài menu để tự đóng */}
          <motion.div
            key={`${menuKey}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/45 cursor-pointer touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            role="button"
            tabIndex={-1}
            aria-label="Đóng menu tùy chọn"
          />

          {/* Khung menu thả xuống phong cách kính mờ tối giản & hiện đại */}
          <motion.div
            key={menuKey}
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ top: anchor.top, right: anchor.right }}
            className="fixed z-[71] w-max min-w-[210px] max-w-[calc(100vw-1.5rem)] p-1.5 rounded-2xl surface-frost border shadow-[0_16px_40px_rgba(0,0,0,0.85)] text-white select-none"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
