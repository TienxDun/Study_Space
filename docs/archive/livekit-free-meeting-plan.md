# Kế hoạch: Phòng học nhóm LiveKit trên gói Build (0đ)

> **ĐÃ LƯU TRỮ:** Kế hoạch chi tiết cũ. Trạng thái hiện tại xem [`../LIVEKIT_ROADMAP.md`](../LIVEKIT_ROADMAP.md).

- **Ngày:** 2026-10-21
- **Người thực hiện:** Gemini
- **Người nghiệm thu:** opencode (theo checklist §9)
- **Trạng thái:** Đã lưu trữ; không dùng file này để theo dõi tiến độ.
- **Chạy tiếp:** Xem [`../LIVEKIT_ROADMAP.md`](../LIVEKIT_ROADMAP.md).

---

## 1. Mục tiêu

Giữ chi phí LiveKit ở mức **0đ** (gói Build, không nhập thẻ) và Cloudflare free, đồng thời:

1. Không để người dùng đốt hết 5.000 phút WebRTC/tháng trong vài ngày.
2. Sửa các lời hứa sai trong UI (sức chứa 10 người, đồng bộ Pomodoro).
3. Thêm tính năng học nhóm thực dụng mà **không làm tăng phút-người**.

## 2. Giới hạn gói Build phải thiết kế vòng quanh

| Tài nguyên | Giới hạn Build | Hệ quả thiết kế |
|---|---|---|
| WebRTC minutes | 5.000 phút-người/tháng | 4 người × 2 giờ = 480 phút → chỉ ~9 buổi/tháng |
| Concurrent connections | 100 toàn project | ~16 phòng 6 người |
| Downstream | 50 GB/tháng | Ưu tiên audio, tắt cam mặc định |
| Recording/Egress | 60 phút/tháng | **Không làm ghi hình** |
| Agent/Inference | 1.000 phút + $2.50 credit | **Không làm AI/transcript** |
| Webhook / RoomService API | Miễn phí | Dùng cho điểm danh + moderation |

Phút-người **không phụ thuộc việc bật cam hay không**, chỉ phụ thuộc số người × thời gian. Vì vậy biện pháp hiệu quả là: giới hạn sức chứa, giới hạn thời lượng phiên, và chặn khi gần hết quota.

> **Quyết định của người viết kế hoạch (không cần hỏi lại):** phiên tối đa **120 phút**, cấu hình bằng `SESSION_MAX_MINUTES`. Client đếm ngược, cảnh báo ở phút 115 và tự ngắt ở phút 120. Đây là chặn phía client; Worker không có cron để cưỡng chế tuyệt đối, nên quota guard vẫn là lớp bảo vệ cuối.

## 3. Phạm vi

### Làm
- Phase 0: chặn quota, giới hạn sức chứa thật, webhook điểm danh, sửa copy sai.
- Phase 1: link mời, pre-join, chất lượng kết nối/reconnect, screen share mobile.
- Phase 2: trạng thái tập trung, giơ tay, reaction, Pomodoro đồng bộ.
- Phase 3: host/moderation, trang admin, lịch sử giờ học.

### Không làm (trong đợt này)
- Ghi hình, livestream, HLS/RTMP, AI agent, transcript, SIP.
- Breakout room (nhân đôi phút-người).
- Đổi schema D1 của `data-api`; chỉ thêm bảng mới có tiền tố `meet_`.
- Đổi cơ chế static export, đổi `next.config`, đổi Firebase Auth.

## 4. Ràng buộc repo (bắt buộc)

- UI copy và comment mới viết bằng **tiếng Việt**.
- Không `!important` ngoài block cho phép. `npm run lint` kiểm tra việc này.
- Mọi key localStorage mới phải thêm vào `src/lib/storage-keys.ts`, không hardcode.
- Mobile/desktop tách tại 640px; không thêm state machine mobile thứ hai.
- State toàn cục mới phải đi qua `src/components/study/hooks/useStudySpaceState.ts`.
- Không thêm dependency nếu SDK LiveKit đã có (`PreJoin`, `MediaDeviceMenu`, `ConnectionQualityIndicator` đều có trong `@livekit/components-react`).
- Không commit secret. Env của Worker khai báo trên Cloudflare Dashboard.
- Không refactor ngoài phạm vi; không đổi UI ngoài các mục nêu.
- Test Node mặc định; test cần DOM thêm `// @vitest-environment happy-dom` ở dòng đầu.
- Trước khi báo xong: `npm test`, `npx tsc --noEmit`, `npm run lint` phải xanh.

