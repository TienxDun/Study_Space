# Kế Hoạch Triển Khai Phase 3 — Trưởng Phòng, Phó Phòng, Quản Trị & Lịch Sử Giờ Học

- **Ngày lập:** 2026-10-23 (Bản hoàn chỉnh làm mới sạch bảng D1)
- **Trạng thái:** Bản hoàn chỉnh (Sẵn sàng triển khai)
- **Phạm vi:** Server (Cloudflare Worker + D1) + Client (Next.js Desktop & Mobile)
- **Ràng buộc:** Không phá vỡ Phase 0–2, không tự động commit, không thêm dependency mới, không thêm localStorage key, giao diện tiếng Việt có dấu.

---

## 1. Mục Tiêu Chính

1. **Trưởng phòng (Host) duy nhất & cố định:**
   - Người tạo phòng là Trưởng phòng duy nhất gắn với Firebase `uid`.
   - Khi Trưởng phòng mất mạng, F5 hay tạm rời phòng, quyền host **không trao cho bất kỳ ai**.
   - Khi Trưởng phòng quay lại, tự động nhận diện lại đầy đủ quyền quản trị.
2. **Cơ chế Phó phòng (Co-host):**
   - Trưởng phòng có quyền chỉ định hoặc bãi nhiệm Phó phòng để hỗ trợ điều hành trật tự.
3. **Phòng học bảo mật (Private Room bằng mật khẩu):**
   - Cho phép Trưởng phòng đặt, đổi hoặc xóa mật khẩu phòng.
   - Mật khẩu được băm an toàn bằng Web Crypto API (SHA-256 kèm salt cố định) trên Worker, không lưu plaintext, không thêm dependency.
4. **Công cụ điều hành phòng học (Moderation qua LiveKit Twirp API):**
   - Khóa/mở phòng học (chặn người mới vào khi phòng đã khóa).
   - Tắt mic thành viên gây ồn (Mute qua Twirp `ListParticipants` -> `MutePublishedTrack`).
   - Mời thành viên vi phạm ra khỏi phòng (Kick qua Twirp `RemoveParticipant`).
5. **Lịch sử giờ học & Báo cáo quản trị (History & Admin Usage Aggregate):**
   - `GET /history`: Xem lịch sử các phiên học theo phòng/tháng, tổng hợp thời lượng, số phiên, số người học đồng thời.
   - `GET /usage` & alias `GET /admin/usage`: Dùng chung một logic, vừa tương thích ngược 100% hệ thống cũ, vừa chuẩn spec mới; báo cáo aggregate ẩn danh 100% (không lộ uid/email).

---

## 2. Ma Trận Phân Quyền (Role & Permissions Matrix)

| Chức năng | Trưởng phòng (Host) | Phó phòng (Co-host) | Thành viên (Member) |
| :--- | :---: | :---: | :---: |
| Bật / tắt mic, camera, chia sẻ màn hình của bản thân | ✅ Có | ✅ Có | ✅ Có |
| Giơ tay phát biểu, gửi Reaction, dùng Pomodoro | ✅ Có | ✅ Có | ✅ Có |
| Tắt mic thành viên khác (Mute remote audio track) | ✅ Có | ✅ Có | ❌ Không |
| Mời thành viên ra khỏi phòng (Kick participant) | ✅ Có | ✅ Có | ❌ Không |
| Khóa phòng / Mở khóa phòng (Lock / Unlock) | ✅ Có | ✅ Có | ❌ Không |
| Đặt / Đổi / Xóa mật khẩu phòng | ✅ Có | ❌ Không | ❌ Không |
| Bổ nhiệm / Hủy quyền Phó phòng | ✅ Có | ❌ Không | ❌ Không |
| Xem lịch sử các phiên học của phòng | ✅ Có | ✅ Có | ✅ Có |

---

## 3. Thiết Kế Cơ Sở Dữ Liệu (D1 Schema - Có Lệnh Xóa Bảng Cũ Trước Khi Tạo Mới)

