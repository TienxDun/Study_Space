import { AmbientSound } from "../types";

export interface SoundTheme {
  activeBg: string;
  activeIconBg: string;
  accentColor: string;
}

/**
 * Xác định bảng màu và hiệu ứng gradient theo loại âm thanh
 */
export function getSoundTheme(sound: AmbientSound): SoundTheme {
  const isFire =
    sound.name.toLowerCase().includes("fire") || sound.name.toLowerCase().includes("camp");
  const isWater = ["rain", "ocean", "river", "drops"].some((k) => sound.id.includes(k));
  const isNature = ["birds", "forest", "wind", "night"].some((k) => sound.id.includes(k));

  if (isFire) {
    return {
      activeBg:
        "bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-black/60 border-amber-400/40 shadow-[0_4px_16px_rgba(245,158,11,0.2)]",
      activeIconBg: "bg-amber-500/30 text-amber-300 border-amber-400/40",
      accentColor: "accent-amber-400",
    };
  }

  if (isWater) {
    return {
      activeBg: "bg-sky-500/15 border-sky-500/40 shadow-lg shadow-sky-500/10",
      activeIconBg: "bg-sky-500/25 border-sky-400/50 text-sky-300",
      accentColor: "accent-sky-400",
    };
  }

  if (isNature) {
    return {
      activeBg: "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10",
      activeIconBg: "bg-emerald-500/25 border-emerald-400/50 text-emerald-300",
      accentColor: "accent-emerald-400",
    };
  }

  return {
    activeBg: "bg-purple-500/15 border-purple-500/40 shadow-lg shadow-purple-500/10",
    activeIconBg: "bg-purple-500/25 border-purple-400/50 text-purple-300",
    accentColor: "accent-purple-400",
  };
}

/**
 * Định dạng thời gian mm:ss
 */
export function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Kiểm tra xem một Preset có đang được kích hoạt đầy đủ hay không
 */
export function isPresetActive(
  recipe: Record<string, number>,
  ambientVolumes: Record<string, number>,
  allSounds: AmbientSound[]
): boolean {
  const matchingSounds = allSounds.filter((s) =>
    Object.keys(recipe).some((k) => s.name.toLowerCase().includes(k.toLowerCase()))
  );

  return (
    matchingSounds.length > 0 &&
    matchingSounds.every((s) => (ambientVolumes[s.id] || 0) > 0)
  );
}

/**
 * Tạo danh sách âm lượng mới khi bật / tắt một Preset
 */
export function togglePresetVolumes(
  recipe: Record<string, number>,
  currentVolumes: Record<string, number>,
  allSounds: AmbientSound[]
): Record<string, number> {
  const matchingSounds = allSounds.filter((s) =>
    Object.keys(recipe).some((k) => s.name.toLowerCase().includes(k.toLowerCase()))
  );

  const isActive =
    matchingSounds.length > 0 &&
    matchingSounds.every((s) => (currentVolumes[s.id] || 0) > 0);

  if (isActive) {
    const next = { ...currentVolumes };
    matchingSounds.forEach((s) => {
      delete next[s.id];
    });
    return next;
  }

  const next = { ...currentVolumes };
  matchingSounds.forEach((s) => {
    const matchKey = Object.keys(recipe).find((k) =>
      s.name.toLowerCase().includes(k.toLowerCase())
    );
    if (matchKey && recipe[matchKey] !== undefined) {
      next[s.id] = recipe[matchKey];
    }
  });
  return next;
}
