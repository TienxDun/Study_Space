# Phòng học nhóm (LiveKit) — Hiện trạng triển khai

Cập nhật: 22/10/2026
Phạm vi: Phase 0–3 (giới hạn miễn phí, đếm phút, trải nghiệm phòng, tương tác học tập)
Trạng thái: Phase 0/1 đạt code/test; Phase 2 hoàn thành (code/unit test + P2-6 thủ công); Phase 3 (host, khóa phòng, mật khẩu, đồng host) đã triển khai.

## 1. Tổng quan

Phòng học nhóm cho phép người dùng đã đăng nhập Google vào một phòng video/audio để học cùng nhau. Hệ thống dùng LiveKit Cloud (gói Build miễn phí), Cloudflare Worker để phát token và Cloudflare D1 để lưu thời lượng học.

Phase 0 tập trung vào ba việc:

- Không vượt giới hạn miễn phí của LiveKit.
- Không bị cộng sai/trùng phút học.
- Sửa các nội dung quảng cáo không đúng thực tế.

## 2. Người dùng làm được gì

### Sảnh phòng học

- Đăng nhập bằng Google trước khi vào phòng.
- Xem danh sách phòng đang mở và số người trong từng phòng.
- Tự nhập tên phòng để vào, hoặc bấm vào phòng có sẵn.
- Tên phòng được chuẩn hóa: chữ thường, bỏ dấu, chỉ giữ chữ/số/gạch ngang.

### Trong phòng — desktop

- Cửa sổ nổi, kéo và thay đổi kích thước được.
- Bật/tắt micro, camera.
- Chia sẻ màn hình kèm âm thanh hệ thống.
- Chat trong phòng.
- Chế độ toàn màn hình.
- Xem số người đang trong phòng.
- Xem đồng hồ đếm ngược phiên học.
- Xác nhận trước khi rời phòng.

### Trong phòng — mobile

- Bảng dưới dạng sheet, có thể thu nhỏ thành thanh nổi để tiếp tục học khi chuyển tab.
- Bật/tắt micro, camera.
- Chat dạng drawer trượt từ dưới lên.
- Xem chia sẻ màn hình của người khác.
- Xem số người và đồng hồ phiên.
- Chưa có nút tự chia sẻ màn hình trên mobile.

### Mặc định

- Micro và camera **tắt** khi vào phòng; người dùng tự bật.
- Chat chỉ tồn tại trong phiên, không lưu lịch sử.

## 3. Giới hạn đang áp dụng

| Giới hạn                      | Giá trị          | Cách xử lý                                              |
| ------------------------------- | ------------------ | ---------------------------------------------------------- |
| Số người mỗi phòng         | 6                  | Người thứ 7 nhận lỗi `ROOM_FULL` (HTTP 409)         |
| Thời lượng một phiên       | 120 phút          | Đồng hồ đếm ngược, tự ngắt khi hết giờ          |
| Phút WebRTC mỗi tháng        | 4.500 phút        | Chặn vào phòng mới bằng `QUOTA_EXCEEDED` (HTTP 429) |
| Thời gian phòng trống        | 300 giây          | LiveKit tự đóng phòng sau 5 phút không còn ai       |
| Hiệu lực token vào phòng    | 2 giờ             | Token hết hạn sau 2 giờ                                 |
| Hạn mức thật của gói Build | 5.000 phút/tháng | Đặt ngưỡng chặn ở 4.500 để có khoảng an toàn    |

Các giá trị trên có thể đổi bằng biến môi trường của Worker, không cần sửa code.

## 4. Kiến trúc và luồng hoạt động

```text
Trình duyệt
  ├─ Firebase ID token (đăng nhập Google)
  ├─ POST /token  ──────────────► Cloudflare Worker
  │                                 ├─ kiểm tra Firebase
  │                                 ├─ kiểm tra hạn mức tháng (D1)
  │                                 ├─ kiểm tra phòng đủ người (LiveKit API)
  │                                 └─ phát token LiveKit
  ├─ Kết nối WebRTC ────────────► LiveKit Cloud
  └─ GET /rooms ────────────────► Worker ──► LiveKit API

LiveKit Cloud
  └─ Webhook join/leave/room_finished ──► Worker ──► D1
```

### Môi trường phát triển

