// Mã lý do ngắt kết nối do livekit-client phát ra. Đây là enum
// livekit.DisconnectReason trong @livekit/protocol, nhưng package đó không phải
// dependency trực tiếp của repo nên khai báo lại bằng số để tránh import ngoài.
export const DISCONNECT_REASON_CLIENT_INITIATED = 1; // CLIENT_INITIATED
const DISCONNECT_REASON_DUPLICATE_IDENTITY = 2; // DUPLICATE_IDENTITY
const DISCONNECT_REASON_SERVER_SHUTDOWN = 3; // SERVER_SHUTDOWN
const DISCONNECT_REASON_PARTICIPANT_REMOVED = 4; // PARTICIPANT_REMOVED
const DISCONNECT_REASON_ROOM_DELETED = 5; // ROOM_DELETED
const DISCONNECT_REASON_STATE_MISMATCH = 6; // STATE_MISMATCH
const DISCONNECT_REASON_JOIN_FAILURE = 7; // JOIN_FAILURE
const DISCONNECT_REASON_MIGRATION = 8; // MIGRATION
const DISCONNECT_REASON_SIGNAL_CLOSE = 9; // SIGNAL_CLOSE
const DISCONNECT_REASON_ROOM_CLOSED = 10; // ROOM_CLOSED
const DISCONNECT_REASON_CONNECTION_TIMEOUT = 14; // CONNECTION_TIMEOUT
const DISCONNECT_REASON_MEDIA_FAILURE = 15; // MEDIA_FAILURE

export type RoomExitKind =
  | "kicked"
  | "room_deleted"
  | "room_idle_closed"
  | "duplicate_identity"
  | "network"
  | "server"
  | "invalid_session"
  | "voluntary"
  | "unknown";

export interface RoomExitNotice {
  kind: RoomExitKind;
  title: string;
  description: string;
  tone: "amber" | "slate";
  allowRejoin: boolean;
  showNotice: boolean;
}

const roomLabel = (roomName: string) => roomName.trim() || "phòng học";

const buildNotice = (
  kind: RoomExitKind,
  title: string,
  description: string,
  tone: RoomExitNotice["tone"],
  options: { allowRejoin?: boolean; showNotice?: boolean } = {}
): RoomExitNotice => ({
  kind,
  title,
  description,
  tone,
  allowRejoin: options.allowRejoin ?? true,
  showNotice: options.showNotice ?? true,
});

export function getRoomExitNotice(
  reason: number | undefined,
  roomName: string
): RoomExitNotice {
  const room = roomLabel(roomName);

  // Tự bấm "Rời phòng": không làm phiền người dùng.
  if (reason === DISCONNECT_REASON_CLIENT_INITIATED) {
    return buildNotice("voluntary", "Đã rời phòng học nhóm", "", "slate", {
      allowRejoin: false,
      showNotice: false,
    });
  }

  // Không có lý do cụ thể (rớt mạng, tab reload, socket tín hiệu chết).
  if (reason === undefined) {
    return buildNotice(
      "network",
      "Mất kết nối với phòng học",
      `Không giữ được kết nối với phòng “${room}”. Kiểm tra mạng rồi vào lại nhé.`,
      "slate"
    );
  }

  switch (reason) {
    case DISCONNECT_REASON_DUPLICATE_IDENTITY:
      return buildNotice(
        "duplicate_identity",
        "Tên này đang dùng ở nơi khác",
        "Một tab hoặc thiết bị khác đang vào phòng bằng danh tính của bạn. Đóng tab đó rồi vào lại.",
        "amber"
      );

    case DISCONNECT_REASON_SERVER_SHUTDOWN:
      return buildNotice(
        "server",
        "Máy chủ phòng học đang bảo trì",
        "Thử vào lại sau ít phút.",
        "slate"
      );

    case DISCONNECT_REASON_PARTICIPANT_REMOVED:
      return buildNotice(
        "kicked",
        "Bạn được mời ra khỏi phòng",
        `Trưởng phòng hoặc phó phòng đã mời bạn rời khỏi “${room}”.`,
        "amber"
      );

    case DISCONNECT_REASON_ROOM_DELETED:
      return buildNotice(
        "room_deleted",
        "Phòng học đã bị đóng",
        `Phòng “${room}” vừa bị đóng. Dữ liệu phiên học của bạn đã được lưu trên máy.`,
        "amber"
      );

    case DISCONNECT_REASON_STATE_MISMATCH:
    case DISCONNECT_REASON_JOIN_FAILURE:
      return buildNotice(
        "invalid_session",
        "Phiên phòng học không còn hợp lệ",
        "Máy chủ không còn nhận phiên này. Vào lại phòng để tiếp tục.",
        "slate"
      );

    // Cloud chuyển phiên sang node khác: coi như đang kết nối lại, không báo lỗi.
    case DISCONNECT_REASON_MIGRATION:
      return buildNotice("server", "", "", "slate", {
        allowRejoin: false,
        showNotice: false,
      });

    case DISCONNECT_REASON_SIGNAL_CLOSE:
    case DISCONNECT_REASON_CONNECTION_TIMEOUT:
    case DISCONNECT_REASON_MEDIA_FAILURE:
      return buildNotice(
        "network",
        "Mất kết nối với phòng học",
        `Không giữ được kết nối với phòng “${room}”. Kiểm tra mạng rồi vào lại nhé.`,
        "slate"
      );

    case DISCONNECT_REASON_ROOM_CLOSED:
      return buildNotice(
        "room_idle_closed",
        "Phòng học đã đóng",
        `Không còn ai trong phòng “${room}” nên phòng đã tự đóng.`,
        "slate"
      );

    // SIP / USER_* / AGENT_ERROR: app không dùng, bỏ qua.
    case 11:
    case 12:
    case 13:
    case 16:
      return buildNotice("unknown", "", "", "slate", {
        allowRejoin: false,
        showNotice: false,
      });

    default:
      return buildNotice(
        "unknown",
        "Đã rời khỏi phòng học",
        `Kết nối tới phòng “${room}” đã kết thúc. Bạn có thể vào lại nếu phòng còn mở.`,
        "slate"
      );
  }
}
