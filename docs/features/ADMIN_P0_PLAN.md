# P0 — Nền an toàn (kế hoạch triển khai sơ bộ)

Trạng thái: sơ bộ, chưa làm. Thuộc P0 của `docs/features/ADMIN_CONSOLE_PLAN.md`. Ngày 2026-10-25.

Mục tiêu của P0 không phải làm dashboard đẹp, mà là: **admin không còn public, chỉ người có quyền vào được, trình duyệt không thấy token, và có sẵn nền audit trước khi mở quyền ghi.**

## Definition of Done

- [x] `https://zenstudy.space/admin/` trả 404 (kiểm tra 2026-10-25).
- [ ] `https://tienxdun.github.io/Study_Space/admin/` trả 404 (đã kiểm tra 2026-10-25); xác nhận GitHub Pages đã tắt để không có bản cũ xuất hiện lại.
- [x] `https://admin.zenstudy.space` bị Cloudflare Access chặn; chỉ đúng email admin vào được (OTP, đã đăng nhập thử 2026-10-25).
- [x] Preview URL bị tắt: preview builds off, route `workers.dev` disabled (trả 404).
- [ ] Trang admin gọi `/api/admin/ping`; DevTools không thấy `ADMIN_TOKEN`, không có `?token=`, không có `chat-admin-token`.
- [ ] Local `npm run dev` vẫn dùng được `/admin`, `/admin/chat`, `/dev/studio`.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch.
- [ ] Bảng `admin_audit` + helper ghi audit sẵn sàng trước hành động ghi đầu tiên.

## Đã chốt (2026-10-25)

1. **Access**: đúng **1 email admin**. Không ghi email vào repo; cấu hình trực tiếp trong policy Access. Đăng nhập bằng One-time PIN, session 24h.
2. **Phạm vi P0**: chỉ shell + ping. Không publish chat/scenes; hai trang này ở lại local tới P2.
3. **URL**: `https://admin.zenstudy.space/admin/`; `/` redirect 302 về `/admin/`.
4. **Audit**: D1 `zenspace`, bảng `admin_audit`.

Vì chỉ có 1 email: bật 2FA cho tài khoản Cloudflare và lưu mã khôi phục **trước** khi bật Access. Nếu lockout, sửa policy trên dashboard là đường thoát; local admin vẫn dùng được.

## Các bước

### B1 — Xác nhận không còn bản admin công khai (0.25 giờ)

- Đã kiểm tra ngày 2026-10-25: `https://tienxdun.github.io/Study_Space/admin/` và `https://zenstudy.space/admin/` đều trả **404**.
- Vẫn vào GitHub repo → Settings → Pages để chắc chắn Pages đã tắt/không còn deployment cũ. Xóa workflow không tự xóa deployment đã đăng.
- Mục tiêu của B2 là **giữ 404 này** sau các lần deploy sau, vì admin pages vẫn nằm trong static export nếu không xóa `out/admin`.

### B2 — Tách build web / admin (0.5 ngày)

File mới:
- `admin-host/index.html`: shell tĩnh (tiếng Việt, dark/emerald), không token, gọi `/api/admin/ping` và tự báo khi API chưa có.
- `scripts/strip-admin-export.mjs`: xóa `out/admin`, `out/api`, `out/dev` sau build web; idempotent, log rõ đã xóa gì.
- `scripts/prepare-admin-bundle.mjs`: dựng `dist-admin/` (shell + `_redirects` + `_headers`).
- `package.json`: thêm `build:web` và `build:admin`.
- `.gitignore`: thêm `dist-admin/`.
- `wrangler.admin.jsonc`: Worker `zenstudy-admin`, assets `./dist-admin`, 404 cho path lạ.

Lưu ý: `src/app/admin` và `src/app/api` đang bị gitignore nên Cloudflare không thấy; đó là lý do export trên Cloudflare không vướng route handler động. Ở máy local, hai thư mục này làm `next build` với `output: export` báo lỗi — chỉ kiểm tra export bằng checkout sạch (hoặc tạm ẩn hai thư mục), đừng deploy từ máy local.

