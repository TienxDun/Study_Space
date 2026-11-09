# Quản lý người dùng trong admin — kế hoạch

Trạng thái: **G0–G2 đã xong và đang chạy trên production** (2026-11-10). G3 hoãn. Bản 2 — 2026-11-10.
Tiếp nối `docs/features/ADMIN_CONSOLE_PLAN.md` (P2). P3 vẫn là hộp thư phản hồi; tài liệu này là một nhánh riêng.

## Mục tiêu

Một tab **Người dùng** trong shell admin để:

1. Xem danh sách người đã đăng nhập: email, tên hiển thị, lần đăng nhập cuối, lần đồng bộ gần nhất, số câu chat hôm nay, đang bị hạn chế hay không.
2. Xem chi tiết một người: 30 ngày chat, dung lượng bản lưu, hạn chế đang áp, báo cáo liên quan.
3. Khóa/mở AI và phòng học của một người — **tái dùng endpoint hạn chế đã có**, không viết lại.

Không làm trong tài liệu này: đọc nội dung ghi chú/task của người dùng (dữ liệu riêng tư trong `data_json`), sửa hộ dữ liệu học tập, gửi email hàng loạt.

## Hiện trạng dữ liệu

| Nguồn                                  | Có gì                                                        | Thiếu gì            |
| --------------------------------------- | -------------------------------------------------------------- | --------------------- |
| D1 `user_data`                        | `uid`, `updated_at`, kích thước bản lưu               | không có email/tên |
| D1 `chat_usage`                       | `uid`, ngày, số câu                                       | —                    |
| D1 `user_restrictions`                | `uid`, khóa AI/phòng, ghi chú                             | —                    |
| D1 `user_blocks`, `content_reports` | uid + tên hiển thị tại thời điểm báo cáo/chặn        | —                    |
| Firebase Auth                           | email, tên, ngày tạo, lần đăng nhập cuối, `disabled` | phải gọi Admin API  |

Điểm quan trọng: **D1 không có email**, nên danh sách bắt buộc lấy danh tính từ Firebase. `data-api` đã có `FIREBASE_SERVICE_ACCOUNT` và hàm mint token (dùng cho `DELETE /account`), nên không cần thêm bộ thư viện nào; chỉ cần một route nội bộ mới.

## Kiến trúc

```
Trình duyệt admin (sau Cloudflare Access)
  → admin-worker  GET /api/admin/users?page=<token>&size=25
       1. gọi data-api GET /admin/users?size=25&pageToken=… (Bearer ADMIN_TOKEN)
             → Firebase Admin API accounts:batchGet (1 request)
       2. xem cache KV `usrv1:<hash uid list>` (TTL 60s) → có thì ghép số liệu, trả luôn
       3. cache trượt: ghép số liệu D1 bằng 3 query `WHERE uid IN (…)`, tối đa 25 uid
       4. ghi cache số liệu (không chứa email), trả JSON
  → admin-worker  GET /api/admin/users/lookup?email=…  (tìm chính xác, 3 query một uid)
  → admin-worker  GET /api/admin/users/:uid  (chi tiết, 6 query một uid)
  → admin-worker  POST /api/admin/users/:uid/chat-reset  (1 audit + 1 xóa chat_usage)
  → admin-worker  POST /api/admin/users/:uid/restrictions  (đã có sẵn)
```

- Email/tên **không** ghi vào D1, không ghi vào KV, không ghi vào `admin_audit`. Danh tính vì vậy luôn lấy tươi từ Firebase mỗi lần mở tab; cache chỉ tiết kiệm phần D1.
- Cache chỉ chứa số liệu theo uid, không chứa PII; TTL 60 giây, chỉ trang đầu và chi tiết.
- Route mới của `data-api` trả 401 nếu thiếu Bearer, để lộ ra ngoài cũng vô dụng.

## Hạn mức phải giữ

Cloudflare Free (đang dùng): D1 **5.000.000 dòng đọc/ngày**, **100.000 dòng ghi/ngày**, 5 GB; KV **100.000 đọc/ngày**, **1.000 ghi/ngày**; Workers **100.000 request/ngày**, tối đa **50 query D1 mỗi lần gọi Worker**.

Ngân sách thiết kế cho từng thao tác:

