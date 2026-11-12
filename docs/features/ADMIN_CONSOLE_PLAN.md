# Kế Hoạch Mở Rộng Admin Console

Trạng thái (2026-11-11): P0/P1/P2a/P2b/P2e đã đóng; P2c đợt 1 đã triển khai. P2c đợt 2 và P2d đã lên production: upload đủ 5 thư mục, kiểm định dạng/dung lượng, bảo vệ tệp đang dùng, xóa riêng và dọn mồ côi đều đạt. Bốn lỗi xem trước/tên tệp/danh sách sử dụng đã sửa, kiểm local và deploy tự động qua commit `49a1cb2`; **P2c/P2d đóng theo quyết định 2026-11-11, không kiểm lại production**. P2 còn mở P2.0 mục 0.2 và nhánh hạn mức 30 → 35. Copy "chỉ xem" và hộp thoại native đã thay. QA tạo–sửa–xóa một cảnh ẩn, lịch sử v1 → v4; cuối buổi kho/nội dung trở về đúng trạng thái ban đầu (118 tệp; 40/20/49). **Việc tiếp theo: P3 — Vận hành lâu dài.** Bản 23 — 2026-11-11.
Đã chốt: admin chạy trên Cloudflare Workers + Static Assets sau Cloudflare Access. GitHub Actions đã bỏ; web chính deploy bằng Cloudflare Pages.

Chi tiết từng mục viết khi bắt tay làm. P0 đã đóng, runbook ở `docs/archive/ADMIN_P0_PLAN.md`. P1 đã đóng, hồ sơ ở `docs/archive/ADMIN_P1_PLAN.md`. P2 có kế hoạch riêng ở `docs/features/ADMIN_P2_PLAN.md`. Lịch sử thay đổi ở cuối file.

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
- Shell đã tách theo cấu trúc thư mục (2026-10-30): `index.html` còn ~191 dòng; HTML panel ở `admin-host/panels/`, CSS ở `admin-host/styles/{base,topbar,dashboard,footer,usage,flags,chat,content,reports}.css`, JS ở `admin-host/scripts/{dashboard,chat,content,reports}.js`, favicon ở `admin-host/assets/`. Build `prepare-admin-bundle.mjs` mở rộng `<!-- include: ... -->`, không publish `panels/` và `assets/`.
- Các trang admin Next cũ (`/admin`, `/dev/studio`) đã xóa (lần lượt 2026-11-03 và 2026-11-10); source dev từng bị gitignore và bản web đã strip. P0 không publish các trang này. Trang `/admin/chat` local đã xóa 2026-10-27 (thay bằng panel "Trợ lý chat" trong shell).
- Dữ liệu live hiện có: ping 3 worker. LiveKit `/usage` cần `ADMIN_TOKEN`; trang limits local gọi không token nên nhận 401. Phần còn lại là số hardcode hoặc localStorage.
- `ADMIN_TOKEN` từng được dán tay và lưu `localStorage` ở trang chat local; trang chat không được publish.
- ~4.700 dòng cho các trang admin cũ; riêng trang chat ~2.000 dòng tự dựng header/theme riêng. P1 không kế thừa phần này.
- Studio bối cảnh (đã xóa 2026-11-10) từng ghi thẳng `src/data/assets` và `public/study` → chỉ chạy trên máy dev; giờ mọi thay đổi nội dung đi qua shell admin.
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
8. Nội dung (cảnh/âm thanh) sống ở R2 + manifest D1/KV. Studio dev (đã xóa) từng là công cụ dev, không phải đường vận hành; giờ shell admin là đường duy nhất.

## Giai đoạn

### P0 — Nền an toàn (đã xong 2026-10-25)

Biên bản triển khai và kiểm tra đầy đủ ở `docs/archive/ADMIN_P0_PLAN.md`. Dưới đây là trạng thái thật sau khi đóng P0.