- `src/app/api/livekit-token/route.ts`
- `src/app/api/livekit-rooms/route.ts`

Hai route này **chỉ chạy khi `NODE_ENV === "development"`**. Chúng dùng để chạy local, không dùng cho bản deploy thật. Ở chế độ dev, hạn mức và đếm phút được giả lập, không ghi vào D1.

### Môi trường thật

- Worker: `workers/livekit-rooms/worker.js` (deploy vào Cloudflare Worker tên `livekit`)
- Frontend gọi Worker qua `NEXT_PUBLIC_LIVEKIT_TOKEN_URL`.

## 5. Đếm phút và hạn mức tháng

### Cách đếm

1. Khi người dùng vào phòng, LiveKit gửi webhook `participant_joined`.
2. Worker tạo một dòng trong `meet_sessions` với thời điểm vào.
3. Khi người dùng rời phòng, webhook `participant_left` đóng phiên và tính số giây đã học.
4. Trigger SQLite `trg_meet_sessions_close` tự cộng số giây đó vào `meet_usage_month`.
5. Khi phòng đóng hoàn toàn, `room_finished` đóng nốt các phiên còn mở.

Thời gian được tính theo **thời điểm webhook**, không phải thời điểm Worker xử lý. Vì vậy webhook đến trễ vẫn cho số phút đúng.

### Chống trùng khi mạng lỗi

- Mỗi webhook có `id`; Worker kiểm tra `meet_events` trước khi xử lý.
- Chỉ ghi `meet_events` sau khi đã lưu xong phiên học.
- Nếu lỗi giữa chừng, LiveKit gửi lại và Worker xử lý tiếp mà không cộng đúp.
- Các câu lệnh insert dùng `ON CONFLICT DO NOTHING` để retry an toàn.

### Reconnect

Nếu người dùng mất mạng rồi vào lại cùng phòng:

- Phiên cũ được đóng tại thời điểm join mới.
- Phiên mới bắt đầu ngay sau đó.
- Tổng thời gian vẫn liên tục, không bị tính thành hai lần.

### Khi database lỗi

Worker **fail-open**:

- Vẫn phát token để người dùng vào học.
- Trả `quotaStatus: "unknown"`.
- Giao diện hiện "Không kiểm tra được hạn mức tháng".

Mục đích: sự cố D1 không làm hỏng buổi học.

### Xem số phút đã dùng

```http
GET https://<worker>/usage
Authorization: Bearer <ADMIN_TOKEN>
```

Hoặc `?token=<ADMIN_TOKEN>`.

Kết quả gồm:

- `month`: tháng hiện tại theo UTC.
- `usedMinutes`, `limitMinutes`, `remainingMinutes`.
- `roomsOpen`, `participants`.

Không trả uid hay email người dùng.

## 6. Cấu hình Worker

| Biến                       | Mặc định | Ý nghĩa                                                    |
| --------------------------- | ----------- | ------------------------------------------------------------ |
| `LIVEKIT_URL`             | —          | `wss://<project>.livekit.cloud`                            |
| `LIVEKIT_API_KEY`         | —          | API key LiveKit                                              |
| `LIVEKIT_API_SECRET`      | —          | API secret LiveKit, phải để dạng Secret                  |
| `FIREBASE_PROJECT_ID`     | —          | Project Firebase dùng để kiểm tra token đăng nhập     |
| `ALLOWED_ORIGINS`         | —          | Danh sách domain được gọi Worker, cách nhau dấu phẩy |
| `ADMIN_TOKEN`             | —          | Token xem `/rooms` và `/usage`                          |
| `MAX_ROOM_PARTICIPANTS`   | `6`       | Số người tối đa mỗi phòng (2–20)                     |
| `LIVEKIT_MONTHLY_MINUTES` | `4500`    | Ngưỡng chặn phút tháng (100–5000)                      |
| `QUOTA_ENFORCE`           | `true`    | Đặt `false` để tạm tắt chặn hạn mức               |
| `ROOM_EMPTY_TIMEOUT_SEC`  | `300`     | Giây giữ phòng trống trước khi đóng                  |
| `SESSION_MAX_MINUTES`     | `120`     | Thời lượng tối đa một phiên (15–240)                 |

Binding D1:

