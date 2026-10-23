# DEPLOY — Chatbot ZenSpace (web tĩnh + Worker + Firebase)

> Thứ tự bắt buộc: Worker trước → Firebase → web. Mỗi bước có cách kiểm tra.
> Rules liên quan: `docs/guides/firestore-rules.md`. File Gemini cũ đã bỏ.

## Bước 0 — Xoay key đã lộ (làm 1 lần, trước khi online)

Các key từng dán ở khung chat coi như đã lộ:

1. **Groq:** vào `console.groq.com/keys` → tạo key mới → cập nhật Secret `GROQ_API_KEY` của Worker → **xóa key cũ**.
2. Kiểm tra repo không dính secret: `git grep -l "gsk_\|AIza" -- .` phải ra trắng (`.env.local` đã gitignore, không commit).

## Bước 1 — Deploy Worker `chat-proxy`

1. Dashboard → Workers & Pages → `chat-proxy` → Edit code → dán `workers/chat-proxy/worker.js` → Save and deploy.
2. Settings → Variables → Add. **Chọn đúng loại** (Secret = mã hóa, không ai xem lại được; Text = hiện chữ):| Tên                    | Loại            | Giá trị                                                                                                  |
   | ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
   | `GROQ_API_KEY`        | **Secret** | key Groq **mới** (đã xoay ở Bước 0). Danh sách model Groq tự tải từ Groq, không fix cứng |
   | `ADMIN_TOKEN`         | **Secret** | chuỗi khó đoán để xem `/status`                                                                    |
   | `FIREBASE_PROJECT_ID` | Text được     | `zenspace-d10m13y26`                                                                                     |
   | `ALLOWED_ORIGINS`     | Text được     | `https://zenstudy.space,http://localhost:3001` (**không để `*`** khi online)                  |
   | `USER_DAILY_LIMIT`    | Text được     | không bắt buộc (mặc định 30)                                                                         |
3. Settings → Bindings: `AI` (Workers AI) + `CHAT_QUOTA` (KV). Thiếu `AI` là `/chat` báo 500.
4. Kiểm tra: mở `/health` phải thấy `{"ok":true,"aiBinding":true,"kv":true}`.
5. Đổi model mặc định: mở trang admin local `http://localhost:3001/admin/chat` → thẻ Model → chọn → Đổi model (lưu vào KV, có hiệu lực ngay, không cần deploy lại). API tương ứng: `GET/POST /models?token=...`.

## Bước 1b — Deploy Worker `livekit` (phòng học nhóm)

1. Dashboard → Workers & Pages → chọn Worker `livekit` đã có → Edit code → dán `workers/livekit-rooms/worker.js` → Deploy.
   - Nếu chưa có Worker: Create Worker → đặt tên `livekit`.
   - Không tạo Worker `livekit-rooms`: `livekit-rooms` chỉ là tên thư mục source; Worker Cloudflare giữ tên `livekit` để không đổi URL.
2. Settings → Variables:| Tên                        | Loại            | Giá trị                                                                         |
   | --------------------------- | ---------------- | --------------------------------------------------------------------------------- |
   | `LIVEKIT_URL`             | **Secret** | `wss://<project>.livekit.cloud`                                                 |
   | `LIVEKIT_API_KEY`         | **Secret** | API key của LiveKit                                                              |
   | `LIVEKIT_API_SECRET`      | **Secret** | API secret của LiveKit (không đưa vào web)                                   |
   | `FIREBASE_PROJECT_ID`     | Text được     | `zenspace-d10m13y26` (**bắt buộc** — dùng để kiểm vé Firebase)    |
   | `ALLOWED_ORIGINS`         | Text được     | `https://zenstudy.space,http://localhost:3001`                                  |
   | `ADMIN_TOKEN`             | **Secret** | chuỗi khó đoán — dùng để gọi `GET /rooms?token=...` và `GET /usage` |
   | `MAX_ROOM_PARTICIPANTS`   | Text được     | `6` (mặc định 6, tối đa người / phòng)                                  |
   | `LIVEKIT_MONTHLY_MINUTES` | Text được     | `4500` (ngưỡng an toàn chặn quota, gói Build 5.000)                        |
   | `QUOTA_ENFORCE`           | Text được     | `true` (đặt `false` để tắt guard khẩn cấp mà không cần sửa code)   |
   | `ROOM_EMPTY_TIMEOUT_SEC`  | Text được     | `300` (giây phòng tự hủy khi chưa từng có ai vào)                    |
   | `ROOM_DEPARTURE_TIMEOUT_SEC` | Text được  | `300` (giây phòng tự hủy sau khi người cuối rời)                       |
   | `SESSION_MAX_MINUTES`     | Text được     | `120` (thời lượng tối đa một phiên học, tự ngắt)                      |