1. **Worker riêng cho admin — xong.** `zenstudy-admin` phục vụ `dist-admin/` (shell `admin-host/index.html` + favicon + `_headers`/`_redirects`), không publish app học; custom domain `admin.zenstudy.space`, `/` redirect 302 về `/admin/`. Web chính chạy `scripts/strip-admin-export.mjs` để xóa `out/admin`, `out/api`, `out/dev` sau build Pages. GitHub Pages đã unpublish; `zenstudy.space/admin/` và `tienxdun.github.io/Study_Space/admin/` đều 404.
2. **Cloudflare Access — xong.** Một application self-hosted cho `admin.zenstudy.space`, policy Allow đúng 1 email admin, One-time PIN, session 24h; email không ghi vào repo. `workers_dev: false` và `preview_urls: false` ghim trong `wrangler.admin.jsonc`; route `*.workers.dev` trả 404. Team domain hiện là `leutiendung.cloudflareaccess.com` — đổi team domain thì phải cập nhật `ACCESS_TEAM_DOMAIN` cùng lúc, nếu không mọi JWT bị 401.
3. **Worker làm cổng duy nhất — xong.** `wrangler.admin.jsonc` khai `main` → `admin-worker/_worker.ts`, `assets` → `./dist-admin`, `keep_vars: true`, binding `DB` → D1 `zenspace`. `verifyAccessJwt` kiểm `Cf-Access-Jwt-Assertion` (RS256; `aud`/`iss`/`exp`; cache certs 1 giờ) cho mọi `/api/admin/*`, fail closed; path khác đi qua `env.ASSETS.fetch()`. Env Production: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_TOKEN` (Secret), `CHAT_PROXY_URL`, `DATA_API_URL`, `LIVEKIT_URL`. `GET /api/admin/ping` gọi 3 worker song song, timeout 10 giây, trả 200 kèm `checks[].ok` và `Cache-Control: no-store`; không trả token hay URL nội bộ. Local dùng `wrangler dev` + `ENVIRONMENT=development`, chỉ bỏ Access khi host là localhost; Production không đặt biến này.
   - **Đã dọn (2026-10-27):** trang chat local `/admin/chat` (lưu `chat-admin-token` trong localStorage, gọi `/usage` bằng `?token=`) đã xóa; cấu hình chat giờ qua panel "Trợ lý chat" trong shell admin, browser không giữ token.
4. **Dọn tab — xong.** Đã xóa `/admin/toasts`; Studio cảnh chuyển sang `/dev/studio` (tracked nhưng bị strip khỏi bản web); `/admin/scenes` trả 404. Sinh `docs/guides/SYSTEM_LIMITS.md` cùng `scripts/gen-limits-docs.mjs` chuyển sang P1. Trang `/dev/studio` cùng `AdminHeader` cũ và 2 route dev của nó đã xóa 2026-11-10.
5. **Audit — xong phần nền.** Bảng `admin_audit` + index trong `workers/schema.sql`, đã chạy trên D1 `zenspace`. Helper `logAudit()` đã bỏ ở P1b vì chưa có endpoint ghi nào gọi; dựng lại cùng hành động ghi đầu tiên ở P2.
6. **Test cổng — xong.** `src/__tests__/unit/admin/` gồm `access-jwt.test.ts` (thiếu header, hết hạn, sai `aud`/`iss`/chữ ký, `alg: none`, kid lạ, certs lỗi, cache, `aud` dạng mảng), `admin-worker.test.ts` (routing, 401, ping, thiếu env, backend lỗi, 405/404, không lộ token) và `audit.test.ts`. `npm run lint`, `npx tsc --noEmit`, `npm test` sạch; `wrangler deploy --dry-run` thấy `env.DB (zenspace)`.

Bài học đã ghim vào config: một lần push `main` bật lại route `workers.dev` và xóa binding `DB` thêm tay trên dashboard. Vì vậy `workers_dev`/`preview_urls` phải nằm trong config, và mọi binding phải khai trong `wrangler.admin.jsonc` — `keep_vars` chỉ giữ biến Text.

### P1 — Nhìn thấy hệ thống (chỉ đọc)

Kế hoạch chi tiết ở [`docs/archive/ADMIN_P1_PLAN.md`](../archive/ADMIN_P1_PLAN.md).

Tóm tắt: UI mới bằng shell tĩnh, không dùng admin cũ; một endpoint `GET /api/admin/overview`. Chia 3 bước: P1a sức khỏe + sử dụng/hạn mức, P1b log lỗi D1, P1c dung lượng/số object R2. Chat admin tiếp tục local, không publish.

**Đã xong 2026-10-26.** Production trả 200 với `degraded: false`: health 3/3, chat theo ngày Thái Bình Dương, sync, LiveKit 440/4.500 phút, R2 487.851.634 byte / 121 object (khớp byte baseline S3), nhật ký lỗi D1 có dòng thật. Access vẫn chặn ở edge, network/localStorage không có token. Chi tiết và bằng chứng ở [`ADMIN_P1_PLAN.md`](../archive/ADMIN_P1_PLAN.md#kết-quả-đối-chiếu-production-2026-10-26).

Hai điểm từng mở đã xử lý: Twirp `ListRooms` có timeout 4 giây (P2.0) và log lỗi khử trùng theo giờ — nhưng chỉ trong worker admin; `chat-proxy` vẫn có thể ghi trùng (xem P2.0 mục 0.2).

### P2 — Quản lý được (mở dần từng hành động ghi)

Kế hoạch chi tiết, chia bước nhỏ và thứ tự deploy ở [`docs/features/ADMIN_P2_PLAN.md`](./ADMIN_P2_PLAN.md).

11. **Cờ hệ thống** KV `cfg:flags`: tắt chat, tắt LiveKit, bảo trì, banner toàn hệ thống, hạn mức câu/người/ngày. Ưu tiên đầu tiên của P2 vì chặn sự cố không cần deploy. Điều kiện đã rõ sau P1:
    - Tài khoản chỉ có **một** KV namespace `CHAT_QUOTA` (`a16e430f9bbe46afa51ffc9d4f9bce9d`). chat-proxy đã bind; admin worker chưa có KV → thêm `kv_namespaces` vào `wrangler.admin.jsonc` (binding, không phải `keep_vars`).
    - `livekit-rooms` chỉ đọc env, không có KV → nếu cờ "tắt LiveKit" phải chặn ở đó thì cần bind thêm namespace trên dashboard, hoặc để cờ trong D1 và cho worker đọc D1 (nó đã có `DB`).
    - Web là bản tĩnh: banner và trạng thái bảo trì phải đọc từ một endpoint công khai (ví dụ `GET /config` ở chat-proxy), không nhúng vào bản build.
    - Endpoint ghi đầu tiên: `POST /api/admin/flags` sau Access JWT, validate, ghi `admin_audit` trước khi `put` KV, đọc có cache ngắn. Bảng `admin_audit` + index đã có sẵn; helper `logAudit` đã bị xóa ở P1b nên phải dựng lại cùng endpoint này.
    - Cả trang admin và app phải thấy cờ mới trong vài chục giây, không cần deploy lại worker.
12. **Chat**: chain, provider, prompt — xây UI mới trên shell hoặc giữ local; dùng lại API hiện có, không bê nguyên trang Next cũ; mọi thay đổi ghi audit.
13. **Nội dung runtime**: manifest cảnh/âm thanh trong D1 (hoặc KV), media trên R2, có version + rollback. Mọi thao tác nội dung trong shell admin (thêm/sửa/xóa mục + upload/xóa tệp); không ghi file trên máy chủ production.
14. **Kho R2**: manifest cảnh/âm thanh, file mồ côi/thiếu, xóa có xác nhận. P1 chỉ hiển thị dung lượng và số object.
15. **Báo cáo nội dung & chặn (P2e)**: hộp thư báo cáo AI/phòng học, xử lý, hạn chế tài khoản — phục vụ chính sách AI-Generated Content và UGC của Google Play. Chi tiết ở [`ADMIN_P2_PLAN.md`](./ADMIN_P2_PLAN.md) (P2e) và [`P0_5_REPORTING_PLAN.md`](./P0_5_REPORTING_PLAN.md). **Làm trước P2d vì chặn nộp Play.**

### P3 — Vận hành lâu dài

16. **Phản hồi chung** (báo lỗi/góp ý, khác P2e báo cáo nội dung): nút gửi trong app → D1 → hàng chờ admin.
17. **Chu kỳ dọn**: log lỗi, audit, feedback theo cửa sổ 30 ngày.
18. **Rà hạn mức**: mỗi tháng đối chiếu số worker báo với dashboard nhà cung cấp.

## Thứ tự đề nghị

P0 (xong 2026-10-25) → P1a → P1b → P1c → P2.11 → P2.12 → P2c đợt 1 (đã triển khai) → P2e (xong) → P2c đợt 2 + P2d (đóng 2026-11-11 theo quyết định, không kiểm lại production) → P3 (việc tiếp theo), xen kẽ đóng P2.0 mục 0.2 và nhánh hạn mức 30 → 35 khi có dịp.

Lý do: chặn lộ trước; thấy hệ thống trước khi sửa; cờ là cách chặn sự cố rẻ nhất; P2e trước P2d vì là điều kiện nộp Google Play.

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
- **Push `main` không deploy admin**: Pages tự build web, nhưng worker `zenstudy-admin` chỉ đổi khi chạy `npm run build:admin` + `npx wrangler deploy --config wrangler.admin.jsonc`. Đã kiểm 2026-10-26: sau push chỉ có check `Cloudflare Pages`. `chat-proxy`/`livekit-rooms` vẫn dán code trên dashboard.
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

P1 có mục kiểm chứng riêng trong `docs/archive/ADMIN_P1_PLAN.md`.

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
- **Bản 10** (2026-10-26): đóng P1 sau đối chiếu production (số R2 khớp byte, Access/network sạch, log lỗi thật); sửa giả định "push là deploy admin"; bổ sung điều kiện kỹ thuật cho P2.11 (KV, điểm giữ cờ, endpoint cờ công khai, audit trước ghi).
- **Bản 11** (2026-10-26): tách P2 sang `docs/features/ADMIN_P2_PLAN.md`; chốt thứ tự P2.0 → P2a → P2b → P2c → P2d; P1 đã đóng nên hồ sơ chuyển vào `docs/archive/`.
- **Bản 12** (2026-10-27): gộp chỉnh hạn mức câu/người/ngày vào P2a (trường `chatDailyLimit` 1–200 trong `cfg:flags`, env chỉ còn là dự phòng).
- **Bản 13** (2026-10-29): thêm **P2e — Báo cáo nội dung & chặn** phục vụ chính sách AI/UGC của Google Play; đặt P2e trước P2d; tách P3.15 cũ thành "Phản hồi chung" để không lẫn với báo cáo nội dung. Ghi rõ UI admin phải sửa trong `admin-host/` (tracked), không phải `src/app/admin/` (gitignored).
- **Bản 14** (2026-10-30): **P2e code xong E1–E3/E5** — API reports/restrictions + panel "Báo cáo" trong shell; 11 ca test mới, toàn bộ 628 test xanh; chạy thử local với 2 báo cáo seed. Còn E4 (khóa AI/phòng có hiệu lực ở chat-proxy/livekit) và deploy.
- **Bản 15** (2026-10-30): tách shell theo panel — `index.html` còn ~187 dòng; HTML sang `admin-host/panels/*.html`, CSS sang `admin-*.css` theo panel; build mở rộng include, không publish `panels/`; test DOM dùng `loadAdminHtml()`. Bỏ 5 inline style tĩnh trong thẻ số liệu, giữ 3 style width do JS điều khiển.
- **Bản 16** (2026-10-30): tách tiếp `admin.css` 859 dòng thành `admin.css` (nền, 147), `admin-topbar.css` (248), `admin-dashboard.css` (316), `admin-footer.css` (145); giữ 5 file CSS panel. Tổng 9 file CSS, mỗi file dưới 320 dòng; build + local kiểm style/metadata OK, không lỗi console.
- **Bản 17** (2026-10-30): sắp xếp lại `admin-host/` thành `assets/`, `panels/`, `styles/`, `scripts/`; đổi tên `admin.css` → `styles/base.css`, `admin-chat.js` → `scripts/chat.js`…; cập nhật index, build favicon (copy cả `/admin/favicon.svg`), test DOM. Build + local 9 CSS/4 JS tải 200, không lỗi console.
- **Bản 18** (2026-11-09): rà tiến độ theo production — P2a, P2b, P2c đợt 1 và P2e đã đóng và lên production; P2.0 đóng mục 0.1, mục 0.2 còn nợ khử trùng ở `chat-proxy`; P2a còn nhánh hạn mức 30 → 35 (chưa có người dùng chạm mức); P2c còn đợt 2 (upload + tab Kho tệp) và bước kiểm sửa/xóa/rollback trên production; P2d và P3 chưa bắt đầu.
- **Bản 19** (2026-11-10): P2c đợt 2 + P2d code + test xong — upload tệp trực tiếp từ biểu mẫu (thanh tiến trình, ≤ 50 MB, không ghi đè), tab thứ tư "Kho tệp" (đang dùng bởi, mồ côi, tệp thiếu, xóa phải gõ đúng tên, dọn mồ côi hàng loạt). Shell không còn phụ thuộc `/dev/studio` để thêm nội dung. Chưa deploy; còn bước kiểm trên production và copy "chỉ xem".
- **Bản 20** (2026-11-10): xóa `/dev/studio` cùng code chỉ studio dùng (2 route dev, `AdminHeader`/`AdminThemeContext` cũ, test `admin-header`), gỡ nút mở studio trong bộ chọn cảnh, cập nhật copy hạn mức sang tab Nội dung + Kho tệp. Còn 2 trang thử `/dev/surface-lab` và `/dev/toasts`.
- **Bản 21** (2026-11-11): kiểm production P2c/P2d bằng bộ media thử: upload đủ 5 thư mục, validation, bảo vệ tệp đang dùng, xóa riêng và dọn 12 mồ côi đạt. Cảnh QA luôn ẩn, tạo/sửa/xóa làm lịch sử tăng tới v4; đã dọn toàn bộ 14 tệp và trả kho/nội dung về trạng thái ban đầu. Ghi nhận 4 lỗi chưa sửa (preview CDN 403, preview chậm cập nhật, mất chữ Đ, usedBy lặp); chưa đóng toàn P2c/C7. Có 11 ảnh và checklist local; không sửa code hay deploy.
- **Bản 22** (2026-11-11): sửa 4 lỗi từ biên bản production Nội dung/Kho tệp — preview video/audio dùng CORS ẩn danh thay `referrerpolicy` (CDN trả 206 thay vì 403), upload cập nhật preview ngay, Đ/đ chuyển thành d, `usedBy` không lặp trong cùng một cảnh. 10 ca hồi quy mới; `npm test` 94 file / 775 test xanh, lint/tsc/`build:admin` sạch. Kiểm bằng Chromium headless trên `wrangler dev`, ảnh 12–17 trong `admin-media-test/results-2026-11-11/`. **Đã push `49a1cb2`; Workers Builds báo thành công 10:14 UTC** — chưa kiểm lại 4 điểm và C7 trên production.
- **Bản 23** (2026-11-11): đóng P2c/P2d theo quyết định người dùng — bản sửa 4 lỗi đã push (`49a1cb2`) và Cloudflare báo deploy thành công; không kiểm lại production, các mục chưa có bằng chứng được ghi trong plan P2. P2 chỉ còn P2.0 mục 0.2 và nhánh hạn mức 30 → 35. Chuyển trọng tâm sang P3: phản hồi chung trong app, chu kỳ dọn dữ liệu 30 ngày, rà hạn mức hằng tháng.
