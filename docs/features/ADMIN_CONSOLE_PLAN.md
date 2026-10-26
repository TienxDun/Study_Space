# Kế Hoạch Mở Rộng Admin Console

Trạng thái: P0 đã xong 2026-10-25; P1a đã xong, P1b xong code (chờ xác minh deploy), P1c xong code (chờ xác minh deploy). Bản 9 — 2026-10-26.
Đã chốt: admin chạy trên Cloudflare Workers + Static Assets sau Cloudflare Access. GitHub Actions đã bỏ; web chính deploy bằng Cloudflare Pages.

Chi tiết từng mục viết khi bắt tay làm. P0 đã đóng, runbook ở `docs/archive/ADMIN_P0_PLAN.md`. P1 có kế hoạch riêng ở `docs/features/ADMIN_P1_PLAN.md`. Lịch sử thay đổi ở cuối file.

## Mục tiêu

Biến `/admin` thành bảng điều khiển vận hành nội bộ: thấy hệ thống đang khỏe hay ốm, ai đang dùng, cái gì sắp chạm trần, và sửa được cấu hình mà không deploy — nhưng chỉ người có quyền mở được, và mọi số liệu hiển thị là số thật.

## Kiến trúc đích

```
Người vận hành
  └─ admin.zenstudy.space            ← Cloudflare Access (chỉ email trong danh sách)
       └─ Worker zenstudy-admin (assets tĩnh trong dist-admin)
            └─ /api/admin/*            ← giữ ADMIN_TOKEN, kiểm Access JWT
                 ├─ chat-proxy
                 ├─ data-api
                 └─ livekit

zenstudy.space ── Pages project web (tĩnh, không còn /admin)
```

Token worker chỉ nằm ở env của Worker admin. Trình duyệt không bao giờ thấy token. Access lo đăng nhập; không tự viết trang login/2FA.

## Hiện trạng

- Admin đang chạy: shell tĩnh `admin-host/index.html` tại `admin.zenstudy.space/admin/`, gọi `/api/admin/ping`; có sức khỏe và độ trễ 3 worker, chưa có số liệu sử dụng.
- Các trang admin Next (`/admin`, `/admin/chat`, `/dev/studio`) chỉ tồn tại trên máy local; source bị gitignore và bản web đã strip. P0 không publish các trang này.
- Dữ liệu live hiện có: ping 3 worker. LiveKit `/usage` cần `ADMIN_TOKEN`; trang limits local gọi không token nên nhận 401. Phần còn lại là số hardcode hoặc localStorage.
- `ADMIN_TOKEN` từng được dán tay và lưu `localStorage` ở trang chat local; trang chat không được publish.
- ~4.700 dòng cho các trang admin cũ; riêng trang chat ~2.000 dòng tự dựng header/theme riêng. P1 không kế thừa phần này.
- Studio bối cảnh ghi thẳng `src/data/assets` và `public/study` → chỉ chạy trên máy dev.
- D1 đã có `chat_usage`, `user_data` và `admin_audit`; code chat-proxy đã ghi D1 và tự lùi về KV khi chưa gắn `DB`, nhưng bản deploy cần gắn binding D1 rồi deploy lại thì `chat_usage` mới có dữ liệu. Lượt gọi/neurons Workers AI không đếm trong hệ thống, xem trên Cloudflare Dashboard.
- GitHub Actions cũ (`.github/workflows/deploy-pages.yml`) upload nguyên `out/` lên GitHub Pages và đã được xóa ngày 2026-10-25. Web chính hiện deploy bằng Cloudflare Pages theo `docs/deployment/DEPLOY.md`.

## Nguyên tắc