Cập nhật vào `workers/livekit-schema.sql`:

```sql
-- Xóa bảng cũ trước khi tạo mới để đảm bảo schema hoàn toàn đồng nhất và sạch sẽ
DROP TABLE IF EXISTS meet_audit_logs;
DROP TABLE IF EXISTS meet_rooms;

-- Tạo mới bảng meet_rooms với đầy đủ các cột tính năng Phase 3
CREATE TABLE IF NOT EXISTS meet_rooms (
  name TEXT PRIMARY KEY,
  host_uid TEXT NOT NULL,
  host_identity TEXT NOT NULL,
  co_host_uids TEXT NOT NULL DEFAULT '[]',
  locked INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  created_at INTEGER NOT NULL
);

-- Tạo mới bảng meet_audit_logs ghi vết hành động điều hành phòng học
CREATE TABLE IF NOT EXISTS meet_audit_logs (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'lock', 'unlock', 'kick', 'mute', 'set_password', 'remove_password', 'add_cohost', 'remove_cohost'
  actor_uid TEXT NOT NULL,
  target_identity TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meet_audit_room ON meet_audit_logs(room, created_at);
```

---

## 4. Thiết Kế Backend (Cloudflare Worker)

File triển khai: `workers/livekit-rooms/worker.js`.

### 4.1. Cập nhật CORS Headers
Cập nhật hỗ trợ các phương thức:
```js
"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
```

### 4.2. Thống nhất Endpoint Quản trị (`/admin/usage` và `/usage`)
Chạy chung một logic duy nhất:
```js
if ((url.pathname === "/usage" || url.pathname === "/admin/usage") && req.method === "GET") {
  // Logic kiểm tra ADMIN_TOKEN và trả dữ liệu aggregate
}
```

### 4.3. Băm mật khẩu bằng Web Crypto API Native
```js
async function hashRoomPassword(password, salt = "zenstudy-salt-v1") {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${String(password || "").trim()}`);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

### 4.4. Quy trình Cấp vé `/token` (POST)
1. **Kiểm tra Mật khẩu**:
   - Nếu phòng có `password_hash`:
     - Nếu request không gửi `password`: Trả lỗi 401 `{ error: "Phòng này yêu cầu mật khẩu.", code: "ROOM_PASSWORD_REQUIRED" }`.
     - Nếu `hash(password) !== room.password_hash`: Trả lỗi 403 `{ error: "Mật khẩu phòng không đúng.", code: "INVALID_PASSWORD" }`.
2. **Kiểm tra Khóa phòng**:
   - Nếu phòng có `locked = 1`:
     - Kiểm tra nếu `checked.uid !== room.host_uid` và không nằm trong `co_host_uids`:
     - Trả lỗi 403 `{ error: "Phòng đang bị khóa bởi trưởng phòng.", code: "ROOM_LOCKED" }`.
3. **Xác định Role & Cấp quyền**:
   - Tạo mới phòng nếu chưa có trong D1 (`host_uid = checked.uid`). Người tạo là Host.
   - So khớp `checked.uid === room.host_uid` -> `role: "host"`, `isHost: true`, `isCoHost: false`.
   - So khớp `co_host_uids.includes(checked.uid)` -> `role: "co-host"`, `isHost: false`, `isCoHost: true`.
   - Khác -> `role: "member"`, `isHost: false`, `isCoHost: false`.
   - Payload trả về client:
     ```json
     {
       "token": "...",
       "url": "...",
       "room": "...",
       "role": "host",
       "isHost": true,
       "isCoHost": false,
       "maxParticipants": 6,
       "remainingMinutes": 4310,
       "sessionMaxMinutes": 120,
       "quotaStatus": "ok"
     }
     ```

