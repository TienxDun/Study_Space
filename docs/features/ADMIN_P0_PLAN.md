# P0 — Nền an toàn (kế hoạch triển khai sơ bộ)

Trạng thái: sơ bộ, chưa làm. Thuộc P0 của `docs/features/ADMIN_CONSOLE_PLAN.md`. Ngày 2026-10-25.

Mục tiêu của P0 không phải làm dashboard đẹp, mà là: **admin không còn public, chỉ người có quyền vào được, trình duyệt không thấy token, và có sẵn nền audit trước khi mở quyền ghi.**

## Definition of Done

- [ ] `https://zenstudy.space/admin/` trả 404 (hiện đã 404 — phải giữ 404 sau mọi lần deploy).
- [ ] `https://tienxdun.github.io/Study_Space/admin/` trả 404 (đã kiểm tra 2026-10-25); xác nhận GitHub Pages đã tắt để không có bản cũ xuất hiện lại.
- [ ] `https://admin.zenstudy.space` bị Cloudflare Access chặn; chỉ đúng email admin đã cấu hình vào được.
- [ ] Preview URL của project admin bị tắt hoặc cũng bị Access chặn.
- [ ] Trang admin gọi `/api/admin/ping`; DevTools không thấy `ADMIN_TOKEN`, không có `?token=`, không có `chat-admin-token`.
- [ ] Local `npm run dev` vẫn dùng được `/admin`, `/admin/chat`, `/dev/studio`.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch.
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
- `scripts/prepare-admin-pages.mjs`: dựng `dist-admin/` (shell + `_redirects` + `_headers`); chép `admin-worker/_worker.js` và `_routes.json` khi đã có, chưa có thì cảnh báo.
- `package.json`: thêm `build:web` và `build:admin`.
- `.gitignore`: thêm `dist-admin/`.

Lưu ý: `src/app/admin` và `src/app/api` đang bị gitignore nên Cloudflare không thấy; đó là lý do export trên Cloudflare không vướng route handler động. Ở máy local, hai thư mục này làm `next build` với `output: export` báo lỗi — chỉ kiểm tra export bằng checkout sạch (hoặc tạm ẩn hai thư mục), đừng deploy từ máy local.

Cấu hình Cloudflare Pages:

| Project | Build command | Output | Ghi chú |
|---|---|---|---|
| web (`zenstudy.space`) | `npm run build:web` | `out` | Env như hiện tại |
| admin (`zenstudy-admin`) | `npm run build:admin` | `dist-admin` | P0 chưa cần Next build; P1 đổi sang build Next thật |

Nội dung `dist-admin/` ở P0:

```
dist-admin/
  admin/index.html      # shell + gọi /api/admin/ping
  _worker.js            # copy từ admin-worker/
  _routes.json          # { "version": 1, "include": ["/api/*"], "exclude": [] }
  _redirects            # /  /admin/  302
  _headers              # X-Robots-Tag: noindex
```

Kiểm tra: `npm run build:admin` sinh `dist-admin/admin/index.html`; export web kiểm bằng checkout sạch (đã chạy 2026-10-25: build qua, script xóa đúng `out/admin`, `out/dev`, giữ `out/dev-preview`). P0 **không publish** `/admin/chat`, `/admin/scenes`, `/admin/toasts`.

### B3 — Pages project + Cloudflare Access (0.5 ngày, chủ yếu dashboard)

**Điều kiện:** B2 đã commit + push lên `main` (Cloudflare build từ Git, không thấy file chưa commit).

1. **Sửa project web hiện có** (`zenstudy.space`): Settings → Builds & deployments → Build command `npm run build:web`, Output `out`. Không đổi biến môi trường.
2. **Tạo project admin**: Workers & Pages → Create → Pages → Connect to Git → chọn repo → branch `main`.
   - Framework preset: `None`.
   - Build command: `npm run build:admin`.
   - Output directory: `dist-admin`.
   - Root directory: để trống.
   - Chưa cần biến môi trường ở bước này; project sẽ publish shell tĩnh.
3. **Custom domain**: project `zenstudy-admin` → Custom domains → Set up → `admin.zenstudy.space`. Zone đã ở Cloudflare nên DNS + TLS tự tạo.
4. **Protect cả địa chỉ mặc định**: `zenstudy-admin.pages.dev` vẫn tồn tại và **không** được custom domain bảo vệ. Tạo thêm một Access application cho hostname này (hoặc wildcard `*.zenstudy-admin.pages.dev`) với cùng policy.
5. **Cloudflare Access** (Zero Trust → Access → Applications → Add an application → Self-hosted):
   - Application 1: `admin.zenstudy.space`, include toàn bộ path.
   - Policy: `Allow` khi `Emails` = đúng email admin đã chốt (1 người). Không thêm policy `Bypass`.
   - Login method: One-time PIN (bật ở Settings → Authentication). Session duration: 24 giờ.
   - Application 2: `zenstudy-admin.pages.dev` (hoặc wildcard), cùng policy.
   - Bật 2FA + lưu recovery code cho tài khoản Cloudflare **trước** bước này.
