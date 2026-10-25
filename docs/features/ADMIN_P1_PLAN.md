# P1 — Nhìn thấy hệ thống (kế hoạch triển khai)

Trạng thái: kế hoạch, chưa triển khai. Bản 1 — 2026-10-26.
Thuộc P1 của `docs/features/ADMIN_CONSOLE_PLAN.md`. P0 đã đóng, runbook ở `docs/archive/ADMIN_P0_PLAN.md`.

Mục tiêu: mở `admin.zenstudy.space/admin/` là thấy hệ thống khỏe hay ốm, đang dùng bao nhiêu, có lỗi gì, kho nội dung ra sao. Mọi số lấy từ worker, không chép tay vào UI; trình duyệt không giữ token.

## Đã chốt

1. **UI làm mới hoàn toàn, bằng shell tĩnh.** Viết mới HTML/CSS/JS trong `admin-host/`; không dùng Next/React, không dùng lại `AdminHeader`, `AdminThemeContext`, trang `/admin` cũ hay CSS cũ. "Mới" là so với admin Next; ngôn ngữ thị giác kế thừa shell P0 đang chạy (nền tối, emerald, Plus Jakarta Sans + JetBrains Mono) để trang không đổi gu giữa các bước.
2. **Chưa có người dùng thật.** Dữ liệu chat hiện chỉ là dữ liệu test của admin. Bật D1 cho chat-proxy không cần backfill, không cần chờ thời điểm, không sợ mất lượt.
3. **P1a bỏ top uid và người ≥ 80%.** Chỉ hiển thị tổng câu, số uid và hạn mức; hai số kia thêm khi có người dùng thật.
4. **P1b dùng D1, dọn khi đọc.** Bảng `admin_error_log`, giữ 14 ngày, xóa bản ghi cũ mỗi lần ghi/đọc; không thêm cron.
5. **P1c chỉ đọc dung lượng và số object R2.** Manifest và kiểm tra file mồ côi/thiếu để P2.
6. **Cả chat-proxy và admin worker ghi log lỗi.** chat-proxy ghi lỗi fallback cuối; admin worker ghi lỗi cấu hình/binding khi overview không dựng được.
7. **Chat admin không nằm trong P1.** Trang chat cũ tiếp tục local; không đưa vào UI mới và không publish.
8. **Deploy từng bước.** P1a → P1b → P1c; mỗi bước build, deploy và kiểm tra trước khi sang bước sau.

## Hiện trạng

- Shell P0 đang chạy tại `admin.zenstudy.space/admin/`, gọi `/api/admin/ping`, chỉ có sức khỏe và độ trễ 3 worker.
- Các trang admin Next (`/admin`, `/admin/chat`, `/dev/studio`) chỉ tồn tại trên máy local; source bị gitignore và bản web đã strip.
- `chat-proxy` có `AI` + `CHAT_QUOTA` (KV); code đã có nhánh D1 cho `chat_usage` và tự lùi về KV khi chưa gắn `DB`. Bản deploy vẫn cần gắn binding D1 rồi deploy lại thì `chat_usage` mới có dữ liệu. Lượt gọi/neurons Workers AI không đếm trong hệ thống, xem trên Cloudflare Dashboard.
- LiveKit `/usage` cần `ADMIN_TOKEN`; admin worker đã có token này.
- `wrangler.admin.jsonc` đã có binding `DB` → D1 `zenspace`, chưa có R2.
- R2 bucket `study-space` chưa có binding trong admin worker; chưa có manifest.

## Kiến trúc

```
Trình duyệt (đã đăng nhập Access)
  └─ admin.zenstudy.space/admin/        ← shell tĩnh trong dist-admin
       └─ GET /api/admin/overview        ← Worker zenstudy-admin, verify Access JWT
            ├─ chat-proxy  /health, /status   (Bearer ADMIN_TOKEN)
            ├─ data-api    /health
            ├─ livekit     /usage             (Bearer ADMIN_TOKEN)
            ├─ D1 zenspace: chat_usage, user_data, admin_error_log
            └─ R2 study-space: list()          (P1c)
```

Trình duyệt chỉ gọi đường dẫn tương đối `/api/admin/overview`; token nằm ở env của Worker admin, không xuống client.

