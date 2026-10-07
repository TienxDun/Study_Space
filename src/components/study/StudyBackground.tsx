"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Scene } from "./study-types";

export interface StudyBackgroundProps {
  scene: Scene;
  isBlurActive?: boolean;
}

/** Nền nhập vai: crossfade video/ảnh + fallback thumbnail + Spatial Vignette & GPU-accelerated Depth Blur. */
export const StudyBackground = ({ scene, isBlurActive = false }: StudyBackgroundProps) => {
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    setHasVideoError(false);
  }, [scene.id]);

  return (
    <div className="absolute inset-0 bg-slate-950 overflow-hidden pointer-events-none select-none">
      {/* Dynamic Background Media with Clean Opacity Crossfade */}
      <AnimatePresence mode="sync">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full will-change-[opacity]"
        >
          {scene.type === "VIDEO" && !hasVideoError ? (
            <video
              src={scene.bgUrl}
              poster={scene.thumbnailUrl}
              autoPlay
              loop
              muted
              playsInline
              onError={() => {
                console.warn(`[StudySpace] Lỗi nạp video bối cảnh "${scene.name}", tự động chuyển sang ảnh thumbnail an toàn.`);
                setHasVideoError(true);
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
      <motion.div
        initial={false}
        animate={{ opacity: isBlurActive ? 1 : 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-md pointer-events-none will-change-[opacity]"
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