## 5. Hiện trạng điểm chạm

| Khu vực | File |
|---|---|
| Lobby + cửa sổ nổi desktop | `src/components/study/rooms/StudyRoomsWidget.tsx` |
| UI trong phòng desktop | `src/components/study/rooms/StudyRoomView.tsx` |
| Sảnh chờ + sheet mobile | `src/components/study/mobile/sheets/MobileRoomsSheet.tsx` |
| UI trong phòng mobile | `src/components/study/mobile/rooms/MobileRoomView.tsx` |
| Pill khi thu nhỏ | `src/components/study/mobile/rooms/MobileActiveRoomPill.tsx` |
| Phát token + list phòng | `workers/livekit-rooms/worker.js` |
| API dev | `src/app/api/livekit-token/route.ts`, `src/app/api/livekit-rooms/route.ts` |
| Deploy | `docs/DEPLOY.md` |
| Quota hiển thị admin | `src/data/admin/hit-limits.ts` |
| Test hiện có | `src/__tests__/unit/study/study-mobile-rooms.test.ts`, `study-rooms-auth.test.ts`, `study-room-audio.test.ts` |

---

## Phase 0 — Chặn quota + sức chứa thật (bắt buộc làm trước)

### P0-1. Thêm cấu hình vào Worker

**File:** `workers/livekit-rooms/worker.js`

Thêm đọc env, có giá trị mặc định an toàn:

```js
const cfg = {
  maxParticipants: clampInt(env.MAX_ROOM_PARTICIPANTS, 6, 2, 20),
  monthlyMinutes: clampInt(env.LIVEKIT_MONTHLY_MINUTES, 4500, 100, 5000),
  enforceQuota: String(env.QUOTA_ENFORCE ?? "true") !== "false",
  emptyTimeoutSec: clampInt(env.ROOM_EMPTY_TIMEOUT_SEC, 300, 60, 3600),
  sessionMaxMinutes: clampInt(env.SESSION_MAX_MINUTES, 120, 15, 240),
};
```

Env mới (khai báo ở §8):
`MAX_ROOM_PARTICIPANTS`, `LIVEKIT_MONTHLY_MINUTES`, `QUOTA_ENFORCE`, `ROOM_EMPTY_TIMEOUT_SEC`, `SESSION_MAX_MINUTES`.

> **Quyết định của người viết kế hoạch:** mặc định **6 người/phòng** (đổi được bằng env, không cần sửa code). UI cũ hứa 10 người nhưng chưa hề chặn; 6 là mức cân bằng giữa trải nghiệm học nhóm và 5.000 phút/tháng.

**DoD:** Worker vẫn chạy khi thiếu các env này (dùng mặc định). Không có secret mới trong repo.

### P0-2. Giới hạn sức chứa phòng

**File:** `workers/livekit-rooms/worker.js`

Trong `mintRoomToken`, thêm claim `roomConfig` và các quyền cần cho Phase 2:

```js
{
  ...
  video: {
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  },
  roomConfig: {
    maxParticipants: cfg.maxParticipants,
    emptyTimeout: cfg.emptyTimeoutSec,
  },
}
```

Lưu ý: LiveKit chỉ áp dụng `roomConfig` **khi phòng được tạo lần đầu**. Phòng đang tồn tại từ trước sẽ giữ cấu hình cũ cho đến khi trống.

**Fallback bắt buộc:** nếu test thấy `maxParticipants` không được áp dụng, gọi Twirp trước khi phát token:

```
POST {httpBase}/twirp/livekit.RoomService/CreateRoom
Authorization: Bearer <admin token có video.roomCreate = true>
Body: {"name":"<room>","max_participants":6,"empty_timeout":300}
```

Bỏ qua lỗi `already exists`.

**Chặn phòng đầy ở server (bắt buộc, không dựa vào lỗi client):** trước khi phát token, gọi

```
POST {httpBase}/twirp/livekit.RoomService/ListParticipants
Authorization: Bearer <admin token có video.roomAdmin = true và video.room = "<room>">
Body: {"room":"<room>"}
```

Nếu `participants.length >= maxParticipants` → trả `409`:

```json
{ "error": "Phòng đã đủ người. Thử phòng khác nhé.", "code": "ROOM_FULL" }
```

