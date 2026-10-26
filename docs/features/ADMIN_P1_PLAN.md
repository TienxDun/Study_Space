# P1 — Nhìn thấy hệ thống (kế hoạch triển khai)

Trạng thái: P1a đã deploy; P1b xong code + test (chờ deploy để xác minh); P1c xong code + test (chờ deploy để xác minh). Bản 5 — 2026-10-26.
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
    "r2": "10 GB",
    "r2Bytes": 10000000000
  }
}
```

- P1b thêm `errors`:

```json
"errors": {
  "ok": true,
  "items": [
    { "id": 1, "source": "chat-proxy", "code": "all_busy", "message": "…", "createdAt": 1761450000000 }
  ]
}
```

- P1c thêm `r2`:

```json
"r2": {
  "ok": true,
  "bytes": 487851634,
  "objects": 121,
  "partial": false
}
```

- Mỗi khối có `ok`; nguồn lỗi trả `{ "ok": false, "error": "ma_loi" }`, không trả stack trace, object key hay URL nội bộ.
- `degraded = true` nếu có khối `ok: false`. Endpoint vẫn trả **200** để trang tải được; chỉ Access sai mới trả 401. `r2.partial: true` vẫn là `ok: true`, không bật `degraded`.
- Dùng `Promise.allSettled`, timeout 10 giây cho mỗi lần gọi worker (khớp `PROBE_TIMEOUT_MS` và nhãn "tối đa 10 giây" trên UI). Không để một worker chết làm hỏng cả snapshot. Gọi R2 là binding, không có `AbortSignal`; trần 30 trang ở P1c là giới hạn thời gian.
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
- `limits`: lấy từ `/status` và `/usage`; chỉ để hằng số gói (2 MB snapshot = 2.000.000 byte theo data-api, 10 GB R2) trong Worker và gắn nhãn "tham chiếu".
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

## P1b — Lỗi & fallback (xong code 2026-10-26)

Mục tiêu: khi chat-proxy hết đường dự phòng, hoặc admin worker không đọc được D1, có một dòng log để mở trang là thấy thay vì đoán.

### B1. Bảng D1

Thêm vào `workers/schema.sql` **và** dán riêng block này vào D1 `zenspace` → Console:

```sql
CREATE TABLE IF NOT EXISTS admin_error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,
  code       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_error_log_created ON admin_error_log (created_at);