1. Admin là một Cloudflare Worker riêng (Static Assets), đặt sau Access. Project web chính xóa `out/admin`, `out/api` và `out/dev` sau build.
2. Trình duyệt không giữ token worker. `ADMIN_TOKEN` nằm ở env của Worker admin; phiên đăng nhập là cookie `CF_Authorization` (httpOnly) do Access đặt. Cấm `?token=` và `localStorage`.
3. Đọc trước, ghi sau. Audit log phải có trước hành động ghi đầu tiên.
4. Một endpoint tổng hợp cho dashboard; endpoint riêng chỉ cho hành động ghi.
5. UI không hardcode ngưỡng: lấy từ config hoặc từ worker báo về. Bảng tra cứu dài nằm ở `docs/`, sinh từ config.
6. Ưu tiên đọc dữ liệu có sẵn (D1 `chat_usage`, `user_data`, LiveKit `/rooms`, `/history`). Không thêm bảng nếu cột cũ đủ.
7. Không thêm dependency. Không dựng dashboard framework.
8. Nội dung (cảnh/âm thanh) sống ở R2 + manifest D1/KV. Studio ghi file chỉ là công cụ dev, không phải đường vận hành.

## Giai đoạn

### P0 — Nền an toàn (đã xong 2026-10-25)

Biên bản triển khai và kiểm tra đầy đủ ở `docs/archive/ADMIN_P0_PLAN.md`. Dưới đây là trạng thái thật sau khi đóng P0.

