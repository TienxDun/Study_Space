# D1 Backend — Kho dữ liệu học tập (Giai đoạn 1)

> Mục tiêu: dựng "kho online" bằng Cloudflare D1 và **cứu sổ đếm quota chat**
> (KV chỉ cho 1.000 ghi/ngày ≈ 330 câu). Phần dưới gồm hạ tầng (Bước 1–4) và
> nối web vào kho (Bước 5) — localStorage vẫn là bản chính khi offline.
>
> Gói Free D1: 5GB, 5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày, không tính phí egress.

## Thành phần đã thêm

| File                               | Vai trò                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `workers/schema.sql`             | Tạo bảng dùng chung cho `data-api` và `chat-proxy`       |
| `workers/data-api/worker.js`     | Worker API dữ liệu (kiểm vé Firebase + đọc/ghi D1)         |
| `workers/chat-proxy/worker.js`   | Sổ đếm chuyển sang D1, tự lùi về KV nếu chưa gắn D1    |
| `src/lib/cloud-sync.ts`          | Lõi đồng bộ localStorage ↔ D1 (LWW, gộp phiên tập trung) |
| `src/lib/use-cloud-sync.ts`      | Hook gắn đồng bộ vào phiên đăng nhập                    |
| `src/lib/local-data.ts`          | Xóa sạch dữ liệu trên máy khi đăng xuất / đổi tài khoản |

---

## Bước 1 — Tạo database D1

1. Cloudflare Dashboard → **Storage & Databases → D1 SQL Database** → **Create**.
2. Đặt tên: `zenspace` → Create.
3. Mở database → tab **Console** → dán toàn bộ `workers/schema.sql` → **Execute**.
4. Kiểm tra tab **Tables** thấy 7 bảng: `users`, `user_settings`, `focus_sessions`,
   `chat_usage`, `cf_usage`, `chat_sessions`, `chat_messages`.

---

## Bước 2 — Deploy Worker `data-api`

1. Dashboard → **Workers & Pages → Create → Worker** → đặt tên `data-api`.
2. **Edit code** → dán `workers/data-api/worker.js` → **Deploy**.
3. **Settings → Variables and Secrets**:| Tên                    | Loại | Giá trị                                        |
   | ----------------------- | ----- | ------------------------------------------------ |
   | `FIREBASE_PROJECT_ID` | Text  | `zenspace-d10m13y26`                           |
   | `ALLOWED_ORIGINS`     | Text  | `https://zenstudy.space,http://localhost:3001` |
4. **Settings → Bindings → Add → D1 database**:
   - Variable name: `DB`
   - Database: `zenspace`
5. Mở `https://data-api.<tài-khoản>.workers.dev/health` → phải thấy:
   ```json
   { "ok": true, "db": true, "schema": true, "pid": true, "origins": 2, "time": "..." }
   ```

   - `db: false` → chưa gắn binding `DB`.
   - `schema: false` → chưa chạy `workers/schema.sql` (hoặc gắn nhầm database).
   - `pid: false` → chưa đặt `FIREBASE_PROJECT_ID` (mọi request sẽ bị 401).
   - `origins: 0` → chưa đặt `ALLOWED_ORIGINS` (hiện cho phép mọi domain).

---

## Bước 3 — Gắn D1 cho `chat-proxy` (cứu quota)

1. Dashboard → Workers & Pages → `chat-proxy` → **Settings → Bindings → Add → D1 database**.
2. Variable name: `DB` → Database: `zenspace`.
3. **Không cần deploy lại code** nếu đã dán bản `worker.js` mới; nếu chưa, dán lại file này.
4. Mở `/health` → phải thấy `"db": true, "schema": true`.
5. Mở `/status?token=...` → `workersAI.requestsToday` / `neuronsToday` vẫn chạy,
   giờ đọc từ D1.

> **Tự lùi an toàn:** nếu gỡ binding `DB`, code tự quay về KV như cũ. Không cần sửa gì.