- Tên biến: `DB`
- Database: dùng chung database `zenspace` với `data-api`.

## 7. Dữ liệu D1

File schema: `workers/livekit-schema.sql`.

| Bảng                | Mục đích                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `meet_events`      | Chống xử lý trùng webhook                                               |
| `meet_sessions`    | Mỗi lần vào phòng là một phiên, lưu giờ vào/ra và số giây      |
| `meet_usage_month` | Tổng số giây đã dùng theo tháng, dùng để chặn hạn mức          |
| `meet_rooms`       | Đã tạo sẵn cho giai đoạn sau (host/khóa phòng), Phase 0 chưa dùng |

Trigger:

- `trg_meet_sessions_close`
- Chạy khi một phiên được đóng (`left_at` từ NULL thành có giá trị).
- Cộng `duration_seconds` vào `meet_usage_month` đúng một lần.

Lưu ý: nếu database đã tạo từ trước, phải chạy lại file schema để bổ sung trigger.

## 8. Bảo mật

- Mọi yêu cầu phát token đều phải có Firebase ID token hợp lệ.
- Danh tính trong LiveKit lấy từ `uid` Firebase (`user-<uid>`), không tin `userId` do client gửi.
- Tên phòng được lọc ký tự trước khi dùng.
- Worker chỉ trả token LiveKit sau khi kiểm tra đăng nhập.
- Webhook được xác thực bằng chữ ký HMAC SHA-256, `iss`, `exp` và hash SHA-256 của body.
- `/usage` yêu cầu `ADMIN_TOKEN`.
- Không có secret nào nằm trong mã frontend.

## 9. Kiểm thử

Đã có test tự động cho:

- Token có đúng quyền và `roomConfig`.
- Chữ ký webhook, body bị sửa, sai secret, hết hạn, sai API key.
- Chống trùng webhook và retry sau lỗi database.
- Reconnect không cộng dư phút.
- Chặn hạn mức trả 429.
- Fail-open khi D1 lỗi.
- Tắt hạn mức bằng `QUOTA_ENFORCE=false`.

Kiểm tra gần nhất (22/10/2026):

- `npm test`: 48 test files, 311 test pass.
- `npx tsc --noEmit`: 0 lỗi.
- `npm run lint`: 0 error, 10 warning.
- `npm run build`: pass.

## 10. Trạng thái học tập, giơ tay, Pomodoro đồng bộ, reaction (Phase 2)

Tính năng tương tác trực tiếp trong phòng học nhóm:

- **Bản chất kỹ thuật:** Đây là tính năng **client-only**, sử dụng `Participant Attributes` và `Data Channel` của LiveKit Room. **Hoàn toàn không tốn thêm phút LiveKit**, không can thiệp Worker hay cơ sở dữ liệu D1.
- **Trạng thái học tập cá nhân:** Mỗi người có thể chọn trạng thái: `Tập trung` (emerald), `Nghỉ ngơi` (amber), `Cần giúp` (rose) hoặc `Bình thường`. Huy hiệu hiển thị trực quan ở góc trên trái khung hình video.
- **Giơ tay phát biểu:** Cho phép bật/tắt giơ tay. Khi một thành viên giơ tay, biểu tượng bàn tay xuất hiện trên tile video và các thành viên khác nhận được thông báo toast nhẹ (chống spam).
- **Pomodoro đồng bộ:** Bất kỳ ai trong phòng cũng có thể khởi tạo hoặc bấm "Đổi chu kỳ" để bắt đầu timer mới ghi đè timer cũ (kể cả khi owner rời phòng). Thời gian đếm ngược được tính từ mốc thời gian thực (`startedAt + duration`), đảm bảo đồng bộ cho tất cả thành viên. Khi hết giờ, owner tự động chuyển focus → nghỉ → focus; tất cả thành viên nhận toast + âm thanh + rung. Owner có thể bấm "Dừng" để kết thúc chuỗi tự động.
- **Mục tiêu học tập cá nhân:** Người dùng có thể đặt mục tiêu cá nhân ngắn gọn (tối đa 120 ký tự) cho phiên học. Mục tiêu hiển thị trên thanh công cụ và hiển thị trực tiếp trên khung hình video của bạn để các bạn cùng phòng cùng thấy và cùng cố gắng.
- **Reaction (Cảm xúc nhanh):** Thả 6 biểu tượng cảm xúc (👍, 👏, ❤️, 😂, 🎉, 🔥) bay lên sinh động trên khu vực video. Reaction được truyền qua Data Channel không tin cậy (lossy), điều tiết tốc độ tối đa 1 reaction/700ms, tự động biến mất sau 2.5 giây và **không lưu lịch sử**.