### 4.5. Chi tiết Kỹ thuật Moderation qua Twirp API
- **Kick Thành viên (`POST /rooms/:name/kick`)**:
  - Quyền: Host hoặc Co-host.
  - Body: `{ identity }`. Không được tự kick chính mình, Co-host không được kick Host.
  - Twirp call: `POST ${httpBase}/twirp/livekit.RoomService/RemoveParticipant` với `{ room: roomName, identity: targetIdentity }`.
- **Tắt Mic Thành viên (`POST /rooms/:name/mute`)**:
  - Quyền: Host hoặc Co-host.
  - Body: `{ identity }`.
  - Quy trình 2 bước qua Twirp:
    1. Gọi `ListParticipants` (`POST /twirp/livekit.RoomService/ListParticipants`, body: `{ room: roomName }`).
    2. Quét tìm track audio của `targetIdentity` (có `type: 0` hoặc `source: 1`).
    3. Gọi `MutePublishedTrack` (`POST /twirp/livekit.RoomService/MutePublishedTrack`) với `track_sid` tìm được và `muted: true`.
- **Khóa / Mở phòng (`POST /rooms/:name/lock` & `POST /rooms/:name/unlock`)**:
  - Quyền: Host hoặc Co-host.
  - Cập nhật D1: `UPDATE meet_rooms SET locked = 1 (hoặc 0) WHERE name = ?`.
  - Ghi nhận `meet_audit_logs`.
- **Cài đặt / Xóa Mật khẩu (`POST /rooms/:name/password` & `DELETE /rooms/:name/password`)**:
  - Quyền: **Chỉ Host**.
  - `POST`: Nhận `{ password }`, băm SHA-256 và lưu `password_hash`.
  - `DELETE`: Cập nhật `password_hash = NULL`.
- **Bổ nhiệm / Hủy Phó phòng (`POST /rooms/:name/co-host` & `DELETE /rooms/:name/co-host`)**:
  - Quyền: **Chỉ Host**.
  - Body: `{ targetUid, targetIdentity }`.
  - Cập nhật D1 mảng `co_host_uids`.
  - Gọi Twirp `UpdateParticipant` cập nhật attributes `zen.role = "co-host"` (hoặc `""`) để toàn bộ thành viên nhận diện real-time.

### 4.6. API `GET /history`
- URL: `GET /history?room=<roomName>&month=YYYY-MM`
- Yêu cầu: Đăng nhập Firebase.
- Cấu trúc Response chuẩn:
  ```json
  {
    "room": "phong-hoc-1",
    "month": "2026-10",
    "totalMinutes": 320,
    "totalSessions": 8,
    "uniqueParticipants": 6,
    "sessions": [
      {
        "id": "sess-xxx",
        "date": "2026-10-22",
        "startTime": 1729600000,
        "durationMinutes": 45,
        "participantsCount": 4
      }
    ]
  }
  ```
- 100% không trả về `uid` hay `email` cá nhân.

---

## 5. Truyền Dẫn Trạng Thái & Giao Diện Frontend (Client)

### 5.1. Luồng truyền Role từ `/token` xuống UI
- `StudyRoomsWidget` và `MobileRoomsSheet` nhận `role` từ `/token` và lưu vào state `userRole`.
- Truyền `userRole` vào `StudyRoomView` và `MobileRoomView`.
- Huy hiệu hiển thị trên Tile:
  - 👑 **Trưởng phòng**: local user là host hoặc identity khớp `room.host_identity`.
  - ⭐ **Phó phòng**: local user là co-host hoặc `participant.attributes["zen.role"] === "co-host"`.

### 5.2. Giao diện Desktop (`StudyRoomView.tsx`)
- Thêm Host Badge 👑 và Co-host Badge ⭐ trên `RoomParticipantTile`.
- Nút quản trị phòng 🛡️ trên top bar (chỉ hiện khi là Host hoặc Co-host):
  - Mở `RoomHostControlsModal`: Quản lý Khóa phòng, Mật khẩu, Danh sách Phó phòng.