---

## Bước 4 — Kiểm tra nhanh

```powershell
# 1) data-api sống và có DB
curl.exe https://data-api.leutiendung-hht.workers.dev/health

# 2) chat-proxy thấy D1
curl.exe https://chat-proxy.leutiendung-hht.workers.dev/health

# 3) Gọi thử không có vé -> phải trả 401
curl.exe -i https://data-api.leutiendung-hht.workers.dev/settings
```

Kiểm tra dữ liệu thật bằng Console trình duyệt (sau khi đăng nhập web):

**Cách lấy `idToken` (để test tay):**

1. Mở `https://zenstudy.space`, đăng nhập Google.
2. F12 → **Application** (Chrome) hoặc **Storage** (Firefox) → **IndexedDB**
   → `firebaseLocalStorageDb` → `firebaseLocalStorage`.
3. Mở bản ghi có khóa bắt đầu `firebase:authUser:` → mở `value`
   → `stsTokenManager.accessToken` → copy chuỗi đó.

**Test bằng PowerShell** (tránh lỗi nháy kép của `curl.exe`):

```powershell
$t = Read-Host "Dán idToken"
$body = @{ settings = @{ thuNghiem = '{"ok":true}' } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Put -Uri "https://data-api.<tài-khoản>.workers.dev/settings" `
  -Headers @{ Authorization = "Bearer $t" } -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "https://data-api.<tài-khoản>.workers.dev/settings" `
  -Headers @{ Authorization = "Bearer $t" }
```

Lần gọi thứ 2 phải thấy `settings.thuNghiem -eq '{"ok":true}'` (worker lưu **chuỗi thô**,
client tự `JSON.stringify`) và `updated.thuNghiem` là mốc mili-giây.

> Chưa tiện lấy token thì bỏ qua — Bước 3 sẽ kiểm tra tự động khi web nối vào `data-api`.

---

## API hiện có

Mọi endpoint (trừ `/health`) cần header `Authorization: Bearer <Firebase idToken>`.

| Method | Đường      | Body / Query                               | Trả về                                                     |
| ------ | ------------- | ------------------------------------------ | ------------------------------------------------------------ |
| GET    | `/health`   | —                                         | `{ ok, db, schema, pid, origins, time }`                   |
| GET    | `/me`       | —                                         | `{ uid, settings, updated }`                               |
| GET    | `/settings` | —                                         | `{ uid, settings: { key: string }, updated: { key: ms } }` |
| PUT    | `/settings` | `{ settings: { key: string } }`          | `{ ok, saved, at }`                                        |
| DELETE | `/settings` | `{ keys: ["a"] }`                        | `{ ok, deleted }`                                          |
| GET    | `/focus`    | `?from=<ms>&to=<ms>`                     | `{ sessions: [...] }`                                      |
| POST   | `/focus`    | `{ session: {...} }` hoặc object phiên | `{ ok, id }`                                               |
| DELETE | `/focus`    | —                                         | `{ ok }`                                                   |

`user_settings` nhận **mọi dữ liệu JSON nhỏ** (scene, âm lượng, cài Pomodoro,
yêu thích, board kanban, ghi chú...), nên Bước 3 chỉ cần đẩy từng key
localStorage lên, không phải thêm bảng.

---

## Bước 5 — Nối web (đồng bộ hai chiều)

1. Thêm biến môi trường khi build web (`.env.local` và Vercel/Cloudflare Pages):
   ```
   NEXT_PUBLIC_DATA_API_URL=https://data-api.leutiendung-hht.workers.dev
   ```
2. Deploy lại web (biến `NEXT_PUBLIC_*` được nhúng lúc build, không đổi sau deploy).
3. Đăng nhập Google trên **cả laptop và điện thoại** bằng cùng một tài khoản.

Cách chạy (`src/lib/cloud-sync.ts`):