| Thao tác                           | D1 đọc                                                                            | D1 ghi                                      | KV đọc/ghi     | Request ngoài                   |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- | ---------------- | -------------------------------- |
| Mở tab (25 người, cache trượt) | 75 dòng (25 `user_data` + 25 `chat_usage` hôm nay + 25 `user_restrictions`) | 0                                           | 0/1              | 1 Firebase page                  |
| Mở tab (cache trúng)              | 0                                                                                   | 0                                           | 1/0              | 0                                |
| Xem chi tiết                       | ~55 dòng (1 + 30 ngày chat + 1 hạn chế + 10 báo cáo + 2 chặn)                | 0                                           | 1/0              | 0 (dùng bản Firebase đã có) |
| Khóa/mở AI hoặc phòng           | 1                                                                                   | 2 (`user_restrictions` + `admin_audit`) | 0/1 (xóa cache) | 0                                |
| Reset hạn mức chat hôm nay       | 1                                                                                   | 1 (`chat_usage`)                          | 0/0              | 0                                |

Quy đổi: nếu mỗi ngày có 500 lượt mở tab, cache trúng 80% → 100 × 75 = **7.500 dòng đọc/ngày (0,15% trần)**. 100 thao tác khóa/ngày → **200 dòng ghi (0,2% trần)**. Còn rất xa giới hạn, nhưng thiết kế vẫn phải giữ đúng các chặn dưới đây để không phình khi số người tăng.

## Nguyên tắc bắt buộc (để không vượt hạn mức)

1. **Không tạo bảng `users`**, không ghi D1 lúc đăng nhập/đồng bộ. Danh tính lấy từ Firebase, số liệu lấy từ bảng có sẵn.
2. **Không cron, không quét toàn bảng.** Mọi query dùng khóa chính hoặc index đã có (`user_data.uid`, `chat_usage(uid, day)`, `user_restrictions.uid`, `idx_reports_reporter_created`, `idx_reports_target`, `idx_user_blocks_blocked`).
3. **Một trang = tối đa 4 query** (trần 50 query/lần gọi của Workers Free). Không query trong vòng lặp từng người.
4. **Chỉ số liệu hôm nay trong danh sách**; chuỗi 30 ngày chỉ tải ở trang chi tiết (≤30 dòng).
5. **Tìm kiếm chỉ theo email chính xác** (`accounts:lookup`), không tải nhiều trang để lọc — mỗi lần tìm là 1 request, không phải N.
6. **Cache KV chỉ cho trang đầu + chi tiết**, TTL 60 giây. Trang sâu (page 2 trở đi) không cache để số lần ghi KV không tăng theo số trang.
7. **Không audit thao tác đọc.** Chỉ ghi `admin_audit` khi khóa/mở/reset (mỗi thao tác đúng 1 dòng).
8. **Chặn cứng phía server**: `size` tối đa 50; từ chối `pageToken` lạ; mỗi response tối đa 50 người.

## Giai đoạn

### G0 — Hạ tầng đọc (0,5–1 ngày)

- [X] `data-api`: thêm `GET /admin/users?size=&pageToken=` (Bearer `ADMIN_TOKEN`, 401 nếu sai), dùng lại hàm mint token của `FIREBASE_SERVICE_ACCOUNT`; trả `{ users: [{uid, email, displayName, createdAt, lastSignInAt, disabled}], nextPageToken }`.
- [X] `data-api`: thêm `GET /admin/users/lookup?uid=|email=` dùng `accounts:lookup`.
- [X] Thêm secret `ADMIN_TOKEN` cho `data-api` trên dashboard (admin Worker đã có sẵn token này để gọi livekit) — đã đặt và deploy, danh sách thật đã hiện trong tab.
- [X] `admin-worker`: `GET /api/admin/users` — 1 trang Firebase + 3 query D1 `IN (…)`, cache KV 60s; `GET /api/admin/users/lookup?email=`; `GET /api/admin/users/:uid` — 6 query một uid.
- [X] Unit test (`users-api.test.ts`, 14 ca): thiếu Access token → 401; ghép đúng số liệu; cache trúng không đọc lại D1; data-api lỗi → 502; chi tiết trả 30 ngày chat + báo cáo + chặn; thiếu D1 vẫn trả danh tính; lookup email; reset hạn mức + guard.

- Xong khi: `curl` với token trả danh sách đúng, bảng `admin_audit` **không tăng** dòng nào, log D1 ghi nhận ≤4 query cho một trang.

### G1 — Tab chỉ đọc (1 ngày)