## Hợp đồng API

`GET /api/admin/overview`, xác thực Access JWT như `/api/admin/ping`.

```json
{
  "generatedAt": "2026-10-26T10:00:00.000Z",
  "email": "admin@example.com",
  "degraded": false,
  "health": {
    "ok": true,
    "checks": [
      { "name": "chat-proxy", "ok": true, "ms": 120 },
      { "name": "data-api", "ok": true, "ms": 90 },
      { "name": "livekit", "ok": true, "ms": 150 }
    ]
  },
  "chat": {
    "ok": true,
    "day": "2026-10-26",
    "total": 0,
    "users": 0,
    "dailyLimit": 30
  },
  "sync": { "ok": true, "users": 0, "lastAt": null, "maxBytes": 0 },
  "livekit": {
    "ok": true,
    "month": "2026-10",
    "usedMinutes": 0,
    "limitMinutes": 0,
    "roomsOpen": 0,
    "participants": 0
  },
  "limits": {
    "chatDaily": 30,
    "snapshotMaxBytes": 2000000,
    "r2": "10 GiB"
  }
}
```

- P1b thêm `errors`; P1c thêm `r2`.
- Mỗi khối có `ok`; nguồn lỗi trả `{ "ok": false, "error": "ma_loi" }`, không trả stack trace hay URL nội bộ.
- `degraded = true` nếu có khối `ok: false`. Endpoint vẫn trả **200** để trang tải được; chỉ Access sai mới trả 401.
- Dùng `Promise.allSettled`, timeout 3 giây cho mỗi lần gọi worker. Không để một worker chết làm hỏng cả snapshot.
- `Cache-Control: no-store`.

## P1a — Sức khỏe + Sử dụng & hạn mức

### A1. Gắn D1 cho chat-proxy (dashboard)

1. Cloudflare Dashboard → Workers & Pages → `chat-proxy` → Settings → Bindings → Add → D1 database: biến `DB`, database `zenspace`.
2. D1 `zenspace` → Console, chạy:

```sql
CREATE INDEX IF NOT EXISTS idx_chat_usage_day_count
  ON chat_usage (day, count DESC);
```

3. Không backfill. Kiểm tra `/health` trả `db: true`, `schema: true`.
4. Sửa `/status` trong `workers/chat-proxy/worker.js`:
   - Nhận `Authorization: Bearer <ADMIN_TOKEN>` (giữ query token cho local).
   - Nếu `ADMIN_TOKEN` chưa đặt: trả 401/503, **không fail open**.

### A2. Thêm `/api/admin/overview` vào Worker admin

File: `admin-worker/_worker.ts`.

- Mở rộng type D1 để dùng `first()` và `all()`.
- Thêm route `GET /api/admin/overview` sau bước verify Access JWT.
- Dùng lại `pingProbes`/`probeCheck` cho `health`.
- Chat:
  - Gọi `chat-proxy /status` bằng Bearer để lấy `dayPacific` và `auth.userDailyLimit` (hạn mức câu chat). Không đọc neurons vì worker không đếm.
  - Truy vấn D1:

```sql
SELECT COALESCE(SUM(count), 0) AS total, COUNT(*) AS users
FROM chat_usage WHERE day = ?;
```

- Sync:

```sql
SELECT COUNT(*) AS users, MAX(updated_at) AS lastAt, MAX(LENGTH(data_json)) AS maxBytes
FROM user_data;
```

- LiveKit: gọi `/usage` bằng Bearer, lấy `month`, `usedMinutes`, `limitMinutes`, `roomsOpen`, `participants`.
- `limits`: lấy từ `/status` và `/usage`; chỉ để hằng số gói (2 MB snapshot = 2.000.000 byte theo data-api, 10 GiB R2) trong Worker và gắn nhãn "tham chiếu".
- Ngày chat dùng `America/Los_Angeles` giống `pacificDay()`; tháng LiveKit là UTC (`monthKeyUtc()`). UI phải ghi rõ nhãn.

### A3. Shell mới

File mới trong `admin-host/`, ví dụ:

```
admin-host/
  index.html
  admin.css
  admin.js
```