3. Settings → Bindings → Add → D1 database: Variable name `DB` trỏ tới database `zenspace` (dùng chung với `data-api`).
4. Mở D1 Database `zenspace` → tab **Console** → dán nội dung file `workers/livekit-schema.sql` → bấm **Execute** (tạo các bảng `meet_events`, `meet_sessions`, `meet_usage_month`, `meet_rooms`).
5. **Seed số phút đã dùng trong tháng hiện tại** trước khi bật guard (lấy số phút đã dùng từ LiveKit Cloud Dashboard):
   ```sql
   INSERT INTO meet_usage_month (month, participant_seconds, updated_at)
   VALUES ('2026-10', 0, 0)
   ON CONFLICT(month) DO UPDATE SET participant_seconds = excluded.participant_seconds;
   -- Thay số 0 bằng (số phút đã dùng trong tháng × 60)
   ```
6. Cấu hình Webhook trong LiveKit Cloud:
   - LiveKit Cloud Console → Settings → Webhooks → Add Webhook.
   - URL: `https://livekit.<bạn>.workers.dev/webhook/livekit`
   - Signing API Key: Chọn key ứng với `LIVEKIT_API_KEY`.
   - Bấm "Send a test event" để kiểm tra Worker trả về HTTP 200.
7. Giữ địa chỉ worker (`https://livekit.<bạn>.workers.dev`) trong `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` ở Bước 3. Nếu URL này không đổi thì không cần build lại frontend.
8. Kiểm tra:
   - `curl.exe -i -X POST https://<worker>/token` phải trả **401** (thiếu vé Firebase).
   - Kiểm tra hạn mức và số phòng: `curl.exe -i "https://<worker>/usage?token=<ADMIN_TOKEN>"` trả JSON thống kê tháng hiện tại (không chứa email hay uid người dùng).

## Bước 1c — Deploy Worker `data-api` (Kho Dữ Liệu Học Tập D1 Snapshot)

1. Dashboard → Workers & Pages → Create Worker → đặt tên `data-api` → Edit code → dán `workers/data-api/worker.js` → Deploy.
2. Settings → Variables:| Tên                    | Loại | Giá trị                                        |
   | ----------------------- | ----- | ------------------------------------------------ |
   | `FIREBASE_PROJECT_ID` | Text  | `zenspace-d10m13y26`                           |
   | `ALLOWED_ORIGINS`     | Text  | `https://zenstudy.space,http://localhost:3001` |
3. Settings → Bindings → Add → D1 database: Variable name: `DB` → Database: `zenspace`.
4. Mở D1 Database `zenspace` → tab **Console** → dán toàn bộ file `workers/schema.sql` → bấm **Execute** (để xóa sạch bảng thừa và tạo 2 bảng `user_data` + `chat_usage`).
5. Lấy địa chỉ Worker: `https://data-api.<bạn>.workers.dev` → điền vào `NEXT_PUBLIC_DATA_API_URL` ở Bước 3.

## Bước 2 — Firebase (Xác thực Google)

1. Authentication → Sign-in method → Google: **Enabled**.
2. Authentication → Settings → Authorized domains: chỉ giữ `zenspace-d10m13y26.firebaseapp.com`, `localhost`, `zenstudy.space` (+ `*.pages.dev` nếu còn dùng). Xóa domain lạ.
3. OAuth consent screen: thêm Gmail tester vào **Test users**; lên online thật thì **Publish app**.
4. Cloud Console → Credentials → OAuth client → Authorized JavaScript origins: `http://localhost:3001`, `https://zenstudy.space`.
5. Firestore → Rules: dán `firestore.rules` → Publish. Đợi 1 phút.

