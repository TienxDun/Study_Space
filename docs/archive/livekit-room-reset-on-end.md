# Kế Hoạch: Reset Phòng LiveKit Sau 5 Phút Không Có Ai

- **Ngày lập:** 2026-10-24
- **Phạm vi:** `workers/livekit-rooms/worker.js` + test `src/__tests__/unit/study/*`
- **Mục tiêu:** Phòng không còn ai bên trong (hoặc chưa từng có ai vào) trong **5 phút** thì reset toàn bộ metadata: host, phó phòng, mật khẩu, khóa. Lần dùng lại cùng tên phòng, người đầu tiên vào là host mới.
- **Không làm:** không reset khi phòng vẫn còn người; không reset ngay khi người cuối rời (chờ đủ 5 phút).

---

## 1. Nguyên Lý

LiveKit đóng phòng và bắn webhook `room_finished` khi:

- Không có ai vào và hết `empty_timeout` (phòng vừa tạo, không ai join).
- Người cuối cùng rời và hết `departure_timeout`.

Hiện `CreateRoom` (`worker.js:907-918`) không set `departure_timeout` (mặc định LiveKit **20 giây**), còn `empty_timeout` mặc định 300 giây. Vì vậy nếu xóa metadata ngay trong `room_finished` như bản plan cũ, chỉ cần cả nhóm mất mạng ~20 giây là mất host/mật khẩu/khóa.

Cách làm: **đặt cả hai timeout = 300 giây**, rồi xóa metadata trong `room_finished`. Không cần cron, không cần cột mới, không cần thêm D1 write định kỳ.

---

## 2. Thay Đổi Config

### 2.1. `getConfig` (`worker.js:360-368`)

```js
emptyTimeoutSec: clampInt(env.ROOM_EMPTY_TIMEOUT_SEC, 300, 60, 3600),
departureTimeoutSec: clampInt(env.ROOM_DEPARTURE_TIMEOUT_SEC, 300, 60, 3600),
```

- Đổi default `ROOM_EMPTY_TIMEOUT_SEC`: 300 → **300**.
- Thêm biến mới `ROOM_DEPARTURE_TIMEOUT_SEC`, default **300**.
- Cập nhật comment đầu file (`worker.js:13-17`): thêm 2 biến này, ghi rõ đơn vị giây.

### 2.2. `mintRoomToken` (`worker.js:127-130`)

```js
roomConfig: {
  maxParticipants: cfg.maxParticipants ?? 6,
  emptyTimeout: cfg.emptyTimeoutSec ?? 300,
  departureTimeout: cfg.departureTimeoutSec ?? 300,
},
```

### 2.3. `CreateRoom` trong `/token` (`worker.js:913-917`)

```js
body: JSON.stringify({
  name: room,
  max_participants: cfg.maxParticipants,
  empty_timeout: cfg.emptyTimeoutSec,
  departure_timeout: cfg.departureTimeoutSec,
}),
```

`/token` gọi `CreateRoom` trước khi mint token nên giá trị ở đây là giá trị có hiệu lực; `roomConfig` chỉ là fallback khi phòng được tạo tự động lúc join.

---

## 3. Xóa Metadata Trong `room_finished`

Nhánh hiện tại: `worker.js:665-679` (đóng các `meet_sessions` còn mở). Giữ nguyên phần đóng session, thêm **một** câu lệnh atomic ngay sau đó:

```js
const cutoff = Math.min(eventTime, Number(event.room?.creationTime || eventTime));
const del = await env.DB.prepare(
  `DELETE FROM meet_rooms
    WHERE name = ?
      AND created_at <= ?
      AND NOT EXISTS (
        SELECT 1 FROM meet_sessions
        WHERE room = ? AND left_at IS NULL AND joined_at > ?
      )`
).bind(room, cutoff, room, cutoff).run();
```

Giải thích từng điều kiện:

| Điều kiện | Chặn trường hợp |
| --- | --- |
| `created_at <= cutoff` | Row metadata mới do `/token` tạo **sau khi phòng cũ đóng** (người khác đã vào phòng mới trước khi webhook retry tới). Không xóa host mới. |
| `NOT EXISTS (... joined_at > cutoff)` | Có người thật đang trong phòng (session mở của instance mới). |
| `joined_at > cutoff` (không phải mọi session mở) | Session mồ côi của instance cũ không chặn xóa vĩnh viễn. |
| 1 câu `DELETE` | Không còn khoảng trống giữa bước kiểm tra và bước xóa (bản plan cũ dùng `SELECT COUNT` rồi `DELETE`). |

`cutoff` lấy `min` của thời điểm webhook và `room.creationTime` (LiveKit trả unix **giây**, cùng đơn vị `meet_rooms.created_at`).