- 22 key localStorage được đẩy lên (cảnh, đồng hồ, Pomodoro, ghi chú, kanban, embed,
  yêu thích, tour, phiên tập trung...). Key gắn với máy (vị trí cửa sổ, âm lượng thiết bị,
  trạng thái đang chạy) **không** đồng bộ.
- Mỗi lần ghi localStorage: đánh dấu thời điểm rồi đẩy lên sau 2 giây (gộp nhiều lần ghi).
- Xung đột: **bản mới nhất thắng**. Nếu bản trên mạng mới hơn bản máy > 2 giây thì kéo về,
  ngược lại đẩy bản máy lên. Lần đầu kéo được dữ liệu mới, trang tự tải lại **một lần**.
- `focusSessions` được **gộp theo `id`** (giữ tối đa 2.000 phiên), không bên nào mất phiên.
- Xóa key trên máy (khi đã đăng nhập) sẽ xóa luôn trên mạng; máy mới chưa có key thì kéo về.
- Tab quay lại (nếu đã quá ~20 giây kể từ lần đồng bộ trước) hoặc có mạng lại: đồng bộ ngay.
  Đăng xuất: ngừng đồng bộ.
- Đăng nhập bằng **tài khoản khác** trên cùng máy: dữ liệu đồng bộ của tài khoản cũ
  được xóa trước khi kéo dữ liệu tài khoản mới (không lẫn dữ liệu hai người).
- **Đăng xuất = xóa sạch dữ liệu trên máy** (ghi chú, task, cài đặt, cache chat, ảnh chat).
  Nếu còn thay đổi chưa đẩy kịp lên mây, web hỏi lại trước khi xóa; chọn Hủy thì không mất gì.
  Đăng nhập lại cùng tài khoản sẽ tải dữ liệu từ D1 về.
- Dùng web **không cần đăng nhập** vẫn được: dữ liệu khách giữ trên máy và khi đăng nhập
  sẽ gộp theo "bản mới nhất thắng" (chỗ nào tài khoản đã có bản mới hơn thì lấy của tài khoản).

**Dùng nhiều máy:** sửa ở đâu thì máy kia thấy sau ~2 giây (hoặc khi mở lại tab).
Tránh sửa **cùng một mục** trên hai máy lúc đang offline — bản ghi sau sẽ thắng và bản kia mất.
Phiên tập trung thì an toàn: luôn được gộp.

---

## Giới hạn & lưu ý

- **1 ô tối đa 2MB** (giới hạn D1). Worker chặn ở 1,5MB và trả lỗi 413.
- Mỗi lượt đồng bộ chỉ tốn **1 request** (thêm 1 nữa nếu có dữ liệu cần đẩy lên);
  request chỉ để đọc thì **không ghi** gì vào D1. Xem thêm mục "Bước 5".
- **Sổ đếm mới bắt đầu từ 0** trong ngày gắn D1 (số cũ trong KV không chuyển sang).
- Mỗi câu chat tốn **3 dòng ghi** D1 (1 của người dùng + 1 lượt gọi + 1 neurons),
  nên 100.000 dòng/ngày ≈ **33.000 câu/ngày** — dư sức (trần thật là 10.000 neurons/ngày của Workers AI).
- Đọc `/focus` nên truyền `from`/`to` theo tuần/tháng để không kéo cả 2.000 phiên.
- **Chat vẫn ở Firestore** ở giai đoạn này (bảng `chat_sessions`/`chat_messages`
  đã dựng sẵn cho Bước 4).

## Gỡ / quay lui

| Muốn gỡ        | Làm gì                                             |
| ---------------- | ---------------------------------------------------- |
| Sổ đếm về KV | Xóa binding `DB` khỏi `chat-proxy`             |
| Toàn bộ kho    | Xóa Worker `data-api`, xóa database `zenspace` |

Dữ liệu localStorage trên máy người dùng không bị ảnh hưởng.