-- Nợ của A1, chưa nằm trong schema.sql:
CREATE INDEX IF NOT EXISTS idx_chat_usage_day_count ON chat_usage (day, count DESC);
```

Không dán cả `workers/schema.sql` vào DB đang chạy: file đó là script cài mới, đầu file có `DROP TABLE`.

`created_at` là mili giây (`Date.now()`), giống `admin_audit`. Không có cột `severity`: mọi dòng đều là lỗi; thêm khi có mức cảnh báo thật.

### B2. Ghi log

**chat-proxy** (`workers/chat-proxy/worker.js`):

- Ba nhánh cuối thêm field `code`, giữ nguyên text trả người dùng: `worker.js:977` → `provider_bad_key`, `:983` → `all_busy`, `:989` → `fallback_failed`.
- Ghi log khi vào đúng ba nhánh đó. `message` lấy từ bảng tĩnh theo `code`; **không** dùng `r.error` hay `mem.lastError` (hai chỗ đó chứa body provider).
- Không ghi 401 ở `/chat` (bot spam).
- Ghi bằng `ctx.waitUntil` để không chặn câu trả lời, nên phải thêm `ctx` vào chữ ký `fetch(req, env, ctx)`. Chưa gắn `DB` hoặc insert lỗi: bỏ qua.

**Admin worker** (`admin-worker/_worker.ts`):

- Ghi khi `chat`, `sync` hoặc `errors` có `ok: false`; **không** ghi `health` (trang tự refresh 30 giây).
- Giới hạn: Map trong isolate theo khóa `<source>:<code>`, cùng khóa chỉ ghi tối đa 1 dòng/giờ.
- Bỏ `logAudit` (`_worker.ts:233`) cùng file test `src/__tests__/unit/admin/audit.test.ts` — không chỗ nào gọi helper này; giữ bảng `admin_audit` cho sau này.

### B3. Đọc và dọn

- `GET /api/admin/overview` thêm khối `errors` theo hình dạng ở phần Hợp đồng API.
- 20 dòng mới nhất, `ORDER BY created_at DESC`. Bảng rỗng: `ok: true, items: []`.
- Bảng chưa tạo hoặc D1 lỗi: `{ "ok": false, "error": "d1_error" }`, trang vẫn 200.
- `errors.ok: false` cũng bật `degraded = true` (trong `buildOverview`).
- Dọn bản ghi quá 14 ngày **chỉ khi ghi log mới**, tối đa 1 lần/giờ; không dọn trong đường đọc (trang tự refresh 30 giây).

### B4. UI

- Thêm khối Lỗi & fallback vào `admin-host/index.html`, hàm `renderErrors` trong `admin-host/admin.js` theo pattern `renderRows`: thời gian, nguồn, mã lỗi.
- Bảng gọn; `message` cắt 200 ký tự.

### B5. Deploy và kiểm tra

- Dán lại `chat-proxy` trên dashboard (đã có binding `DB`); `npm run build:admin`; `npx wrangler deploy --config wrangler.admin.jsonc`.
- Gây một lỗi fallback → có dòng log sau reload và sau một lần deploy.
- Chỉ còn 20 dòng gần nhất; dòng quá 14 ngày bị xóa ở lần ghi kế tiếp.
- Xóa bảng hoặc tắt D1 → khối lỗi đỏ (`errors.ok: false`), trang vẫn 200.
- Kiểm tra DB: `message` không chứa câu hỏi, uid, email, key hay body provider.

Trạng thái 2026-10-26: code, unit test, `tsc`, `lint`, `npm test` sạch. Các bước deploy và kiểm tra ở trên chưa chạy trên bản thật.

## P1c — Nội dung (xong code 2026-10-26)

### C1. R2 binding

Thêm vào `wrangler.admin.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "R2", "bucket_name": "study-space" }
]
```

Binding phải nằm trong config; `keep_vars` không giữ binding, thêm tay trên dashboard sẽ bị xóa ở lần deploy sau. Bucket `study-space` đã tồn tại trong tài khoản (kiểm tra bằng `wrangler r2 bucket list` ngày 2026-10-26), nên deploy sẽ không vướng lỗi bucket không tồn tại.

Local: `wrangler dev` tự tạo bucket rỗng trong `.wrangler/state`, thấy 0 object là đúng, không phải lỗi.

### C2. Đọc dung lượng và số object

- Repo không có `@cloudflare/workers-types`, nên khai type tối giản `R2BucketLike` (giống `D1DatabaseLike`) và thêm `R2?: R2BucketLike` vào `AdminEnv`.
- `list({ limit: 1000, cursor })`, lặp đến `truncated === false`. Dừng cứng ở **30 trang** (≈30.000 object) và trả `partial: true` nếu chạm trần, tránh treo request. `truncated: true` mà không có `cursor` cũng dừng, không lặp vô hạn.
- Cộng `size`, đếm object; trả `{ ok: true, bytes, objects, partial }`. Không trả key hay cursor xuống client.
- Thiếu binding → `{ ok: false, error: "missing_binding" }`; list lỗi → `{ ok: false, error: "r2_error" }` (khớp bộ mã sẵn có).
- Cache **cả thành công lẫn lỗi** 60 giây trong RAM isolate (trang tự refresh 30 giây); thêm `__resetR2Cache()` cho test và gọi nó trong `beforeEach` của `admin-worker.test.ts`.
- `r2.ok: false` bật `degraded` (giống P1b) và ghi `logAdminError(env, "r2", code)`; thêm nhãn `r2: "Kho tệp"` vào `ERROR_SOURCE_LABELS` để dùng lại throttle 1 giờ. `partial: true` không bật `degraded`.
- Chưa so manifest, chưa báo mồ côi/thiếu.
- Dung lượng chuẩn: hạn mức miễn phí của Cloudflare và `docs/guides/SYSTEM_LIMITS.md` ghi **10 GB** (thập phân), nên dùng `R2_LIMIT_BYTES = 10 * 1000 ** 3` và suy ra nhãn `"10 GB"`, thay cho `"10 GiB"` đang có ở P1a. Cập nhật test `limits` hiện tại theo giá trị mới.
- Baseline đo ngày 2026-10-26 bằng S3 `ListObjectsV2`: **121 object, 487.851.634 byte** (một trang list). Trần 30 trang rất xa thực tế; với cache 60 giây, mở trang 8 tiếng ≈ 480 thao tác Class A/ngày, không đáng kể so với 1 triệu/tháng.

### C3. UI

- Thêm card thứ 4 vào `usage-grid`, tên **"Kho tệp"** (thống nhất với nhãn trong `limits-strip`): dung lượng đã dùng / 10 GB lấy từ `limits.r2`, meter, số object, ghi chú "Tính cả tệp cảnh và âm thanh trên R2."
- `usage-grid` dùng `auto-fit`, không phải sửa CSS.
- Thêm `R2_LIMIT_BYTES = 10 * 1000 ** 3` trong worker; `R2_LIMIT_LABEL` suy ra từ đó và trả thêm `limits.r2Bytes` để JS tính phần trăm, không hardcode hạn mức ở client.
- `formatBytes` hiện chỉ lên tới MB; thêm nhánh GB/TB để số dùng lớn hơn 1 GB không hiện "1024.00 MB".
- Thêm `missing_binding` và `r2_error` vào `ERROR_LABELS`, thêm `r2: "Kho tệp"` vào `SOURCE_LABELS` (bảng lỗi); thiếu hai chỗ này UI sẽ hiện mã thô.
- Nhãn "Kho tệp" trong `limits-strip` vẫn là hạn mức gói; số dùng thật chỉ nằm trong card mới.
- Lỗi → card đỏ, ghi chú "Không đọc được kho tệp: …"; chạm trần 30 trang → card vẫn xanh nhưng ghi chú "Số liệu có thể chưa đủ".
- R2 cache 60 giây trong khi trang refresh 30 giây: đổi `usage-desc` thành "Các số dưới đây tự động cập nhật." và thêm vào ghi chú card "Cập nhật tối đa mỗi 60 giây."

### C4. Test và kiểm tra

- Unit: R2 giả 2 trang (1.500 object) → đúng tổng bytes và số object; thiếu binding → `missing_binding`; list ném lỗi → `r2_error` + `degraded`; gọi overview 2 lần → `list` chỉ chạy 1 lần (cache 60 giây).
- Test cũ phải sửa theo: thêm R2 giả vào env của các ca đang kỳ vọng `degraded: false`, thêm `r2Bytes` vào kỳ vọng `limits`, gọi `__resetR2Cache()` trong `beforeEach`.
- Local: `npm run build:admin` → `wrangler dev` → card hiện 0 B / 0 object.
- `npx wrangler deploy --dry-run --config wrangler.admin.jsonc` phải thấy `env.R2 (study-space)`.
- Deploy xong: so số object và dung lượng với dashboard R2. Baseline 2026-10-26 là **121 object / 487.851.634 byte**. Dashboard hiển thị GB thập phân, Worker trả byte; lệch đơn vị nhỏ là bình thường, lệch số object hoặc lệch byte quá vài % mới là lỗi (metadata có thể tính khác).

Trạng thái 2026-10-26: code, 5 unit test mới, `tsc`, `lint`, `npm test` (393 test) và `build:admin` sạch; `wrangler deploy --dry-run` thấy `env.R2 (study-space)`; local `wrangler dev` hiện card 0 B / 0 tệp, không lỗi console. Các bước deploy và đối chiếu R2 thật chưa chạy.

## Chạy local

- `npm run build:admin` rồi `npx wrangler dev --config wrangler.admin.jsonc --port 8787`.
- `.dev.vars` (gitignored) đặt `ENVIRONMENT=development` để bỏ qua Access **chỉ khi** host là localhost; không đặt biến này ở Production.
- D1 local mặc định rỗng; muốn xem dữ liệu thật thì kiểm tra trên bản deploy, không dựa vào local.
- Không chạy `npm run dev` của Next cho UI mới; UI mới là file tĩnh trong `admin-host/`.

## Definition of Done

- [x] P1a: `/api/admin/overview` trả đúng `health`, `chat`, `sync`, `livekit`, `limits`; số chat khớp D1.
- [ ] P1a: ngắt một worker → khối tương ứng đỏ, trang vẫn 200.
- [x] P1a: `docs/guides/SYSTEM_LIMITS.md` sinh từ `hit-limits.ts`.
- [x] P1b: log lỗi sống qua reload và một lần deploy; UI hiện 20 lỗi gần nhất; dọn sau 14 ngày. (code + unit test; xác minh bản deploy theo B5)
- [x] P1b: xóa bảng `admin_error_log` hoặc tắt D1 → khối lỗi đỏ, trang vẫn 200; `message` trong DB không có PII. (code + unit test)
- [ ] P1c: tổng dung lượng và số object khớp R2; R2 lỗi không làm hỏng trang. (code + unit test; xác minh bản deploy theo C4)
- [ ] Không có `ADMIN_TOKEN`, `?token=`, `chat-admin-token` trong Response, Network hay localStorage.
- [ ] `zenstudy.space/admin/` và `/dev/studio/` vẫn 404.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch.
- [x] `npm run build:admin` và `npx wrangler deploy --dry-run --config wrangler.admin.jsonc` thấy đúng binding.

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
- **Bản 2** (2026-10-26): đánh dấu P1a xong; viết lại P1b sau duyệt — thêm `code` cho 3 nhánh cuối chat-proxy (mã cũ chưa tồn tại), ghi bằng `ctx.waitUntil`, admin worker chỉ log `chat`/`sync`/`errors` với throttle 1 dòng/giờ, dọn log chỉ khi ghi, bỏ cột `severity` và helper `logAudit` chết, `errors.ok: false` bật `degraded`, block SQL rời thay vì dán cả `schema.sql`.
- **Bản 3** (2026-10-26): đóng P1b (code + test, chờ xác minh deploy); duyệt lại P1c — thêm type tối giản vì repo không có `workers-types`, trần 30 trang + `partial`, cache cả lỗi, mã `missing_binding`/`r2_error`, `r2.ok: false` bật `degraded` và ghi vào `admin_error_log`, `R2_LIMIT_BYTES` thay vì hardcode nhãn, card thứ 4 dùng `auto-fit` không sửa CSS.
- **Bản 4** (2026-10-26): duyệt P1c để thực thi — đo baseline R2 121 object / 487.851.634 byte và xác nhận bucket tồn tại; đổi hạn mức sang 10 GB thập phân cho khớp Cloudflare/`SYSTEM_LIMITS.md`; bổ sung UI còn thiếu (nhãn lỗi, nhãn nguồn, `formatBytes` GB/TB, ghi chú cache 60 giây); ghi rõ cập nhật test cũ + `beforeEach`; đồng bộ timeout 10 giây và bỏ tham chiếu dòng code đã trôi.
- **Bản 5** (2026-10-26): P1c xong code + test — binding `R2`, khối `r2` có cache 60 giây, card "Kho tệp"; dry-run thấy `env.R2`, local hiện 0 B / 0 tệp; chờ deploy đối chiếu R2 thật.
