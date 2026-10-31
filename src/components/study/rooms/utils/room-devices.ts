import type { Room } from "livekit-client";

// "default" là id ảo của trình duyệt (nghĩa là "để trình duyệt tự chọn").
// Nếu đưa vào switchActiveDevice(), LiveKit lưu constraint { exact: "default" } và
// lần bật camera/mic sau đó sẽ ném OverconstrainedError (Chrome không cho ghim exact
// vào id ảo của video) — đúng lỗi "không mở lại được camera sau khi vào phòng".
export const isConcreteDeviceId = (id?: string) => Boolean(id) && id !== "default";

export function applyChosenDevices(
  room: Room,
  deviceIds: { audioDeviceId?: string; videoDeviceId?: string }
) {
  const { audioDeviceId, videoDeviceId } = deviceIds;
  if (isConcreteDeviceId(audioDeviceId)) {
    room.switchActiveDevice("audioinput", audioDeviceId as string).catch(() => {});
  }
  if (isConcreteDeviceId(videoDeviceId)) {
    room.switchActiveDevice("videoinput", videoDeviceId as string).catch(() => {});
  }
}