- Không dùng `localStorage` cho token, không gửi `?token=`.
- Fetch `/api/admin/overview` cùng origin; tự refresh 30 giây; có nút kiểm tra ngay.
- Khối Sức khỏe: 3 worker, độ trễ, trạng thái, lần kiểm gần nhất.
- Khối Sử dụng & hạn mức: câu chat hôm nay, số uid, hạn mức ngày, sync, LiveKit. Neurons xem trên Cloudflare Dashboard.
- Giao diện mới hoàn toàn; không copy CSS/component của admin cũ.
- Kế thừa token màu/typography của shell P0 (`admin-host/index.html`): nền `#090a0f`, emerald `#10b981`, Plus Jakarta Sans cho chữ, JetBrains Mono cho số. Tách CSS/JS ra `admin.css`/`admin.js` khi thêm khối mới; không nhân bản biến.
- Sửa `scripts/prepare-admin-bundle.mjs` để copy **toàn bộ** `admin-host/` vào `dist-admin/admin/`, không chỉ `index.html`.

### A4. Sinh docs hạn mức

- Thêm `docs/guides/SYSTEM_LIMITS.md` và `scripts/gen-limits-docs.mjs`.
- Nguồn duy nhất: `src/data/admin/hit-limits.ts`.
- Script dùng `typescript.transpileModule` để đọc file TS, không thêm dependency; render Markdown từ `SYSTEM_HIT_LIMITS`.
- Chạy script khi sửa hạn mức; docs lệch là lỗi quy trình.

### A5. Deploy và kiểm tra

1. Deploy `chat-proxy` (dashboard, dán code + binding D1).
2. `npm run build:admin`.
3. `npx wrangler deploy --config wrangler.admin.jsonc`.
4. Mở `https://admin.zenstudy.space/admin/`, kiểm tra 2 khối.
5. Ngắt một worker (hoặc xóa một URL env) → khối tương ứng đỏ, trang vẫn 200.
6. DevTools → Network: không có `ADMIN_TOKEN`, không có `?token=`.

## P1b — Lỗi & fallback

### B1. Bảng D1

Thêm vào `workers/schema.sql` và chạy trong D1 `zenspace`:

```sql
CREATE TABLE IF NOT EXISTS admin_error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  severity TEXT NOT NULL,
  code TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_error_log_created
  ON admin_error_log (created_at);
```

### B2. Ghi log

- chat-proxy: ghi khi fallback thất bại, chỉ các mã cuối (`provider_bad_key`, `all_busy`, `fallback_failed`). Không ghi `chat_auth` (bot spam).
- admin worker: ghi lỗi cấu hình/binding/D1 khi overview không dựng được. Không ghi lặp lại lỗi health mỗi 30 giây.
- `message` cắt tối đa 200 ký tự; không chứa câu hỏi, uid, email, key hay body thô từ provider.
- Nếu bảng chưa có hoặc D1 lỗi: bỏ qua, không làm hỏng request chính.

### B3. Đọc và dọn

- `GET /api/admin/overview` thêm `errors`: 20 bản ghi gần nhất, sắp theo `created_at DESC`.
- Mỗi lần ghi/đọc: `DELETE FROM admin_error_log WHERE created_at < ?` với mốc 14 ngày.
- UI thêm khối Lỗi & fallback; bảng gọn, có thời gian, nguồn, mã lỗi.

### B4. Deploy và kiểm tra

- Gây một lỗi fallback → log xuất hiện sau reload và sau một lần deploy.
- Chỉ còn 20 dòng gần nhất; bản ghi quá 14 ngày bị xóa.
- Tắt D1 hoặc xóa bảng → khối lỗi báo không khả dụng, trang vẫn 200.

## P1c — Nội dung

### C1. R2 binding

Thêm vào `wrangler.admin.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "R2", "bucket_name": "study-space" }
]
```

Binding phải nằm trong config; thêm tay trên dashboard sẽ bị xóa ở lần deploy sau.

### C2. Đọc dung lượng và số object