- [X] Shell: tab **Người dùng** sau tab Báo cáo — bảng email / tên / đăng nhập cuối / đồng bộ / chat hôm nay / trạng thái; nút "Tải thêm" theo `nextPageToken` (`admin-host/panels/users.html`, `admin-host/scripts/users.js`, `admin-host/styles/users.css`).
- [X] Ô tìm email chính xác; không thấy thì báo rõ, không tự quét.
- [X] Panel chi tiết: 30 ngày chat, dung lượng bản lưu, hạn chế hiện tại, số báo cáo liên quan.
- [X] Tách chi tiết khỏi danh sách thành màn hình riêng: bấm **Xem** thì ẩn danh sách, mở thanh định danh (email, tên/UID, badge trạng thái) và lưới thẻ Thông tin / Chat 30 ngày / Báo cáo / Kiểm soát; nút **Danh sách** quay lại giữ nguyên trang đang tải, vị trí cuộn và kết quả tìm. Khi đang tải chi tiết thì khóa nút ghi; lỗi hiện trong màn chi tiết.
- [X] DOM test (`users-panel.test.ts`, 13 ca, dùng chung cho G1+G2): trang đầu, tải thêm, tìm không thấy, tìm thấy, email trống, data-api lỗi → bảng rỗng + thông báo (không treo tab); mở/đóng màn chi tiết; chi tiết lỗi vẫn quay lại được.

- Xong khi: đăng nhập admin thấy danh sách thật; mở tab 1 lần ≤ 4 query D1; không có dòng audit mới.

### G2 — Thao tác khóa/mở (0,5–1 ngày)

- [X] Khối **Khóa AI** / **Khóa phòng** + ô ghi chú trong panel chi tiết, gọi `POST /api/admin/users/:uid/restrictions` có sẵn (audit `user.restrictions` đã có).
- [X] Nút **Đặt lại hạn mức chat hôm nay** — route `POST /api/admin/users/:uid/chat-reset`: 1 audit `user.chat_reset` + 1 `DELETE chat_usage` theo ngày Thái Bình Dương, xóa key KV `user:<uid>:<ngày>` dự phòng.
- [X] Sau thao tác: xóa cache KV chi tiết (`usrv1:one:*`), cập nhật dòng trong bảng tại chỗ; cache danh sách tự hết hạn sau 60 giây.
- [X] Test: 3 ca API (audit trước, audit lỗi thì không xóa, sai method/thiếu D1) + 3 ca DOM (hiện hạn chế, lưu hạn chế, đặt lại hạn mức).

- Xong khi: khóa AI một tài khoản thử → chat trả 403, mở lại chạy bình thường; mỗi thao tác ≤2 dòng ghi D1.
- Đã kiểm tra UI trên bundle thật với dữ liệu production (5 tài khoản); **chưa bấm khóa một tài khoản thật để xác nhận chat trả 403** — cần làm ở lần kiểm tra tiếp theo.

### G3 — Tùy chọn, chỉ làm khi cần

- [ ] Xóa tài khoản từ admin: route nội bộ mới trên `data-api` (Bearer `ADMIN_TOKEN`) tái dùng `deleteAccountData`; audit trước khi xóa; xác nhận gõ email.
- [ ] Xuất CSV tại trình duyệt từ dữ liệu đã tải (không thêm request).
- [ ] Thao tác hàng loạt: chỉ khóa/mở, tối đa 20 người/lần, mỗi người 2 dòng ghi.

## Đo và chặn vượt hạn mức

- G1–G2 đã deploy ngày 2026-11-10. Mốc theo dõi: D1 → Metrics trên dashboard Cloudflare (dòng đọc/ghi mỗi ngày) và Workers → Requests toàn account.
- Sau 24 giờ: so với mốc deploy; nếu tăng > 50.000 dòng đọc/ngày (1% trần) thì tăng TTL cache hoặc giảm `size` mặc định.
- Thêm cảnh báo mềm trong tab: nếu `nextPageToken` bị lỗi/hết hạn, chỉ hiện nút "Tải lại danh sách", không tự thử nhiều trang.

## Rủi ro

- **Token phân trang Firebase hết hạn**: trả lỗi rõ và cho tải lại từ đầu; không giữ token quá 10 phút.
- **KV nhất quán trễ ~60 giây**: chấp nhận với trang chỉ đọc; sau thao tác ghi thì xóa cache để không thấy số liệu cũ.
- **PII**: email/tên không vào D1/KV/audit; chỉ nằm trong response và RAM trình duyệt.
- **Secret mới**: `ADMIN_TOKEN` cho `data-api` phải đặt trên dashboard, không nằm trong repo; thiếu thì route mới trả 503 rõ ràng.
- **Workers Free 10 ms CPU/lần gọi**: ghép 3 query + 1 fetch vừa đủ; nếu vượt, chuyển sang trả danh sách Firebase trước và số liệu D1 sau (2 lượt).

## Quyết định đã chốt

1. Làm tuần tự: G1 (chỉ đọc) trước, rồi mới G2 (khóa/mở/reset) — không gộp.
2. G3 (xóa tài khoản từ admin) **hoãn**; vẫn dùng luồng người dùng tự xóa.
3. Không tìm theo tên hiển thị; chỉ tìm theo email chính xác.