Cách này cũng xử lý phòng được tạo trước khi có giới hạn. Nếu `ListParticipants` lỗi mạng, fail-open (phát token) và ghi log.

**DoD:** Token decode ra có `roomConfig.maxParticipants`. Vào phòng thứ 7 (khi cấu hình 6) nhận `409 ROOM_FULL` ngay từ `/token`; UI hiện thông báo tiếng Việt thay vì màn hình trắng.

### P0-3. Quota guard

**File:** `workers/livekit-rooms/worker.js` + file schema mới `workers/livekit-schema.sql`

Bảng mới (không đụng bảng cũ):

```sql
CREATE TABLE IF NOT EXISTS meet_events (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meet_sessions (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  identity TEXT NOT NULL,
  display_name TEXT,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  duration_seconds INTEGER,
  billing_month TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meet_sessions_month ON meet_sessions(billing_month);

CREATE TABLE IF NOT EXISTS meet_usage_month (
  month TEXT PRIMARY KEY,
  participant_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meet_rooms (
  name TEXT PRIMARY KEY,
  host_uid TEXT NOT NULL,
  host_identity TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

Luồng `/token`:

1. Verify Firebase như hiện tại.
2. Nếu `enforceQuota`: đọc `meet_usage_month` của tháng UTC hiện tại.
3. Nếu `usedSeconds / 60 >= monthlyMinutes` → trả `429`:
   `{"error":"Phòng học nhóm đã hết hạn mức tháng này. Vui lòng quay lại đầu tháng sau.","code":"QUOTA_EXCEEDED"}`
4. Trả thêm `remainingMinutes`, `maxParticipants`, `sessionMaxMinutes`, `quotaStatus` trong response thành công.

**Chính sách khi D1 lỗi hoặc thiếu binding:** fail-open (vẫn phát token) để không làm sập toàn bộ phòng học, nhưng trả `quotaStatus: "unknown"` và ghi `console.error`. UI hiện banner nhỏ "Không kiểm tra được hạn mức tháng" khi gặp trạng thái này. Khi `enforceQuota=false`, `quotaStatus = "disabled"`.

**Mở rộng `GET /rooms`:** trả thêm cấu hình để lobby hiển thị trước khi vào phòng:

```json
{
  "rooms": [{ "name": "on-thi", "count": 3 }],
  "maxParticipants": 6,
  "remainingMinutes": 4123,
  "quotaStatus": "ok"
}
```

**Thêm `GET /usage`** (dùng cho vận hành, không phải UI người dùng):

- Auth: `ADMIN_TOKEN` qua header `Authorization: Bearer <token>` hoặc `?token=`.
- Response: `{ "month":"2026-10", "usedMinutes":377, "limitMinutes":4500, "remainingMinutes":4123, "roomsOpen":2, "participants":7 }`.
- Không trả danh sách uid hay email.

**DoD:** Có test cho hàm tính quota (thuần, không cần D1). Khi env `QUOTA_ENFORCE=false`, guard tắt hoàn toàn. `/usage` gọi bằng curl trả đúng số.

### P0-4. Webhook điểm danh

**File:** `workers/livekit-rooms/worker.js`

Route mới `POST /webhook/livekit`:

- Đọc **raw body** (text), không parse trước.
- Verify `Authorization` là JWT HS256 ký bằng `LIVEKIT_API_SECRET`, `iss === LIVEKIT_API_KEY`, `exp` còn hạn (cho phép lệch 60 giây).
- Claim `sha256` phải bằng `base64(sha256(rawBody))` (base64 chuẩn, không URL-safe).
- Xử lý idempotent: `INSERT INTO meet_events(id) VALUES (?) ON CONFLICT DO NOTHING`; nếu không chèn được thì trả 200 luôn.
- `participant_joined`: tạo `meet_sessions` với `joined_at = event.createdAt`, `billing_month = YYYY-MM` (UTC).
- `participant_left`: đóng session đang mở của `(room, identity)`, tính `duration_seconds` từ **timestamp của event** (không dùng `now`), cộng vào `meet_usage_month` bằng UPSERT.
- Nếu `participant_left` đến trước mà chưa có session mở: ghi một session 0 giây với `joined_at = left_at = event.createdAt` và log cảnh báo. Chấp nhận under-count trong tình huống bất thường này; LiveKit đã đảm bảo thứ tự gửi event.
- `room_finished`: đóng mọi session còn mở của phòng (fallback khi mất `participant_left`), dùng `event.createdAt` làm `left_at`.
- Trả `200` sau khi xử lý; lỗi DB trả `500` để LiveKit retry. Sai chữ ký trả `401`.

**DoD:** Gửi "Send a test event" từ LiveKit Cloud nhận 200. Gửi lại cùng event không cộng đúp.

### P0-5. Nối UI với giới hạn thật

**File:** `StudyRoomsWidget.tsx`, `MobileRoomsSheet.tsx`

- Bỏ chữ "tối đa 10 người". Cả lobby desktop và lobby mobile đọc `maxParticipants` từ `GET /rooms` (fallback 6 nếu thiếu), hiển thị `tối đa {maxParticipants} người` **trước khi** bấm vào phòng.
- Bắt lỗi HTTP từ `/token`:
  - `429 QUOTA_EXCEEDED` → hiện đúng message từ Worker.
  - `409 ROOM_FULL` → "Phòng đã đủ người. Thử phòng khác nhé."
  - `quotaStatus === "unknown"` → banner nhỏ "Không kiểm tra được hạn mức tháng".
- Hiển thị `remainingMinutes` ở góc phòng (chỉ khi < 300 phút, dạng "Còn ~X phút học nhóm tháng này").
- Hiển thị đếm ngược phiên từ `sessionMaxMinutes`; ở phút cuối cùng hiện cảnh báo, hết giờ tự gọi `room.disconnect()` và báo "Phiên học đã đạt giới hạn 120 phút".
- Đổi copy "Đồng bộ đồng hồ Pomodoro nhóm" thành "Trò chuyện và học cùng nhau" cho đến khi Phase 2 xong.

**DoD:** Không còn chuỗi "10 người" trong UI phòng học. Cả desktop và mobile dùng cùng số liệu từ Worker. Phiên tự ngắt ở phút 120 (test bằng cách hạ `SESSION_MAX_MINUTES=1` ở dev).

### P0-6. Dev API tương đương

**File:** `src/app/api/livekit-token/route.ts`, `src/app/api/livekit-rooms/route.ts`

- Dev token route cũng thêm `roomConfig.maxParticipants` (đọc `MAX_ROOM_PARTICIPANTS`, mặc định 6).
- Giữ nguyên điều kiện `NODE_ENV === "development"`.

**DoD:** `npm run dev` vào phòng local vẫn hoạt động, token có `roomConfig`.

### P0-7. Cập nhật tài liệu + admin

- `docs/DEPLOY.md`: thêm env mới, bước tạo D1 binding, bước cấu hình webhook trong LiveKit Cloud, URL webhook.
- Thêm bước **seed số phút đã dùng trong tháng hiện tại** trước khi bật guard, để không cấp thêm 4.500 phút chồng lên phần đã dùng:

```sql
INSERT INTO meet_usage_month (month, participant_seconds, updated_at)
VALUES ('2026-10', 0, 0)
ON CONFLICT(month) DO UPDATE SET participant_seconds = excluded.participant_seconds;
-- thay 0 bằng số phút đã dùng × 60, lấy từ LiveKit Cloud Dashboard
```

- `src/data/admin/hit-limits.ts`: `livekit-cloud` phản ánh đúng giới hạn đang enforce (6 người/phòng, 4.500 phút ngưỡng chặn), thêm hướng dẫn xem `GET /usage`.

### P0-8. Test Phase 0

- `src/__tests__/unit/study/meet-token-claims.test.ts`: decode token do helper tạo, kiểm tra `roomConfig.maxParticipants`, `canUpdateOwnMetadata`, `canPublishData`.
- `src/__tests__/unit/study/meet-webhook.test.ts`: verify chữ ký đúng/sai, idempotency key, tính duration.
- `src/__tests__/unit/study/meet-quota.test.ts`: ngưỡng chặn, làm tròn tháng UTC, `QUOTA_ENFORCE=false`.

Để test được, export các hàm thuần từ `workers/livekit-rooms/worker.js` (ví dụ `cleanRoom`, `verifyWebhookJwt`, `computeQuota`, `monthKeyUtc`) bên cạnh `export default worker`.

**DoD Phase 0:** 3 file test mới xanh; 3 test cũ vẫn xanh; `tsc` và `lint` xanh.

---

## Phase 1 — Trải nghiệm phòng (sau khi Phase 0 được nghiệm thu)

### P1-1. Link mời
- Hàm thuần `buildInviteLink(room)`: `origin + pathname + "?room=<slug>"`, bỏ query/hash cũ.
- Nút "Copy link mời" ở lobby desktop, lobby mobile, header trong phòng.
- Khi app load: đọc `?room=`, nếu hợp lệ thì mở panel phòng học và điền sẵn tên phòng. **Không tự động vào phòng** khi chưa bấm.
- Nếu chưa đăng nhập, panel hiện màn hình đăng nhập như hiện tại.

### P1-2. Pre-join
- Sau khi bấm "Vào phòng", hiện bước xem trước: camera, chọn mic/cam, tắt/bật trước khi kết nối.
- Dùng `usePreviewTracks` + `MediaDeviceMenu` của `@livekit/components-react`; không dùng `PreJoin` prefab nếu không style được theo theme phòng học.
- Không lưu lựa chọn thiết bị qua key nội bộ của LiveKit. Nếu muốn nhớ, thêm `meetDevicePrefs` vào `src/lib/storage-keys.ts`.
- Từ chối quyền mic/cam vẫn cho vào phòng (mic/cam tắt).

### P1-3. Chất lượng kết nối + reconnect
- `ConnectionQualityIndicator` nhỏ trên mỗi tile.
- Banner trên đầu phòng khi `RoomEvent.Reconnecting`, ẩn khi `Reconnected`; chỉ gọi `onLeave` khi `Disconnected`.
- Hiển thị thời lượng phiên đã học trong header.

### P1-4. Screen share mobile
- Thêm nút chia sẻ vào `MobileRoomView` nếu `navigator.mediaDevices?.getDisplayMedia` tồn tại (iOS Safari không có → ẩn nút).

### P1-5. Test Phase 1
- `meet-invite-link.test.ts` cho hàm tạo link.
- Cập nhật mock LiveKit trong các test hiện có nếu thêm import mới.
- Kiểm tra thủ công 2 trình duyệt, 1 desktop + 1 mobile.

---

## Phase 2 — Trạng thái học tập + Pomodoro (0đ)

### P2-1. Giao thức trạng thái
**File mới:** `src/components/study/rooms/meet-protocol.ts`

Dùng **participant attributes** (đồng bộ sẵn, người vào sau vẫn thấy), không dùng room metadata:

```ts
export const MEET_ATTR = {
  status: "zen.status",          // "focus" | "break" | "help" | ""
  hand: "zen.hand",              // "1" | ""
  timerPhase: "zen.timer.phase", // "focus" | "break" | ""
  timerEndsAt: "zen.timer.endsAt",     // epoch ms dạng chuỗi
  timerDuration: "zen.timer.duration", // giây
  timerStartedAt: "zen.timer.startedAt",
  goal: "zen.goal",              // <= 120 ký tự
} as const;
```

- Mỗi người chỉ ghi attribute của mình.
- Timer hiển thị lấy từ participant có `timerStartedAt` lớn nhất; hoà thì so `identity` để deterministic.
- Data channel `zenstudy.reaction.v1` (lossy) chỉ dùng cho reaction bay lên; whitelist emoji `👍 👏 🔥 ❤️ 😮 🎉 🙋`. Timer/status **không** đi qua data channel.

### P2-2. UI
- Thanh trạng thái đầu phòng: đồng hồ Pomodoro, phase, người bắt đầu, mục tiêu buổi học.
- Menu trạng thái: Tập trung / Nghỉ / Cần giúp; badge trên tile.
- Nút giơ tay; toast cho người khác khi có người giơ tay.
- Reaction bay lên bằng framer-motion (đã có).
- Component dùng chung cho desktop và mobile; không copy logic hai nơi.

### P2-3. Hành vi Pomodoro
- Preset 15/3, 25/5, 50/10. Bất kỳ ai cũng bắt đầu được; người bắt đầu được dừng.
- Tự động chuyển phase khi hết giờ. Hết giờ hiện thông báo + âm thanh + rung nhẹ (nếu trình duyệt cho phép), sau đó owner tự chuyển focus ↔ nghỉ; owner có thể bấm "Dừng".
- Khi bắt đầu focus: không tự bật/tắt mic của người khác; chỉ hiện gợi ý.

### P2-4. Test Phase 2
- `meet-protocol.test.ts`: parse/validate attribute, chọn timer mới nhất, emoji ngoài whitelist bị bỏ.
- `meet-timer.test.ts`: remaining không âm, hết giờ đúng, clock lệch.
- Test component với happy-dom cho thanh timer và badge trạng thái.

---

## Phase 3 — Host, moderation, admin (0đ)

### P3-1. Host
- `/token` ghi `meet_rooms.host_uid` cho người tạo phòng đầu tiên (`INSERT ... ON CONFLICT DO NOTHING` rồi `SELECT`).
- Response trả `isHost`; UI hiện badge "Chủ phòng".
- Không cấp `roomAdmin` trong token client (client không gọi được RoomService); mọi thao tác moderation đi qua Worker và kiểm tra `uid === host_uid`.

### P3-2. Moderation
- `POST /rooms/:name/mute-all`, `POST /rooms/:name/kick` (body `{identity}`), `POST /rooms/:name/lock`.
- Auth: Firebase token + là host, hoặc `ADMIN_TOKEN`.
- UI host: mute tất cả, mời ra khỏi phòng, khoá phòng (người mới bị từ chối ở `/token` với message riêng).

### P3-3. Admin dashboard
- Trang `src/app/admin/meet/page.tsx` (dev-only) theo `src/app/admin/DESIGN.md`.
- Hiển thị **phòng đang mở, số người, thời lượng, nút đóng phòng**; dữ liệu lấy qua dev API mới dưới `src/app/api/livekit-admin/` dùng `livekit-server-sdk`, giữ guard `NODE_ENV === "development"`.
- Trang admin dev **không đọc được D1 production**. Số phút đã dùng/tháng xem bằng `GET /usage` của Worker (curl với `ADMIN_TOKEN`) và link tới LiveKit Cloud Dashboard; ghi rõ trong `docs/DEPLOY.md`. Không đưa `ADMIN_TOKEN` vào bundle frontend.

### P3-4. Lịch sử giờ học (user)
- Đọc từ `meet_sessions` qua Worker endpoint `GET /me`, trả tổng phút theo ngày/tuần.
- Hiển thị trong panel phòng học: "Tháng này bạn đã học nhóm X giờ".

---

## 6. Thứ tự thực hiện

```
Phase 0  → nghiệm thu → Phase 1 → nghiệm thu → Phase 2 → nghiệm thu → Phase 3
```

Không gộp phase. Không bắt đầu phase sau khi phase trước chưa được đánh dấu đạt.

## 7. Kịch bản kiểm thử thủ công (Phase 0)

1. Deploy Worker, cấu hình webhook, bấm "Send a test event" trong LiveKit Cloud.
2. Vào phòng bằng 2 tài khoản, kiểm tra webhook ghi 2 session.
3. Thoát 1 tài khoản, kiểm tra `duration_seconds` và `meet_usage_month` tăng đúng.
4. Gửi lại cùng webhook event (dùng test event id trùng nếu có) → không cộng đúp.
5. Đặt `LIVEKIT_MONTHLY_MINUTES=1` và `QUOTA_ENFORCE=true` → lần vào phòng tiếp theo nhận 429 và message tiếng Việt.
6. Đặt `QUOTA_ENFORCE=false` → vào được, không cần rollback code.
7. Mở phòng với `MAX_ROOM_PARTICIPANTS=2`, thử người thứ 3 → `/token` trả 409, UI báo "Phòng đã đủ người".
8. Đặt `SESSION_MAX_MINUTES=1`, vào phòng → tự ngắt sau ~1 phút, hiện thông báo đúng.
9. Gọi `GET /usage` bằng curl với `ADMIN_TOKEN` → số phút khớp với tổng session trong D1.
10. Tạm xoá D1 binding → `/token` vẫn phát token, trả `quotaStatus: "unknown"`, UI hiện banner.
11. Seed baseline: đặt `meet_usage_month` cho tháng hiện tại bằng số phút đã dùng thật, kiểm tra guard trừ đúng.
12. Kiểm tra mobile: pill thu nhỏ vẫn giữ kết nối, hết quota hiện message trong sheet.

## 8. Cấu hình & deploy

### Cloudflare Worker `livekit` (source: `workers/livekit-rooms/worker.js`)
- Env mới: `MAX_ROOM_PARTICIPANTS=6`, `LIVEKIT_MONTHLY_MINUTES=4500`, `QUOTA_ENFORCE=true`, `ROOM_EMPTY_TIMEOUT_SEC=300`, `SESSION_MAX_MINUTES=120`.
- D1 binding tên `DB` trỏ tới database đang dùng (có thể dùng chung với `data-api`).
- Chạy `workers/livekit-schema.sql` trên D1 (Dashboard → D1 → Console, hoặc `wrangler d1 execute`).
- Deploy lại bằng cách dán `worker.js` theo quy trình hiện tại trong `docs/DEPLOY.md`.

### LiveKit Cloud
- Settings → Webhooks → Create: URL `https://<worker>/webhook/livekit`, signing API key = `LIVEKIT_API_KEY`.
- Sau khi deploy, gửi test event và kiểm tra D1.

