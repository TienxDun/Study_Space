"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Scene } from "./study-types";
import { devWarn } from "@/lib/logger";
import { getSceneSourceUrl } from "@/lib/asset-resolver";

export interface StudyBackgroundProps {
  scene: Scene;
  isBlurActive?: boolean;
  /** Điện thoại: dùng bản video 720p cho nhẹ, bản gốc vẫn để dự phòng. */
  isMobile?: boolean;
  onLoaded?: () => void;
}

/** Nền nhập vai: crossfade video/ảnh + fallback thumbnail + Spatial Vignette & GPU-accelerated Depth Blur. */
export const StudyBackground = ({
  scene,
  isBlurActive = false,
  isMobile = false,
  onLoaded,
}: StudyBackgroundProps) => {
  const [hasVideoError, setHasVideoError] = useState(false);
  // Bản 720p có thể chưa được encode/upload: lỗi lần đầu thì dùng bản gốc.
  const [hasMobileSourceError, setHasMobileSourceError] = useState(false);

  useEffect(() => {
    setHasVideoError(false);
    setHasMobileSourceError(false);
  }, [scene.id]);

  const videoSrc = getSceneSourceUrl(scene, isMobile && !hasMobileSourceError);

  // Tab/app bị ẩn (chuyển app, khoá màn hình) thì dừng decode video nền.
  // Nhiều máy vẫn giải mã tiếp khi ẩn tab, đốt pin/GPU mà chẳng ai xem.
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
      if (document.hidden) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [scene.id, hasVideoError]);

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
          className="absolute inset-0 w-full h-full will-change-[opacity]"
        >
          {scene.type === "VIDEO" && !hasVideoError ? (
            <video
              data-scene-id={scene.id}
              src={videoSrc}
              poster={scene.thumbnailUrl}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => onLoaded?.()}
              onCanPlay={() => onLoaded?.()}
              onError={() => {
                if (isMobile && scene.bgUrlMobile && !hasMobileSourceError) {
                  devWarn(`[StudySpace] Không nạp được bản nhẹ của "${scene.name}", chuyển sang bản gốc.`);
                  setHasMobileSourceError(true);
                  return;
                }
                devWarn(`[StudySpace] Lỗi nạp video bối cảnh "${scene.name}", tự động chuyển sang ảnh thumbnail an toàn.`);
                setHasVideoError(true);
                onLoaded?.();
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage: `url('${hasVideoError ? scene.thumbnailUrl : scene.bgUrl}')`,
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* GPU-Accelerated Spatial Depth Blur Overlay (Sử dụng Opacity để 60fps mượt mà, không giật lag video) */}
      {/* Tắt hẳn (visibility) khi mờ về 0 để trình duyệt khỏi chạy backdrop-filter ngầm */}
      <motion.div
        initial={false}
        animate={isBlurActive ? "on" : "off"}
        variants={{
          on: { opacity: 1, visibility: "visible", transition: { duration: 0.35, ease: "easeOut" } },
          off: {
            opacity: 0,
            transition: { duration: 0.35, ease: "easeOut" },
            transitionEnd: { visibility: "hidden" },
          },
        }}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-md [@media(pointer:coarse)]:backdrop-blur-[2px] [@media(pointer:coarse)]:bg-slate-950/55 pointer-events-none will-change-[opacity]"
      />

      {/* Cinematic Contrast Shield: Top Scrim Gradient (bảo vệ thanh TopBar) */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />

      {/* Cinematic Contrast Shield: Bottom Scrim Gradient (bảo vệ MusicPlayer) */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none" />

      {/* Spatial Radial Vignette (làm tối dịu 4 góc màn hình để tập trung vào trung tâm) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(2,6,23,0.55)_100%)] pointer-events-none" />
    </div>
  );
};