Cấu hình Cloudflare:

| Phần | Build command | Output | Ghi chú |
|---|---|---|---|
| web (`zenstudy.space`, Pages) | `npm run build:web` | `out` | Project hiện có, env như cũ |
| admin (`zenstudy-admin`, Worker) | `npm run build:admin` | `dist-admin` | Deploy `npx wrangler deploy --config wrangler.admin.jsonc` |

Nội dung `dist-admin/` ở P0:

```
dist-admin/
  admin/index.html      # shell + gọi /api/admin/ping
  _redirects            # /  /admin/  302
  _headers              # X-Robots-Tag: noindex
```

Kiểm tra: `npm run build:admin` sinh `dist-admin/admin/index.html`; export web kiểm bằng checkout sạch (đã chạy 2026-10-25: build qua, script xóa đúng `out/admin`, `out/api`, `out/dev`, giữ `out/dev-preview`). P0 **không publish** `/admin/chat`, `/admin/scenes`, `/admin/toasts`.

### B3 — Worker admin + Cloudflare Access (0.5 ngày, chủ yếu dashboard)

**Điều kiện:** B2 đã commit + push lên `main` (Cloudflare build từ Git, không thấy file chưa commit).

1. **Sửa project web hiện có** (`zenstudy.space`): Settings → Builds & deployments → Build command `npm run build:web`, Output `out`. Không đổi biến môi trường.
2. **Tạo Worker từ Git**: Workers & Pages → Create → Import a repository → chọn repo → branch `main`. Điền đúng form:
   - Project name: `zenstudy-admin` (trùng `name` trong `wrangler.admin.jsonc`).
   - Build command: `npm run build:admin`.
   - Deploy command: `npx wrangler deploy --config wrangler.admin.jsonc`.
   - Preview command: để mặc định, nhưng **tắt Enable Preview builds**.
   - Protect with Cloudflare Access: **để OFF** ở bước này (policy làm thủ công ngay sau để đúng 1 email).
   - Path: `/`.
   - API token: Create new token.
   - Kết quả lần deploy đầu: Worker tĩnh phục vụ `dist-admin/`; chưa có API.
3. **Custom domain**: Worker `zenstudy-admin` → Settings → Domains & Routes → Add → Custom domain → `admin.zenstudy.space`. Zone đã ở Cloudflare nên DNS + TLS tự tạo.
4. **Cloudflare Access** (đã làm 2026-10-25): **một** application self-hosted cho `admin.zenstudy.space`, include toàn bộ path; policy `Allow` khi `Emails` = đúng email admin (1 người), không thêm `Bypass`. One-time PIN bật ở Zero Trust → Integrations → Identity providers; session 24 giờ.
   - Không tạo application thứ hai cho `workers.dev`: route đó đã **tắt hẳn** (trả 404), nên không còn đường vòng.
   - Bật 2FA + lưu recovery code cho tài khoản Cloudflare.
5. **Preview**: đã tắt ở bước 2; vào Settings → Builds & deployments kiểm lại là không còn preview build.
6. **Env Production** (Worker → Settings → Variables and Secrets; **chỉ Production**, không đặt ở Preview):
   - `ACCESS_TEAM_DOMAIN` (Text) — `https://<team>.cloudflareaccess.com` lấy ở Zero Trust → Settings.
   - `ACCESS_AUD` (Text) — Application Audience Tag trong trang tổng quan của application.
   - `ADMIN_TOKEN` (**Secret**) — phải **trùng** `ADMIN_TOKEN` của worker `livekit` (vì B4 gọi `/usage?token=...`); dùng lại giá trị đang có, không tạo chuỗi mới lệch.
   - `CHAT_PROXY_URL`, `DATA_API_URL`, `LIVEKIT_URL` (Text) — lần lượt lấy từ `NEXT_PUBLIC_CHAT_API_URL`, `NEXT_PUBLIC_DATA_API_URL`, `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` trong `.env.local`.