## Bước 3 — Web (Cloudflare Pages)

1. Pages → project web → Settings → Environment variables (Production) — cả 8 cái đều là **Text thường** (vì `NEXT_PUBLIC_*` nằm trong web, ai cũng thấy được — đây là mã công khai, không phải mật khẩu):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
     `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `NEXT_PUBLIC_CHAT_API_URL` = `https://chat-proxy.<bạn>.workers.dev`
   - `NEXT_PUBLIC_DATA_API_URL` = `https://data-api.<bạn>.workers.dev` (kho dữ liệu học tập D1, xem Bước 1c)
   - `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` = `https://livekit.<bạn>.workers.dev` (phòng học nhóm, xem Bước 1b)
   - **Tuyệt đối không thêm `GROQ_API_KEY` hay `ADMIN_TOKEN` vào đây.**
2. Deployments → Retry deployment (web tĩnh: đổi env phải đăng lại).
3. Kiểm tra: mở `zenstudy.space` → bong bóng chat → đăng nhập → hỏi 1 câu → F5 vẫn còn lịch sử.

## Bước 4 — Kiểm tra sau deploy (smoke test)

- [ ] Chưa đăng nhập: bấm chat chỉ thấy nút Google, không chat được.
- [ ] Đăng nhập acc chưa ghi tên (Testing mode): bị Google chặn đúng luật.
- [ ] Hỏi 1 câu: trả lời + Firestore có `conversations/{uid}`.
- [ ] Acc A không đọc được dữ liệu acc B (mở 2 trình duyệt test).
- [ ] `/status?token=...`: `workersAI.requestsToday` tăng, không có `lastAuthError` mới.
- [ ] Dùng hết 30 câu: báo "mai quay lại" (test bằng acc phụ hoặc hạ `USER_DAILY_LIMIT` tạm thời).
- [ ] Đồng bộ D1: đổi ghi chú ở laptop → F5 trên tab ẩn danh / điện thoại (cùng acc) thấy thay đổi nguyên vẹn.
- [ ] Nút "Đồng bộ ngay": bấm vào badge góc trên → hiện toast "Đã sao lưu lên đám mây thành công!".
- [ ] Kiểm thử tải: chạy `npm run test:load` đạt 100% thành công cho 200 CCU.
- [ ] Phòng học nhóm: chưa đăng nhập → chỉ thấy nút Google; đăng nhập → vào phòng, máy thứ 2 cùng tên phòng thấy nhau.
- [ ] `curl.exe -X POST https://<worker-livekit>/token` không kèm vé → **401** (không lấy được vé chùa).

## Quy tắc bảo mật (giữ suốt đời dự án)

| Loại                                   | Để ở đâu                                      | Tuyệt đối không                    |
| --------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `GROQ_API_KEY`, `ADMIN_TOKEN`       | Secrets của Worker                                | Lên Git, lên khung chat, ra frontend |
| `FIREBASE_PROJECT_ID`                 | Secret Worker + env web                            | Không sao (công khai được)        |
| 4 mã Firebase + Client ID + URL Worker | `NEXT_PUBLIC_*` (nằm trong web, ai cũng thấy) | Coi chúng là mật khẩu              |
| Lịch sử chat                          | Firestore (luật R4: chính chủ mới thấy)       | Log vào Worker/KV                     |

- Key lộ ở đâu → xoay ngay ở đó (tạo mới → cập nhật → xóa cũ), trong vòng 24h.
- Không đưa vào chatbot: mật khẩu, CCCD, số điện thoại, tài liệu mật (bản free có thể bị dùng để cải thiện model).
- Không cho web khác gọi chùa API: `ALLOWED_ORIGINS` chỉ liệt kê domain mình (R: Worker đã đòi vé Firebase + 30 câu/ngày nên đây là lớp chặn thứ 2).
- Hằng tháng ngó 3 bảng: Cloudflare AI dashboard (neurons), Groq usage, Firebase Usage. Tăng đột biến = có người phá → hạ `USER_DAILY_LIMIT`, kiểm tra Rules.