1. **Worker riêng cho admin — xong.** `zenstudy-admin` phục vụ `dist-admin/` (shell `admin-host/index.html` + favicon + `_headers`/`_redirects`), không publish app học; custom domain `admin.zenstudy.space`, `/` redirect 302 về `/admin/`. Web chính chạy `scripts/strip-admin-export.mjs` để xóa `out/admin`, `out/api`, `out/dev` sau build Pages. GitHub Pages đã unpublish; `zenstudy.space/admin/` và `tienxdun.github.io/Study_Space/admin/` đều 404.
2. **Cloudflare Access — xong.** Một application self-hosted cho `admin.zenstudy.space`, policy Allow đúng 1 email admin, One-time PIN, session 24h; email không ghi vào repo. `workers_dev: false` và `preview_urls: false` ghim trong `wrangler.admin.jsonc`; route `*.workers.dev` trả 404. Team domain hiện là `leutiendung.cloudflareaccess.com` — đổi team domain thì phải cập nhật `ACCESS_TEAM_DOMAIN` cùng lúc, nếu không mọi JWT bị 401.
3. **Worker làm cổng duy nhất — xong.** `wrangler.admin.jsonc` khai `main` → `admin-worker/_worker.ts`, `assets` → `./dist-admin`, `keep_vars: true`, binding `DB` → D1 `zenspace`. `verifyAccessJwt` kiểm `Cf-Access-Jwt-Assertion` (RS256; `aud`/`iss`/`exp`; cache certs 1 giờ) cho mọi `/api/admin/*`, fail closed; path khác đi qua `env.ASSETS.fetch()`. Env Production: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_TOKEN` (Secret), `CHAT_PROXY_URL`, `DATA_API_URL`, `LIVEKIT_URL`. `GET /api/admin/ping` gọi 3 worker song song, timeout 10 giây, trả 200 kèm `checks[].ok` và `Cache-Control: no-store`; không trả token hay URL nội bộ. Local dùng `wrangler dev` + `ENVIRONMENT=development`, chỉ bỏ Access khi host là localhost; Production không đặt biến này.
   - **Còn nợ:** trang chat local `/admin/chat` vẫn lưu `chat-admin-token` trong localStorage và gọi `/usage` bằng `?token=`. Trang này không publish nên không lộ ra ngoài; dọn khi làm lại chat admin ở P2.
4. **Dọn tab — xong.** Đã xóa `/admin/toasts`; Studio cảnh chuyển sang `/dev/studio` (tracked nhưng bị strip khỏi bản web); `/admin/scenes` trả 404. Sinh `docs/guides/SYSTEM_LIMITS.md` cùng `scripts/gen-limits-docs.mjs` chuyển sang P1.
5. **Audit — xong phần nền.** Bảng `admin_audit` + index trong `workers/schema.sql`, đã chạy trên D1 `zenspace`. Helper `logAudit()` đã bỏ ở P1b vì chưa có endpoint ghi nào gọi; dựng lại cùng hành động ghi đầu tiên ở P2.
6. **Test cổng — xong.** `src/__tests__/unit/admin/` gồm `access-jwt.test.ts` (thiếu header, hết hạn, sai `aud`/`iss`/chữ ký, `alg: none`, kid lạ, certs lỗi, cache, `aud` dạng mảng), `admin-worker.test.ts` (routing, 401, ping, thiếu env, backend lỗi, 405/404, không lộ token) và `audit.test.ts`. `npm run lint`, `npx tsc --noEmit`, `npm test` sạch; `wrangler deploy --dry-run` thấy `env.DB (zenspace)`.

Bài học đã ghim vào config: một lần push `main` bật lại route `workers.dev` và xóa binding `DB` thêm tay trên dashboard. Vì vậy `workers_dev`/`preview_urls` phải nằm trong config, và mọi binding phải khai trong `wrangler.admin.jsonc` — `keep_vars` chỉ giữ biến Text.

### P1 — Nhìn thấy hệ thống (chỉ đọc)

Kế hoạch chi tiết ở [`docs/features/ADMIN_P1_PLAN.md`](./ADMIN_P1_PLAN.md).

Tóm tắt: UI mới bằng shell tĩnh, không dùng admin cũ; một endpoint `GET /api/admin/overview`. Chia 3 bước: P1a sức khỏe + sử dụng/hạn mức, P1b log lỗi D1, P1c dung lượng/số object R2. Chat admin tiếp tục local, không publish.

### P2 — Quản lý được (mở dần từng hành động ghi)

11. **Cờ hệ thống** KV `cfg:flags`: tắt chat, tắt LiveKit, bảo trì, banner toàn hệ thống. Ưu tiên đầu tiên của P2 vì chặn sự cố không cần deploy.
12. **Chat**: chain, provider, prompt — xây UI mới trên shell hoặc giữ local; dùng lại API hiện có, không bê nguyên trang Next cũ; mọi thay đổi ghi audit.
13. **Nội dung runtime**: manifest cảnh/âm thanh trong D1 (hoặc KV), media trên R2, có version + rollback. Studio dev chỉ để thử trước khi đẩy; không ghi file trên máy chủ production.
14. **Kho R2**: manifest cảnh/âm thanh, file mồ côi/thiếu, xóa có xác nhận. P1 chỉ hiển thị dung lượng và số object.

### P3 — Vận hành lâu dài

15. **Phản hồi người dùng**: nút báo lỗi trong app → D1 → hàng chờ admin.
16. **Chu kỳ dọn**: log lỗi, audit, feedback theo cửa sổ 30 ngày.
17. **Rà hạn mức**: mỗi tháng đối chiếu số worker báo với dashboard nhà cung cấp.

## Thứ tự đề nghị

P0 (xong 2026-10-25) → P1a → P1b → P1c → P2.11 → P2.12 → phần còn lại theo nhu cầu thật.

Lý do: chặn lộ trước; thấy hệ thống trước khi sửa; cờ là cách chặn sự cố rẻ nhất.

## Không làm

- Tự viết hệ thống login/2FA; dùng Cloudflare Access.
- Publish admin trong project web chính.
- Dashboard framework hoặc dependency mới.
- Duyệt dữ liệu từng người dùng (chỉ aggregate; uid hiển thị rút gọn).
- Ghi/xóa trước khi có Access và audit.

## Rủi ro

- **Preview URL mặc định public**: `*.workers.dev` và preview build phải tắt hoặc bảo vệ, nếu không Access bị đi vòng. Đã từng bật lại sau một lần deploy; giữ `workers_dev: false` và `preview_urls: false` trong config.
- **Deploy xóa biến/binding trên dashboard**: `keep_vars: true` chỉ giữ biến Text; binding (D1, R2, KV) phải khai trong `wrangler.admin.jsonc`, thêm tay sẽ bị xóa ở lần push sau.
- **Access đổi team domain**: `iss` trong JWT đổi theo, Worker 401 dù policy đúng; cập nhật `ACCESS_TEAM_DOMAIN` cùng lúc.
- **Access chỉ bảo vệ hostname đi qua Cloudflare**: DNS phải nằm ở Cloudflare, không CNAME trỏ thẳng ra ngoài.
- **Build hai project từ một repo**: admin là shell tĩnh, web là Next; `NEXT_PUBLIC_*` chỉ cấu hình cho web, secret chỉ đặt ở env của Worker admin.
- **Không còn GitHub Actions**: nếu project web chưa nối Git integration thì push sẽ không deploy. Kiểm tra trước, đừng coi workflow cũ là đường lui.
- **Docs hạn mức sinh tự động**: quên chạy script thì docs lệch với config.
- Log và audit làm tăng ghi D1: giữ cửa sổ ngắn, tự dọn.
- Không hiển thị neurons/ước tính Workers AI; số thật xem trên Cloudflare Dashboard.

## Kiểm chứng

Mỗi mục xong: test nhỏ cho phần tính toán/auth; `npm run lint`, `npx tsc --noEmit`, `npm test`; mở trang admin kiểm tra bằng mắt.

P0 đã kiểm 2026-10-25 (biên bản trong runbook):
- `https://zenstudy.space/admin/` và `https://tienxdun.github.io/Study_Space/admin/` → 404.
- Admin từ incognito → Access chặn; đăng nhập đúng email mới vào; email lạ bị từ chối.
- `*.workers.dev` và preview URL → 404, không còn đường vòng.
- DevTools → Network/Application → không thấy `ADMIN_TOKEN`, không có `?token=` trong URL.