7. **D1 binding**: Settings → Bindings → Add → D1 database, variable name `DB` → database `zenspace` (dùng cho audit ở B5).

**Smoke test B3 (chưa cần B4):**

- Incognito mở `https://admin.zenstudy.space` → hiện trang đăng nhập Access; email lạ bị từ chối; đúng email thì thấy shell (đã đăng nhập thử bằng OTP 2026-10-25).
- `https://admin.zenstudy.space/` → 302 sang `/admin/`.
- `https://zenstudy-admin.<account>.workers.dev` → 404 (route workers.dev đã tắt, kiểm tra 2026-10-25).
- `https://zenstudy.space/admin/` → 404.
- Shell báo "API admin chưa được triển khai" — đúng, vì API thuộc B4.

**Rollback:** gỡ custom domain hoặc tắt application Access; project web không bị ảnh hưởng.

### B4 — Worker admin API (0.5–1 ngày)

Worker admin vừa phục vụ asset vừa làm API, không cần Pages Functions hay `_routes.json`:

- `wrangler.admin.jsonc`: `"main": "./admin-worker/_worker.ts"`, `assets.binding = "ASSETS"`.
- Asset được trả trước theo mặc định của Static Assets; Worker chỉ chạy với path không khớp file nào (như `/api/admin/*`). Các path còn lại vẫn đi qua `env.ASSETS.fetch(request)` để có fallback 404 của asset.
- Không copy code Worker vào `dist-admin`; wrangler bundle trực tiếp từ `admin-worker/`.

Route P0 (chỉ đọc):

- `GET /api/admin/ping`:
  - Verify Access JWT trước; mọi path `/api/admin/*` đều đi qua bước này.
  - Gọi `chat-proxy /health`, `data-api /health`, `livekit /usage` với timeout 3 giây.
  - LiveKit nhận `ADMIN_TOKEN` qua header `Authorization: Bearer …`, **không** đặt token trong URL.
  - Trả `{ ok, email, checks: [{name, ok, ms}], time }`; lỗi từng worker chỉ làm `checks[].ok = false`, API vẫn 200.
  - Không trả token, không trả lỗi thô chứa URL/secret; response có `Cache-Control: no-store`.

`verifyAccessJwt(request, env)`:

- Đọc header `Cf-Access-Jwt-Assertion`; thiếu → 401.
- Tải certs từ `https://${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`; cache 1 giờ, kid lạ thì tải lại một lần (khóa xoay vòng).
- Verify RS256 bằng WebCrypto (`crypto.subtle`), không thêm dependency; từ chối `alg` khác RS256.
- Kiểm chữ ký, `exp`/`nbf` (lệch 60 giây), `aud` chứa `ACCESS_AUD`, `iss === https://${ACCESS_TEAM_DOMAIN}`.
- Trả `email` claim để dùng cho audit.
- Lỗi mạng khi tải certs → fail closed (401), ghi log ngắn; không log token.

Test đã thêm 2026-10-25:

- `src/__tests__/unit/admin/access-jwt.test.ts` — thiếu header, hết hạn, sai `aud`, sai `iss`, sai chữ ký, `alg: none`, kid lạ, certs lỗi, cache, `aud` dạng mảng. Tự sinh cặp khóa RSA bằng WebCrypto, không gọi mạng.
- `src/__tests__/unit/admin/admin-worker.test.ts` — routing asset/API, 401, ping thành công, thiếu env, backend lỗi, 405/404, không lộ token trong body.

Đã chạy: 23 test mới pass (tổng 366), `npx tsc --noEmit` sạch, `npm run lint` 0 lỗi, `wrangler deploy --dry-run` đọc 4 file asset + bundle 7.76 KiB.