### Frontend
- Không thêm env mới. `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` giữ nguyên.
- Rebuild và deploy như cũ sau mỗi phase.

## 9. Checklist nghiệm thu (opencode sẽ kiểm tra)

1. `npm test` xanh, không giảm số test; 3 file test mới có mặt.
2. `npx tsc --noEmit` sạch.
3. `npm run lint` sạch (gồm check `!important`).
4. Diff không chứa secret, không hardcode key, không đổi `.env.local`.
5. Token decode đúng: `roomConfig.maxParticipants`, `canPublishData`, `canUpdateOwnMetadata`.
6. Webhook verify chữ ký thật, idempotent, chịu được event đến sai thứ tự; dùng timestamp của event, không dùng `now`.
7. `/token` trả `409 ROOM_FULL` khi phòng đủ người; `/rooms` trả `maxParticipants` + `remainingMinutes`; lobby hiển thị đúng trước khi vào.
8. D1 lỗi/thiếu binding → fail-open có `quotaStatus: "unknown"`, không sập phòng học.
9. Phiên tự ngắt ở `SESSION_MAX_MINUTES` (test với giá trị 1 phút).
10. Không có chỗ nào còn copy "10 người" hoặc hứa Pomodoro khi chưa làm.
11. Luồng desktop không hỏng: kéo, resize, fullscreen, đóng khi đang gọi.
12. Luồng mobile không hỏng: sheet, pill, giữ kết nối khi đóng sheet.
13. Có hướng dẫn cấu hình đủ để người khác deploy lại từ đầu, gồm seed số phút đã dùng.
14. Không thêm dependency ngoài SDK hiện có.
15. Code mới có test cho phần logic thuần; phần UI có ít nhất test render.

