"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Scene } from "./study-types";

/** Nền nhập vai: crossfade video/ảnh + fallback thumbnail khi lỗi. */
export const StudyBackground = ({ scene }: { scene: Scene }) => {
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    setHasVideoError(false);
  }, [scene.id]);

  return (
    <div className="absolute inset-0 bg-slate-950 overflow-hidden pointer-events-none">
      <AnimatePresence mode="sync">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute inset-0 w-full h-full"
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
    </div>
  );
};