- Thêm type R2 vào `AdminEnv`.
- `env.R2.list({ limit: 1000, cursor })`, lặp đến khi `truncated === false`.
- Cộng `size` của từng object; đếm số object.
- Cache kết quả 60 giây trong RAM isolate để tránh list lại mỗi 30 giây.
- Lỗi R2 → `r2.ok = false`, trang vẫn 200.
- Chưa so manifest, chưa báo mồ côi/thiếu.

### C3. UI và kiểm tra

- Thêm khối Nội dung: tổng dung lượng, số object, trạng thái R2.
- So số object/dung lượng với dashboard R2.
- `npx wrangler deploy --dry-run --config wrangler.admin.jsonc` phải thấy `env.R2 (study-space)`.

## Chạy local

- `npm run build:admin` rồi `npx wrangler dev --config wrangler.admin.jsonc --port 8787`.
- `.dev.vars` (gitignored) đặt `ENVIRONMENT=development` để bỏ qua Access **chỉ khi** host là localhost; không đặt biến này ở Production.
- D1 local mặc định rỗng; muốn xem dữ liệu thật thì kiểm tra trên bản deploy, không dựa vào local.
- Không chạy `npm run dev` của Next cho UI mới; UI mới là file tĩnh trong `admin-host/`.

## Definition of Done

- [ ] P1a: `/api/admin/overview` trả đúng `health`, `chat`, `sync`, `livekit`, `limits`; số chat khớp D1.
- [ ] P1a: ngắt một worker → khối tương ứng đỏ, trang vẫn 200.
- [ ] P1a: `docs/guides/SYSTEM_LIMITS.md` sinh từ `hit-limits.ts`.
- [ ] P1b: log lỗi sống qua reload và một lần deploy; UI hiện 20 lỗi gần nhất; dọn sau 14 ngày.
- [ ] P1c: tổng dung lượng và số object khớp R2; R2 lỗi không làm hỏng trang.
- [ ] Không có `ADMIN_TOKEN`, `?token=`, `chat-admin-token` trong Response, Network hay localStorage.
- [ ] `zenstudy.space/admin/` và `/dev/studio/` vẫn 404.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch.
- [ ] `npm run build:admin` và `npx wrangler deploy --dry-run --config wrangler.admin.jsonc` thấy đúng binding.

## Rollback

- P1a: deploy lại bản admin worker + shell P0; gỡ binding D1 của chat-proxy nếu muốn quay về KV (dữ liệu test, không cần giữ).
- P1b: deploy lại code cũ; bảng `admin_error_log` để lại, không ảnh hưởng.
- P1c: bỏ `r2_buckets` khỏi config rồi deploy lại; không thay đổi dữ liệu R2.
- Không đổi Access, token hay DNS trong P1.

## Rủi ro

- **Binding bị xóa khi deploy**: `keep_vars` không giữ binding; D1/R2 phải khai trong `wrangler.admin.jsonc`.
- **Token trong URL**: chỉ dùng Bearer server-side; không đưa token xuống browser.
- **D1 local rỗng**: đừng kết luận số liệu sai từ môi trường local.
- **R2 list tốn thời gian**: phân trang, cache 60 giây; không list mỗi lần refresh.
- **Log lỗi spam/PII**: chỉ lỗi cuối, cắt ngắn, không ghi nội dung người dùng.
- **Múi giờ**: chat theo Thái Bình Dương, LiveKit theo UTC; UI phải ghi nhãn.
- **Access lockout**: một email admin; bật 2FA và lưu mã khôi phục trước khi đổi policy.
- **Không có cảnh báo tự động**: dashboard chỉ hiển thị khi mở; chưa có thông báo khi worker chết.

## Không làm ở P1

- Top uid, người ≥ 80%, lịch sử từng người.
- Manifest R2, file mồ côi/thiếu, xóa file.
- Đưa trang chat admin lên host.
- Sửa cấu hình, chain, provider, prompt.
- Cờ hệ thống, banner, phản hồi người dùng.
- Quota cấp tài khoản Cloudflare (không có API đọc nếu không thêm token tài khoản).

## Lịch sử bản

- **Bản 1** (2026-10-26): tách P1 khỏi plan tổng; chốt shell tĩnh, P1a/P1b/P1c, D1 chat-proxy không backfill, log lỗi D1 dọn khi đọc, R2 chỉ dung lượng/số object.