## 10. Rollback

- Tắt guard ngay bằng env `QUOTA_ENFORCE=false` (không cần deploy code).
- Giảm `MAX_ROOM_PARTICIPANTS` hoặc `LIVEKIT_MONTHLY_MINUTES` bằng env.
- Xoá webhook trong LiveKit Cloud nếu worker lỗi; phòng vẫn hoạt động, chỉ mất thống kê.
- Deploy lại phiên bản worker trước từ Dashboard.

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Webhook mất event → thống kê thiếu | `room_finished` đóng session còn mở; cho phép admin đối soát thủ công |
| Webhook bị gọi lại → cộng đúp | Bảng `meet_events` chống trùng theo event id |
| `roomConfig` bị bỏ qua với phòng đã tồn tại | Pre-check `ListParticipants` + fallback `CreateRoom`; phòng trống tự huỷ sau `emptyTimeout` |
| 5.000 phút vẫn hết nhanh | Ngưỡng chặn 4.500, hiện cảnh báo khi còn < 300 phút, giới hạn 6 người/phòng, phiên tối đa 120 phút |
| Tháng đầu tiên chưa có baseline → cấp thêm 4.500 phút | Bước seed trong §8 bắt buộc trước khi bật guard |
| Client sửa đồng hồ để vượt giới hạn phiên | Đây chỉ là chặn mềm; quota guard ở Worker là lớp cuối |
| Test cũ vỡ do mock LiveKit thiếu component mới | Cập nhật mock ngay trong phase tương ứng |
| PreJoin/device preview xin quyền thất bại | Vẫn cho vào phòng với mic/cam tắt |

## 12. Việc Gemini phải báo cáo sau mỗi phase

1. Danh sách file đã sửa/thêm.
2. Output 3 lệnh: `npm test`, `npx tsc --noEmit`, `npm run lint`.
3. Cách đã kiểm tra thủ công (kèm kết quả).
4. Điểm nào lệch kế hoạch và lý do.
5. Không tự ý sang phase tiếp theo.