### Manual test P2-6 — ĐÃ KIỂM THỬ THỦ CÔNG

Đây là hạng mục duy nhất còn lại của Phase 2. Checklist với 2 tài khoản thực tế:

- [X] 2 tài khoản cùng phòng, thấy status của nhau
- [X] Giơ tay có toast, hạ tay rồi giơ lại vẫn toast
- [X] Owner rời phòng, timer vẫn còn, người khác ghi đè được
- [X] Hết giờ tự chuyển phase, tất cả nhận toast + âm thanh, không cần bấm
- [X] Mục tiêu hiện trên tile
- [X] Reaction hai chiều, tự biến mất
- [X] Mobile 320/375px không tràn ngang, menu reaction không bị cắt
- [X] Badge không che tên/mic/cam/nút chat/rời phòng

## 11. Chưa có trong các Phase hiện tại

Các mục sau thuộc giai đoạn sau, chưa triển khai:

- Host, khóa phòng, mật khẩu phòng, đồng host: đã triển khai Phase 3.
- Giao diện xem lịch sử điểm danh và quản trị phòng.
- Giới hạn 120 phút hiện được kiểm soát ở trình duyệt; chưa chặn phía server.

## 12. Checklist khi deploy

1. Chạy `workers/livekit-schema.sql` trên D1 để tạo bảng và trigger.
2. Nhập số phút đã dùng trong tháng hiện tại vào `meet_usage_month`.
3. Đặt đủ biến môi trường cho Worker, đặc biệt `FIREBASE_PROJECT_ID` và `ALLOWED_ORIGINS`.
4. Gắn binding D1 tên `DB`.
5. Bật webhook LiveKit trỏ tới `https://<worker>/webhook/livekit`.
6. Deploy Worker.
7. Giữ `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` trỏ tới Worker `livekit`; chỉ build lại frontend nếu URL thay đổi (biến `NEXT_PUBLIC_*` được nhúng lúc build).
8. Kiểm tra nhanh:
   - 2 tài khoản vào cùng phòng, thấy nhau, chat, chia sẻ màn hình.
   - Người thứ 7 bị báo phòng đủ.
   - Đồng hồ phiên chạy đúng.
   - Vào/rời phòng rồi gọi `/usage`, số phút tăng một lần.

## 13. Lỗi thường gặp

| Hiện tượng                        | Nguyên nhân thường gặp                             | Cách kiểm tra                                           |
| ------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------- |
| HTTP 429 `QUOTA_EXCEEDED`          | Đã chạm ngưỡng phút tháng                        | Gọi `/usage` xem `usedMinutes`                       |
| HTTP 409 `ROOM_FULL`               | Phòng đã đủ 6 người                              | Đổi phòng hoặc chờ người khác ra                  |
| "Không kiểm tra được hạn mức" | Thiếu binding `DB` hoặc D1 lỗi                     | Kiểm tra binding và log Worker                          |
| Số phút không tăng               | Thiếu trigger, webhook chưa bật, sai chữ ký        | Chạy lại schema; xem log webhook; kiểm tra signing key |
| Webhook trả 401                     | Sai `LIVEKIT_API_SECRET` hoặc signing API key        | Đối chiếu key trong LiveKit Console và Worker         |
| Số phút admin thấp hơn LiveKit Cloud | Webhook chưa bật ở giai đoạn trước hoặc chưa seed đúng | Đối soát `meet_usage_month` theo mục 13.1             |
| Danh sách phòng lỗi 502           | Sai `LIVEKIT_URL` hoặc API key                       | Kiểm tra secret của Worker                              |
| Lỗi CORS                            | Thiếu domain trong `ALLOWED_ORIGINS`                 | Thêm đúng domain, không có dấu `/` cuối          |
| Không phát được token           | Thiếu `FIREBASE_PROJECT_ID` hoặc chưa đăng nhập | Kiểm tra biến và token Firebase                        |