P1 có mục kiểm chứng riêng trong `docs/features/ADMIN_P1_PLAN.md`.

## Lịch sử bản

- **Bản 1**: 4 tab, P0 auth chưa chốt cơ chế, audit ở P3.
- **Bản 2**: tách hosting khỏi static export, một cổng auth + cookie httpOnly, một endpoint tổng hợp, audit trước khi ghi, nội dung chuyển R2 + manifest.
- **Bản 3**: chốt Cloudflare Pages + Pages Functions + Cloudflare Access; bỏ GitHub Actions; thêm rủi ro preview URL và build hai project.
- **Bản 4**: chốt Access đúng 1 email, P0 chỉ shell + ping, URL `admin.zenstudy.space/admin/`, audit ở D1 `zenspace`.
- **Bản 5**: Cloudflare gộp Pages vào Workers; admin chuyển sang Worker + Static Assets (`wrangler.admin.jsonc`); `workers.dev` tắt hẳn, chỉ còn hostname Access; web vẫn ở Pages.
- **Bản 6**: chốt UI P1 bằng shell tĩnh mới, P1a/P1b/P1c, bỏ top uid/≥80%, log lỗi D1, R2 mức cơ bản; chat admin ở local.
- **Bản 7**: tách toàn bộ P1 sang `docs/features/ADMIN_P1_PLAN.md`; plan tổng chỉ giữ kiến trúc, lộ trình và quyết định chung.
- **Bản 8**: cập nhật P0 theo trạng thái thực tế sau khi đóng (Access, `workers.dev`/preview, binding, audit, test); ghi rõ phần còn nợ chuyển sang P1/P2 và bổ sung rủi ro đã gặp.
- **Bản 9** (2026-10-26): đánh dấu P1c đã duyệt; đồng bộ timeout probe 10 giây giữa code, UI và docs.