**Không** xóa `meet_audit_logs`. Audit là bằng chứng kick/lock/mute; reset quyền không cần xóa log. Nếu sau này muốn dọn log thì làm job riêng theo retention.

**Không** nuốt lỗi DB. Nếu `DELETE` lỗi, để exception rơi vào `catch` hiện có (`worker.js:689-692`) → trả 500 → LiveKit retry. Tuyệt đối không trả 200 khi xóa chưa xong, vì `meet_events` (`worker.js:682-686`) sẽ đánh dấu event đã xử lý và retry bị dedupe (`worker.js:594-601`) → metadata kẹt vĩnh viễn.

---

## 4. Sửa `/token`: Host Đầu Tiên Luôn Đúng

Sau khi reset, nhiều người có thể gọi `/token` cùng lúc cho cùng tên phòng. Code hiện tại `INSERT` trần (`worker.js:815-817`) và nuốt lỗi (`worker.js:856-858`): người thua race bị PK violation → âm thầm thành `member`, có thể không ai là host.

Thay bằng `INSERT ... ON CONFLICT DO NOTHING` rồi đọc lại row (đúng ý định đã ghi ở `docs/archive/livekit-free-meeting-plan.md:369`):

```js
let roomRow = await env.DB.prepare(
  "SELECT host_uid, host_identity, co_host_uids, locked, password_hash FROM meet_rooms WHERE name = ?"
).bind(room).first();

let isNewRoom = false;
if (!roomRow) {
  await env.DB.prepare(
    "INSERT INTO meet_rooms (name, host_uid, host_identity, co_host_uids, locked, password_hash, created_at) VALUES (?, ?, ?, '[]', 0, ?, ?) ON CONFLICT(name) DO NOTHING"
  ).bind(room, checked.uid, identity, initialPassHash, nowSec).run();

  roomRow = await env.DB.prepare(
    "SELECT host_uid, host_identity, co_host_uids, locked, password_hash FROM meet_rooms WHERE name = ?"
  ).bind(room).first();

  isNewRoom = !!roomRow && roomRow.host_uid === checked.uid;
}
```

- `isNewRoom === true` → `role = "host"`, `isHost = true`, bỏ qua kiểm tra mật khẩu (host vừa đặt mật khẩu trong body).
- `isNewRoom === false` → giữ nguyên nhánh cũ: tính `isHost`/`isCoHost`, kiểm tra `password_hash`, kiểm tra `locked`.
- Nếu `roomRow` vẫn `null` sau insert → ném lỗi (để `catch` trả 500), không gán `role = "member"` âm thầm.

Phần còn lại của `/token` (quota, chặn phòng đầy, `CreateRoom`, mint token) không đổi.

---

## 5. File Cần Sửa

### 5.1. `workers/livekit-rooms/worker.js`

1. Comment đầu file: thêm `ROOM_DEPARTURE_TIMEOUT_SEC`, sửa default `ROOM_EMPTY_TIMEOUT_SEC` = 300.
2. `getConfig`: thêm `departureTimeoutSec`, đổi default empty.
3. `mintRoomToken`: thêm `departureTimeout` + default 300 cho `emptyTimeout`.
4. `CreateRoom` trong `/token`: thêm `departure_timeout`.
5. `room_finished`: thêm `DELETE` atomic ở mục 3.
6. `/token` khối D1: `ON CONFLICT DO NOTHING` + đọc lại + `isNewRoom` (mục 4).

### 5.2. `workers/livekit-schema.sql`

Không đổi schema. **Không** chạy lại file này khi deploy: file đang có `DROP TABLE IF EXISTS meet_rooms / meet_audit_logs` (`livekit-schema.sql:39-40`), chạy lại là mất sạch dữ liệu thật.

### 5.3. `docs/deployment/DEPLOY.md`

Thêm 2 biến môi trường `ROOM_EMPTY_TIMEOUT_SEC=300`, `ROOM_DEPARTURE_TIMEOUT_SEC=300` vào danh sách Variables của worker.

---

## 6. Test

### 6.1. `src/__tests__/unit/study/meet-webhook.test.ts` (dùng sqlite thật)

Thêm 4 test:

1. **Xóa metadata sau `room_finished`:**
   - Seed `meet_rooms` (`created_at` trước `room.creationTime`) và 1 `meet_audit_logs`.
   - Gửi `room_finished`.
   - Assert: session mở đã đóng; `meet_rooms` không còn row; `meet_audit_logs` **vẫn còn**.
