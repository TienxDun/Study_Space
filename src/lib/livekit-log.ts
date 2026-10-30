import { LogLevel, setLogLevel } from "livekit-client";

let configured = false;

/**
 * LiveKit mặc định log mức info: in toàn bộ vòng đời kết nối kèm stats WebRTC
 * (địa chỉ IP, nhãn thiết bị) và UID người tham gia. Production chỉ giữ lỗi.
 */
export function configureLiveKitLogging(): void {
  if (configured || typeof window === "undefined") return;
  configured = true;
  setLogLevel(process.env.NODE_ENV === "production" ? LogLevel.error : LogLevel.info);
}