Còn lại để xong B4: đặt env Production + D1 binding trên dashboard, deploy, rồi kiểm `/api/admin/ping` trên host thật.

### B5 — Audit trước khi có ghi (0.5 ngày)

- Thêm vào `workers/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS admin_audit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email  TEXT NOT NULL,
  action       TEXT NOT NULL,
  target       TEXT,
  detail_json  TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at);
```

- Cập nhật comment đầu file (hiện ghi "2 bảng" → 3 bảng).
- Chạy SQL trong D1 Console `zenspace` theo quy ước repo.
- `logAudit(env, { actor, action, target, detail })` trong `_worker.js`, dùng `env.DB`.
  - Khi có endpoint ghi: audit lỗi thì **chặn** hành động (fail closed), không ghi lén.
- P0 chưa có endpoint ghi; helper + bảng chỉ là nền, dùng thật ở P2.

### B6 — Dọn source (0.5 ngày)

- Xóa `src/app/admin/toasts/page.tsx`; bỏ tab `toasts` khỏi `AdminHeader`; bỏ link tới trang này trong `src/app/admin/chat/page.tsx`.
- Move `src/app/admin/scenes/page.tsx` → `src/app/dev/studio/page.tsx`.
  - Giữ nguyên API `/api/admin/scenes`: độ sâu route tương đương nên fetch tương đối không phải sửa.
  - Cập nhật link: `AdminHeader`, runbook trong `src/app/admin/page.tsx`, `src/components/study/SceneSelectorWidget.tsx`, text trong `src/data/admin/hit-limits.ts`.
- Tab Studio trỏ `/dev/studio`, ghi rõ "chỉ chạy local".
- `/admin/chat` giữ nguyên cho local, thêm ghi chú "chưa publish lên host admin".
- Trang `/admin` (bảng hạn mức) giữ tạm đến P1; chưa publish ở P0.

### B7 — Kiểm chứng và rollback (0.5 ngày)

- `npm run lint`, `npx tsc --noEmit`, `npm test`.
- Build web: không còn `out/admin`, `out/dev`.
- Deploy web: `zenstudy.space/admin/` → 404; các trang học bình thường.
- Deploy admin: Access chặn incognito; đăng nhập đúng email thì shell tải; `/api/admin/ping` trả 3 check.
- Preview URL: bị tắt hoặc bị Access chặn.
- Local: `npm run dev` → `/admin`, `/admin/chat`, `/dev/studio` vẫn chạy.
- Rollback: Access cấu hình sai → dùng local admin, sửa policy trên dashboard; không đụng dữ liệu. Build web lỗi strip → bỏ bước strip, deploy lại, admin project vẫn tách riêng.

## Thời lượng

Khoảng **2–3 ngày** làm việc, trong đó phần lớn là dashboard Cloudflare và kiểm thử Access.

## Rủi ro

- **Preview URL public**: quên tắt là Access bị đi vòng.
- **Access lockout**: policy sai thì không ai vào được; luôn giữ đường local và một email break-glass.
- **DNS**: Access chỉ bảo vệ hostname đi qua Cloudflare; không CNAME trỏ thẳng ra ngoài.
- **Hai project một repo**: env và build command phải đặt đúng project; secret chỉ ở admin.
- **Asset được trả trước Worker**: mặc định `run_worker_first = false`, nên API phải dùng path không trùng file tĩnh. Đừng đặt file tên `api/admin/ping` trong `dist-admin/`.
- **Certs Access tải lỗi**: fail closed, nhưng cần log để biết vì sao 401.
- **GitHub Pages cũ**: xóa workflow không xóa bản đã deploy; phải unpublish thủ công.
- **CF build phút**: hiện P0 chỉ build web; từ P1 admin build thêm một lần Next.

## Sau P0

P1 thay shell bằng trang Overview thật: publish trang Next + `_next` vào project admin, thêm `/api/admin/overview`, xóa trang hạn mức khỏi app và sinh `docs/guides/SYSTEM_LIMITS.md`.