### 13.1. Đối soát số phút với LiveKit Cloud

Admin đếm phút bằng webhook (`participant_left` / `room_finished`) và chỉ cộng khi phiên đóng, nên số có thể thấp hơn LiveKit nếu webhook từng chưa bật. Muốn khớp lại:

1. Mở admin, bảo đảm **Phòng đang mở = 0** và **Người tham gia = 0** (tránh cộng trùng phiên đang chạy).
2. Lấy tổng phút của chu kỳ hiện tại trên LiveKit Cloud → Billing.
3. Chạy trong D1 `zenspace` → Console (thay `2026-10` bằng tháng admin đang hiện và `438` bằng số phút thật):

```sql
INSERT INTO meet_usage_month (month, participant_seconds, updated_at)
VALUES ('2026-10', 438 * 60, CAST(strftime('%s','now') AS INTEGER))
ON CONFLICT(month) DO UPDATE SET
  participant_seconds = excluded.participant_seconds,
  updated_at = excluded.updated_at;
```

Sau đó `/usage` và thẻ LiveKit hiện đúng số phút; các phiên mới vẫn cộng tiếp bình thường. Nếu muốn biết vì sao lệch, so tổng thời lượng phiên đã đóng với bộ đếm:

```sql
SELECT COUNT(*) AS total_sessions,
       COUNT(*) FILTER (WHERE left_at IS NULL) AS open_sessions,
       CAST(COALESCE(SUM(duration_seconds), 0) / 60 AS INTEGER) AS minutes_from_sessions
FROM meet_sessions WHERE billing_month = '2026-10';
```

- Bằng số admin đang hiện → D1 chưa từng nhận các phiên bị thiếu (webhook chưa bật).
- Bằng 0 trong khi admin > 0 → số đang hiện là seed tay; webhook chưa ghi được phiên nào.
- Có `open_sessions > 0` → phút của các phiên đó chưa được cộng; đợi phiên đóng rồi hãy đối soát.
- Lớn hơn số admin → trigger đếm thiếu; chạy lại `workers/livekit-schema.sql` và kiểm tra log webhook.

## 14. File liên quan

| File                                                        | Vai trò                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `workers/livekit-rooms/worker.js`                         | Phát token, danh sách phòng, hạn mức, webhook                     |
| `workers/livekit-schema.sql`                              | Bảng D1 và trigger đếm phút                                       |
| `src/components/study/rooms/StudyRoomsWidget.tsx`         | Sảnh phòng và cửa sổ phòng desktop                               |
| `src/components/study/rooms/StudyRoomView.tsx`            | Giao diện trong phòng desktop                                        |
| `src/components/study/rooms/RoomStudyBar.tsx`             | Thanh công cụ Pomodoro, trạng thái, giơ tay, mục tiêu, reaction |
| `src/components/study/rooms/RoomStudyLayer.tsx`           | Tầng tương tác học tập tích hợp cho phòng học                |
| `src/components/study/rooms/RoomReactionsOverlay.tsx`     | Hiệu ứng cảm xúc reaction bay lên                                 |
| `src/components/study/rooms/useMeetStudyState.ts`         | Hook quản lý logic trạng thái và đồng bộ Pomodoro              |
| `src/components/study/rooms/meet-protocol.ts`             | Protocol thuần và hàm tiện ích Phase 2                            |
| `src/components/study/rooms/RoomSessionTimer.tsx`         | Đồng hồ phiên dùng chung                                          |
| `src/components/study/mobile/sheets/MobileRoomsSheet.tsx` | Sảnh phòng mobile                                                    |
| `src/components/study/mobile/rooms/MobileRoomView.tsx`    | Giao diện trong phòng mobile                                         |
| `src/app/api/livekit-token/route.ts`                      | Phát token cho môi trường dev                                      |
| `src/app/api/livekit-rooms/route.ts`                      | Danh sách phòng cho môi trường dev                                |
| `src/__tests__/unit/study/meet-*.test.ts`                 | Test token, hạn mức, webhook, protocol, timer                        |
| `src/__tests__/unit/study/room-study-bar.test.tsx`        | Test thanh công cụ tương tác học tập                            |
| `docs/DEPLOY.md`                                          | Hướng dẫn deploy Worker và D1                                      |
