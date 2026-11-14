"use client";

import { useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Scene } from "./study-types";
import { devWarn } from "@/lib/logger";
import { useRenderTrace } from "@/components/study/mobile/perf/useRenderTrace";

export interface StudyBackgroundProps {
  scene: Scene;
  isBlurActive?: boolean;
  /** Điện thoại: tạm dừng video khi bảng che gần hết màn hình. */
  isMobile?: boolean;
  onLoaded?: () => void;
}

/** Nền nhập vai: crossfade video/ảnh + fallback thumbnail + Spatial Vignette & GPU-accelerated Depth Blur. */
export const StudyBackground = memo(function StudyBackground({
  scene,
  isBlurActive = false,
  isMobile = false,
  onLoaded,
}: StudyBackgroundProps) {
  useRenderTrace("background props", { scene, isBlurActive, isMobile, onLoaded });
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    setHasVideoError(false);
  }, [scene.id]);

  // Tab/app bị ẩn (chuyển app, khoá màn hình) thì dừng decode video nền.
  // Nhiều máy vẫn giải mã tiếp khi ẩn tab, đốt pin/GPU mà chẳng ai xem.
  // Trên điện thoại, khi sheet che gần hết màn hình thì cũng dừng luôn: lớp
  // kính tĩnh bên dưới đã phủ kín video nên không ai thấy khung hình dừng.
  //
  // Tìm video theo data-scene-id thay vì giữ ref: AnimatePresence giữ video cảnh cũ
  // thêm 0.5s để crossfade, và khi nó unmount React sẽ gán ref = null cho video phần tử.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncPlayback = () => {
      const video = Array.from(
        document.querySelectorAll<HTMLVideoElement>("video[data-scene-id]")
      ).find((el) => el.dataset.sceneId === scene.id);
      if (!video) return;
      if (document.hidden || (isMobile && isBlurActive)) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [scene.id, hasVideoError, isMobile, isBlurActive]);

  // Thông báo sẵn sàng khi bối cảnh đã có hình ảnh hiển thị (Ảnh gốc hoặc Thumbnail Poster của Video)
  useEffect(() => {
    let isCancelled = false;
    if (typeof window !== "undefined") {
      const targetUrl =
        scene.type === "IMAGE" || hasVideoError
          ? hasVideoError
            ? scene.thumbnailUrl
            : scene.bgUrl
          : scene.thumbnailUrl;

      if (targetUrl) {
        const img = new Image();
        img.src = targetUrl;
        if (img.complete) {
          if (!isCancelled) onLoaded?.();
        } else {
          img.onload = () => {
            if (!isCancelled) onLoaded?.();
          };
          img.onerror = () => {
            if (!isCancelled) onLoaded?.();
          };
        }
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [scene.bgUrl, scene.thumbnailUrl, scene.type, hasVideoError, onLoaded]);

  return (
    <div className="absolute inset-0 bg-slate-950 overflow-hidden pointer-events-none select-none">
      {/* Dynamic Background Media with Clean Opacity Crossfade */}
      <AnimatePresence mode="sync">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Đổi cảnh nhanh tay (0.5s): 2 video cùng giải mã càng ngắn càng đỡ giật
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full will-change-[opacity] transform-gpu"
          aria-hidden="true"
        >
          {scene.type === "VIDEO" && !hasVideoError ? (
            <video
              data-scene-id={scene.id}
              src={scene.bgUrl}
              poster={scene.thumbnailUrl}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => onLoaded?.()}
              onCanPlay={() => onLoaded?.()}
              onError={() => {
                devWarn(`[StudySpace] Lỗi nạp video bối cảnh "${scene.name}", tự động chuyển sang ảnh thumbnail an toàn.`);
                setHasVideoError(true);
                onLoaded?.();
              }}
              className="w-full h-full object-cover transform-gpu"
            />
          ) : (
            // Dùng <img> thay vì background-image: trình duyệt mới đưa ảnh vào
            // ứng viên LCP, ưu tiên tải trước các request phụ và gỡ decode khỏi main thread.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hasVideoError ? scene.thumbnailUrl : scene.bgUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="w-full h-full object-cover transform-gpu"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Lớp phủ khi có bảng che nền. Desktop: mờ kính động (backdrop-filter).
          Điện thoại: lớp phủ tối tĩnh nhẹ nhàng (bg-black/60) để bảo vệ tương phản mà không bắt GPU tính toán blur 26px */}
      <motion.div
        initial={false}
        animate={isBlurActive ? "on" : "off"}
        variants={{
          on: { opacity: 1, visibility: "visible", transition: { duration: 0.25, ease: "easeOut" } },
          off: {
            opacity: 0,
            transition: { duration: 0.25, ease: "easeOut" },
            transitionEnd: { visibility: "hidden" },
          },
        }}
        className={`absolute inset-0 study-bg-overlay pointer-events-none will-change-[opacity] ${
          isMobile ? "bg-black/60" : "bg-slate-950/45 backdrop-blur-md"
        }`}
      />

      {/* Cinematic Contrast Shield: Top Scrim Gradient (bảo vệ thanh TopBar; mobile thu gọn để không đè nền đen xuống menu chế độ) */}
      <div className="absolute inset-x-0 top-0 h-16 sm:h-36 bg-gradient-to-b from-black/60 sm:from-black/75 via-black/20 sm:via-black/30 to-transparent pointer-events-none" />

      {/* Cinematic Contrast Shield: Bottom Scrim Gradient (bảo vệ MusicPlayer; mobile vừa phải để kính lỏng sáng tự nhiên) */}
      <div className="absolute inset-x-0 bottom-0 h-32 sm:h-44 bg-gradient-to-t from-black/55 sm:from-black/80 via-black/20 sm:via-black/35 to-transparent pointer-events-none" />

      {/* Spatial Radial Vignette (làm tối dịu 4 góc màn hình để tập trung vào trung tâm) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(2,6,23,0.55)_100%)] pointer-events-none" />
    </div>
  );
});