- Thao tác trên từng thành viên (Menu ngữ cảnh): Nút Mute, Nút Kick, Nút Bổ nhiệm/Gỡ Phó phòng.
- Nút xem lịch sử 📜 mở `RoomHistoryModal`.

### 5.3. Giao diện Mobile (`MobileRoomView.tsx` & `MobileRoomsSheet.tsx`)
- Nhận prop `userRole`.
- Thêm icon Cài đặt phòng ⚙️ trên thanh compact study bar của mobile.
- Bấm icon mở Action Sheet/Modal compact quản lý khóa, mật khẩu và phó phòng.
- Menu thao tác thành viên dạng bottom sheet khi chạm vào tile.

### 5.4. Sảnh Chờ & Pre-join
- `RoomPreJoinView.tsx`: Thêm ô nhập "Mật khẩu phòng (nếu có)".
- Bắt lỗi `ROOM_PASSWORD_REQUIRED`, `INVALID_PASSWORD`, `ROOM_LOCKED` hiển thị thông báo tiếng Việt và cho phép nhập lại ngay.

### 5.5. Trang Admin (`/admin`)
- Hiển thị số liệu thống kê tổng hợp từ `/admin/usage` (hoặc `/usage`): Số phòng hoạt động, tổng phút học trong tháng, quota LiveKit 5.000 phút.

---

## 6. Kế Hoạch Kiểm Thử Toàn Diện (Testing & Mocking)

### 6.1. Mock Test cho Worker (`meet-host-moderation.test.ts`)
- Mock Firebase Auth (`env._verifyToken`).
- Mock Twirp Server API: `ListParticipants`, `MutePublishedTrack`, `RemoveParticipant`, `UpdateParticipant`.
- Mock D1 in-memory cho các bảng `meet_rooms`, `meet_sessions`, `meet_audit_logs`.

### 6.2. Các Test Case Trọng Tâm
- [x] Host tạo phòng được ghi nhận `host_uid` chính xác.
- [x] Host rớt mạng và vào lại vẫn giữ nguyên quyền `host`.
- [x] Người lạ gọi đổi mật khẩu/phó phòng bị chặn (`403 NOT_HOST`).
- [x] Phó phòng được gọi `lock`, `unlock`, `mute`, `kick`.
- [x] Phó phòng không được đổi mật khẩu phòng (`403`).
- [x] Nhập sai mật khẩu trả về `403 INVALID_PASSWORD`.
- [x] Phòng khóa chặn người lạ (`403 ROOM_LOCKED`), nhưng cho phép Host/Co-host vào lại.
- [x] API `GET /history` và `GET /admin/usage` không chứa `email` hoặc `uid`.
- [x] Endpoint `GET /usage` và `GET /admin/usage` trả cùng kết quả chuẩn xác.

### 6.3. Chuỗi Kiểm Tra Lệnh Bắt Buộc
```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

---

## 7. Thứ Tự Triển Khai Chi Tiết

1. **Bước 1**: Cập nhật `workers/livekit-schema.sql` (thêm các lệnh `DROP TABLE IF EXISTS` và schema mới).
2. **Bước 2**: Cập nhật `workers/livekit-rooms/worker.js` (CORS DELETE, alias `/admin/usage` và `/usage`, mật khẩu SHA-256, kiểm tra role, moderation Twirp, `GET /history`).
3. **Bước 3**: Viết test suite `src/__tests__/unit/study/meet-host-moderation.test.ts` (mock Twirp, Firebase, D1) và chạy pass 100%.
4. **Bước 4**: Cập nhật client Desktop & Mobile (Prop `userRole`, badges 👑 ⭐, `RoomPreJoinView` mật khẩu, `RoomHostControlsModal`, `RoomHistoryModal`).
5. **Bước 5**: Tích hợp hiển thị số liệu LiveKit aggregate trên trang `/admin`.
6. **Bước 6**: Chạy kiểm thử toàn bộ dự án (`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`).