2. **Retry idempotent:** gửi lại đúng event đó → 200, `duplicate: true`, không lỗi, row không hồi sinh.
3. **Không xóa phòng mới:** seed `meet_rooms` với `created_at` **lớn hơn** `room.creationTime` → row vẫn còn sau webhook.
4. **Không bị chặn bởi session mồ côi:** seed 1 `meet_sessions` mở với `joined_at` **nhỏ hơn** `cutoff` → row vẫn bị xóa.

Lưu ý: harness tự chạy `livekit-schema.sql` (`meet-webhook.test.ts:35-39`) nên không cần đổi mock.

### 6.2. `src/__tests__/unit/study/meet-token-claims.test.ts`

- Thêm assert `payload.roomConfig.departureTimeout === 300`.
- Thêm assert `payload.roomConfig.emptyTimeout === 300` khi không truyền `emptyTimeoutSec`.

### 6.3. `src/__tests__/unit/study/meet-host-moderation.test.ts` (MockD1)

MockD1 hiện chưa hỗ trợ `DELETE`, chưa hỗ trợ `ON CONFLICT`, và `run()` trả `{success:true}` cho mọi query lạ (`meet-host-moderation.test.ts:68-121`) → test sẽ pass giả. Phải thêm vào `run()`:

- `INSERT INTO MEET_ROOMS ... ON CONFLICT` → nếu `Map` đã có key thì không ghi đè.
- `DELETE FROM MEET_ROOMS WHERE NAME = ?` → xóa khỏi Map.

Test cần thêm:

1. Seed `phong-ket-thuc` host cũ + audit log. Gửi `room_finished` (dùng fake DB hoặc chuyển test này sang `meet-webhook.test.ts` với sqlite thật — khuyến nghị).
2. User khác gọi `POST /token` với `phong-ket-thuc` → `role === "host"`, `isHost === true`, `host_uid` là user mới.
3. Hai user gọi `/token` đồng thời cho phòng mới → đúng 1 host, 1 member.

### 6.4. Test hiện có phải pass

- `maintains host role when creator reconnects` — vẫn host khi phòng chưa hết 5 phút rỗng.
- `assigns member role to normal participants` — member vẫn là member.
- Toàn bộ moderation (lock/password/co-host/kick/mute) và quota không đổi.

---

## 7. Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| Phòng tạo xong không ai vào | `empty_timeout` 300s → `room_finished` → xóa metadata |
| Mọi người rời phòng | `departure_timeout` 300s → `room_finished` → xóa metadata |
| Rời 9 phút rồi vào lại | Phòng chưa đóng → host/phó phòng/mật khẩu/khóa giữ nguyên |
| Người cuối rời, 5 phút sau quay lại | Phòng đã đóng, metadata đã xóa → là host mới |
| Webhook retry nhiều lần | `DELETE` idempotent, lần sau no-op |
| Người khác mở lại cùng tên phòng trước khi webhook retry tới | `created_at <= cutoff` giữ nguyên host mới |
| Session mồ côi `left_at IS NULL` của phòng cũ | Không chặn xóa (`joined_at > cutoff`) |
| D1 lỗi khi xóa | Trả 500, không ghi `meet_events`, LiveKit retry |
| Mất mạng 20 giây | Không reset (timeout 300s) |
| Audit log | Giữ nguyên |

---

## 8. Đánh Đổi Đã Biết

- Phòng rỗng vẫn tồn tại trên LiveKit 5 phút. Không tốn quota vì quota tính theo `participant_seconds`, nhưng phòng rỗng vẫn hiện trong danh sách phòng của LiveKit (không hiện ở `/rooms` vì `ListRooms` vẫn trả phòng rỗng — nếu cần ẩn, lọc `numParticipants > 0`).
- Muốn reset ngay lập tức thì cần thêm nút "Kết thúc phòng" gọi `DeleteRoom`; ngoài phạm vi plan này.

---

## 9. Lệnh Kiểm Tra

```bash
npx vitest run src/__tests__/unit/study/meet-webhook.test.ts src/__tests__/unit/study/meet-host-moderation.test.ts src/__tests__/unit/study/meet-token-claims.test.ts
npm test
npx tsc --noEmit
npm run lint
```

---

## 10. Tiêu Chí Hoàn Thành

- Phòng rỗng 5 phút (kể cả chưa từng có ai) → metadata `meet_rooms` bị xóa, audit log giữ nguyên.
- Người đầu tiên vào phòng sau reset là host; hai người vào cùng lúc chỉ có đúng 1 host.
- Rời phòng dưới 5 phút rồi vào lại vẫn giữ host/phó phòng/mật khẩu/khóa.
- Không xóa nhầm metadata của phòng mới khi webhook cũ tới muộn.
- Không thêm dependency, không đổi schema D1.