6. **Tắt preview deployments** của project admin: Settings → Builds & deployments → Preview deployments → None/Disable.
7. **Env Production** (Settings → Variables and Secrets; **chỉ Production**, không đặt ở Preview):
   - `ACCESS_TEAM_DOMAIN` (Text) — `https://<team>.cloudflareaccess.com` lấy ở Zero Trust → Settings.
   - `ACCESS_AUD` (Text) — Application Audience Tag trong trang tổng quan của application.
   - `ADMIN_TOKEN` (**Secret**) — phải **trùng** `ADMIN_TOKEN` của worker `livekit` (vì B4 gọi `/usage?token=...`); dùng lại giá trị đang có, không tạo chuỗi mới lệch.
   - `CHAT_PROXY_URL`, `DATA_API_URL`, `LIVEKIT_URL` (Text) — lần lượt lấy từ `NEXT_PUBLIC_CHAT_API_URL`, `NEXT_PUBLIC_DATA_API_URL`, `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` trong `.env.local`.
8. **D1 binding**: Settings → Bindings → Add → D1 database, variable name `DB` → database `zenspace` (dùng cho audit ở B5).

**Smoke test B3 (chưa cần B4):**

- Incognito mở `https://admin.zenstudy.space` → hiện trang đăng nhập Access; email lạ bị từ chối; đúng email thì thấy shell.
- `https://admin.zenstudy.space/` → 302 sang `/admin/`.
- `https://zenstudy-admin.pages.dev` → cũng bị Access chặn.
- `https://zenstudy.space/admin/` → 404.
- Shell báo "API admin chưa được triển khai" — đúng, vì `_worker.js` thuộc B4.

**Rollback:** gỡ custom domain hoặc tắt application Access; project web không bị ảnh hưởng.

### B4 — Worker admin API (0.5–1 ngày)

Dùng **Pages Functions advanced mode** (`_worker.js` trong output), không dùng thư mục `functions/`:

- Lý do: chỉ cần một file, tránh `functions/` ở repo root bị cả hai Pages project dùng, và `_routes.json` giới hạn worker chỉ chạy `/api/*` (file tĩnh do Pages phục vụ, không qua worker).
- File nguồn: `admin-worker/_worker.js`; `prepare-admin-pages.mjs` copy thành `dist-admin/_worker.js`.

Route P0 (chỉ đọc):

- `GET /api/admin/ping`:
  - Verify Access JWT trước.
  - Gọi `chat-proxy /health`, `data-api /health`, `livekit /usage?token=...` với timeout 3 giây.
  - Trả `{ ok, email, checks: [{name, ok, ms}], time }`.
  - Không trả token, không trả lỗi thô chứa URL/secret.

`verifyAccessJwt(request, env)`:

- Đọc header `Cf-Access-Jwt-Assertion`; thiếu → 401.
- Tải certs từ `https://${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`; cache theo `kid` 1 giờ.
- Verify RS256 bằng WebCrypto (`crypto.subtle`), không thêm dependency.
- Kiểm `aud` chứa `ACCESS_AUD`, `iss === https://${ACCESS_TEAM_DOMAIN}`, `exp`/`nbf`.
- Trả `email` claim để dùng cho audit.
- Lỗi mạng khi tải certs → fail closed (401), ghi log ngắn.

Test: `src/__tests__/unit/admin/access-jwt.test.ts` — thiếu header, hết hạn, sai `aud`, sai `iss`, token hợp lệ. Tự sinh cặp khóa RSA bằng WebCrypto, không gọi mạng.

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
- **`_worker.js` advanced mode**: khi dùng nó, `functions/` bị bỏ qua; đừng trộn hai kiểu.
- **Certs Access tải lỗi**: fail closed, nhưng cần log để biết vì sao 401.
- **GitHub Pages cũ**: xóa workflow không xóa bản đã deploy; phải unpublish thủ công.
- **CF build phút**: hiện P0 chỉ build web; từ P1 admin build thêm một lần Next.

## Sau P0

P1 thay shell bằng trang Overview thật: publish trang Next + `_next` vào project admin, thêm `/api/admin/overview`, xóa trang hạn mức khỏi app và sinh `docs/guides/SYSTEM_LIMITS.md`.
