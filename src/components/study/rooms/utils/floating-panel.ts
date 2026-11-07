/**
 * Cấu hình kích thước và tọa độ cho khung phòng học nhóm dạng thẻ bay.
 */
export const ROOM_MARGIN = 16;
export const DEFAULT_ROOM_W = 720;
export const DEFAULT_ROOM_H = 540;
// Vào phòng mà thẻ nhỏ hơn cỡ này thì tự nở ra cho xem rõ
export const MIN_JOIN_W = 680;
export const MIN_JOIN_H = 500;
export const MIN_ROOM_W = 380;
export const MIN_ROOM_H = 360;

/**
 * Giữ khung phòng học luôn nằm trọn vẹn trong màn hình trình duyệt.
 */
export const clampRoom = (
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number } => {
  if (typeof window === "undefined") return { x: Math.round(x), y: Math.round(y) };
  const maxX = Math.max(ROOM_MARGIN, window.innerWidth - w - ROOM_MARGIN);
  const maxY = Math.max(ROOM_MARGIN, window.innerHeight - h - ROOM_MARGIN);
  return {
    x: Math.round(Math.max(ROOM_MARGIN, Math.min(maxX, x))),
    y: Math.round(Math.max(ROOM_MARGIN, Math.min(maxY, y))),
  };
};

/**
 * Tính toán tọa độ đưa khung phòng học về chính giữa màn hình.
 */
export const getCenter = (w: number, h: number) => {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return clampRoom((window.innerWidth - w) / 2, (window.innerHeight - h) / 2, w, h);
};

/**
 * Lấy URL các API endpoint phục vụ kết nối LiveKit và danh sách phòng.
 */
export const getLiveKitEndpoints = () => {
  const raw = (process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL || "").trim().replace(/\/+$/, "");
  if (!raw) {
    const isDev = process.env.NODE_ENV === "development";
    return {
      tokenUrl: isDev ? "/api/livekit-token/" : "",
      roomsUrl: isDev ? "/api/livekit-rooms/" : "",
      isAvailable: isDev,
    };
  }
  const base = raw.replace(/\/(token|rooms)$/, "");
  return {
    tokenUrl: `${base}/token`,
    roomsUrl: `${base}/rooms`,
    isAvailable: true,
  };
};
