# Kế Hoạch Mở Rộng Admin Console

Trạng thái: đề xuất, chưa triển khai. Bản 4 — 2026-10-25.
Đã chốt: admin chạy trên Cloudflare Pages (kèm Pages Functions) sau Cloudflare Access. GitHub Actions đã bỏ; web chính deploy bằng Cloudflare Pages.

Chi tiết từng mục viết khi bắt tay làm. Kế hoạch triển khai chi tiết P0: `docs/features/ADMIN_P0_PLAN.md`. Lịch sử thay đổi ở cuối file.

## Mục tiêu

Biến `/admin` thành bảng điều khiển vận hành nội bộ: thấy hệ thống đang khỏe hay ốm, ai đang dùng, cái gì sắp chạm trần, và sửa được cấu hình mà không deploy — nhưng chỉ người có quyền mở được, và mọi số liệu hiển thị là số thật.

## Kiến trúc đích

```
Người vận hành
  └─ admin.zenstudy.space            ← Cloudflare Access (chỉ email trong danh sách)
       └─ Pages project zenstudy-admin (trang /admin tĩnh)
            └─ Pages Functions /api/admin/*   ← giữ ADMIN_TOKEN, kiểm Access JWT
                 ├─ chat-proxy
                 ├─ data-api
                 └─ livekit

zenstudy.space ── Pages project web (tĩnh, không còn /admin)
```

Token worker chỉ nằm ở env của Pages Functions. Trình duyệt không bao giờ thấy token. Access lo đăng nhập; không tự viết trang login/2FA.

## Hiện trạng

- 4 tab: Hạn mức (`/admin`), Chatbot (`/admin/chat`), Bối cảnh (`/admin/scenes`), Toasts (`/admin/toasts`).
- Dữ liệu live duy nhất: LiveKit `/admin/usage`, LocalStorage/IndexedDB của chính máy đang mở. Còn lại là số hardcode.
- 4 trang admin là client component và nằm trong static export. Bản đang chạy hiện trả 404 khi kiểm tra ngày 2026-10-25, nhưng lần deploy tới sẽ lộ nếu không xóa `out/admin`. Chỉ `/api/*` mới chặn dev; không có cổng đăng nhập.
- `ADMIN_TOKEN` đang dán tay, lưu `localStorage` và gửi qua `?token=`.
- ~4.700 dòng cho 4 trang; riêng trang chat ~2.000 dòng tự dựng header/theme riêng. Ngưỡng hạn mức lặp ở nhiều chỗ (thẻ KPI, bảng, worker) nên dễ lệch.
- Studio bối cảnh ghi thẳng `src/data/assets` và `public/study` → chỉ chạy trên máy dev.
- D1 đã có `chat_usage` và `user_data` nhưng chưa có endpoint admin để đọc.
- GitHub Actions cũ (`.github/workflows/deploy-pages.yml`) upload nguyên `out/` lên GitHub Pages và đã được xóa ngày 2026-10-25. Web chính hiện deploy bằng Cloudflare Pages theo `docs/deployment/DEPLOY.md`.

## Nguyên tắc

1. Admin là một Cloudflare Pages project riêng, đặt sau Access. Project web chính xóa `out/admin` và `out/dev` sau build.
2. Trình duyệt không giữ token worker. `ADMIN_TOKEN` nằm ở env của Pages Functions; phiên đăng nhập là cookie `CF_Authorization` (httpOnly) do Access đặt. Cấm `?token=` và `localStorage`.
3. Đọc trước, ghi sau. Audit log phải có trước hành động ghi đầu tiên.
4. Một endpoint tổng hợp cho dashboard; endpoint riêng chỉ cho hành động ghi.
5. UI không hardcode ngưỡng: lấy từ config hoặc từ worker báo về. Bảng tra cứu dài nằm ở `docs/`, sinh từ config.
6. Ưu tiên đọc dữ liệu có sẵn (D1 `chat_usage`, `user_data`, LiveKit `/rooms`, `/history`). Không thêm bảng nếu cột cũ đủ.
7. Không thêm dependency. Không dựng dashboard framework.
8. Nội dung (cảnh/âm thanh) sống ở R2 + manifest D1/KV. Studio ghi file chỉ là công cụ dev, không phải đường vận hành.

## Giai đoạn

### P0 — Nền an toàn (làm trước mọi thứ)

1. **Tạo Pages project riêng cho admin.**
   - Project `zenstudy-admin`, build từ repo này; publish bộ tài nguyên admin (`/admin` + `_next`), không publish cả app học.
   - Gắn custom domain `admin.zenstudy.space` (DNS trên Cloudflare).
   - Project web chính ở `zenstudy.space`: sau build xóa `out/admin` và `out/dev` bằng một script Node nhỏ (không thêm dependency).
   - Gỡ bản công khai cũ: GitHub repo → Settings → Pages → Unpublish. Xóa workflow không tự xóa deployment đã đăng. Đã kiểm tra 404 ngày 2026-10-25 nhưng vẫn xác nhận Pages đã tắt.
   - Kiểm tra: `https://zenstudy.space/admin/` trả 404; trang admin trên domain riêng vẫn tải đủ asset.
2. **Bật Cloudflare Access.**
   - Zero Trust → Access → Application (self-hosted) cho `admin.zenstudy.space` **và** `*.zenstudy-admin.pages.dev`.
   - Policy: `Allow` khi email = email admin đã chốt (1 người); One-time PIN; session 24h. Không ghi email vào repo.
   - Tắt preview deployments của project admin, hoặc bảo vệ luôn preview URL. Preview public là đường vòng phổ biến.
   - Không viết trang login riêng; phiên do Access quản lý.
3. **Pages Functions làm cổng duy nhất tới worker.**
   - Dùng Pages Functions advanced mode (`_worker.js` + `_routes.json` chỉ route `/api/*`) thay vì thư mục `functions/`, để hai Pages project trong cùng repo không dùng chung một thư mục.
   - Worker kiểm header `Cf-Access-Jwt-Assertion` (verify với certs của Access) trước khi xử lý.
   - Env **Production** của project admin: `ADMIN_TOKEN`, URL 3 worker. Không đặt các biến này ở Preview.
   - Admin UI gọi đường dẫn tương đối `/api/admin/...`; xóa `chat-admin-url`, `chat-admin-token` khỏi localStorage; bỏ `?token=`.
   - File nguồn ở `admin-worker/_worker.js`; build của project admin copy thành `dist-admin/_worker.js`.
   - Kiểm tra: DevTools → Network không thấy token; gọi thẳng worker không token → 401.
4. **Dọn tab.** Xóa `/admin/toasts`. Chuyển bảng hạn mức sang `docs/guides/SYSTEM_LIMITS.md`, sinh bằng `scripts/gen-limits-docs.mjs` từ nguồn duy nhất `src/data/admin/hit-limits.ts`. Chuyển Studio cảnh sang `/dev/studio` và loại khỏi bản publish.
5. **Audit log trước khi có ghi.** Bảng `admin_audit` (ai, hành động, tham số, thời điểm) + endpoint ghi. Chưa có bảng này thì chưa mở P2.
6. **Test cổng.** Không phiên → Access chặn trước khi tải trang; preview URL → cũng bị chặn; JWT sai → Functions trả 401; token không xuất hiện trong bundle, URL hay localStorage.

### P1 — Nhìn thấy hệ thống (chỉ đọc)

7. **Endpoint tổng hợp** `GET /api/admin/overview` (Pages Function, một chỗ check Access) trả một snapshot:
   - `health`: 3 worker + độ trễ.
   - `chat`: số câu hôm nay, top uid, ai đã dùng ≥ 80% hạn mức ngày.
   - `sync`: số uid đã sync, lần gần nhất, snapshot lớn nhất.
   - `livekit`: phút trong tháng, phòng đang mở, người tham gia.
   - `r2`: dung lượng / 10GB, file mồ côi so với manifest, file thiếu.
   - `limits`: giá trị thật worker đang dùng (không chép lại vào UI).
8. **Trang Admin Overview** thay trang chủ hiện tại: 4 khối Sức khỏe / Sử dụng & hạn mức / Lỗi & fallback / Nội dung. Mọi số đến từ `overview`; dùng lại `AdminHeader` và token CSS.
9. **Nhật ký lỗi & fallback bền**: D1 hoặc KV, giữ 7–30 ngày, tự dọn. Thay `lastError` trong RAM.
10. **Hợp nhất UI chat admin** vào shell chung: dùng `AdminHeader`/`AdminThemeContext`, tách client gọi API ra file riêng. Không đổi logic chain/prompt.

### P2 — Quản lý được (mở dần từng hành động ghi)

11. **Cờ hệ thống** KV `cfg:flags`: tắt chat, tắt LiveKit, bảo trì, banner toàn hệ thống. Ưu tiên đầu tiên của P2 vì chặn sự cố không cần deploy.
12. **Chat**: chain, provider, prompt — bê nguyên UI/logic đang chạy sang shell mới; mọi thay đổi ghi audit.
13. **Nội dung runtime**: manifest cảnh/âm thanh trong D1 (hoặc KV), media trên R2, có version + rollback. Studio dev chỉ để thử trước khi đẩy; không ghi file trên máy chủ production.
14. **Kho R2**: dung lượng, file mồ côi, file thiếu (đọc ở P1); xóa có xác nhận ở P2.

### P3 — Vận hành lâu dài

15. **Phản hồi người dùng**: nút báo lỗi trong app → D1 → hàng chờ admin.
16. **Chu kỳ dọn**: log lỗi, audit, feedback theo cửa sổ 30 ngày.
17. **Rà hạn mức**: mỗi tháng đối chiếu số worker báo với dashboard nhà cung cấp.

## Thứ tự đề nghị

P0.1 → P0.2 → P0.3 → P0.4/5/6 → P1.7 → P1.8 → P2.11 → P1.9/10 → phần còn lại theo nhu cầu thật.

Lý do: chặn lộ trước; thấy hệ thống trước khi sửa; cờ là cách chặn sự cố rẻ nhất.

## Không làm

- Tự viết hệ thống login/2FA; dùng Cloudflare Access.
- Publish admin trong project web chính.
- Dashboard framework hoặc dependency mới.
- Duyệt dữ liệu từng người dùng (chỉ aggregate; uid hiển thị rút gọn).
- Ghi/xóa trước khi có Access và audit.

## Rủi ro

- **Preview URL của Pages mặc định public**: phải tắt hoặc bảo vệ, nếu không Access bị đi vòng.
- **Access chỉ bảo vệ hostname đi qua Cloudflare**: DNS phải nằm ở Cloudflare, không CNAME trỏ thẳng ra ngoài.
- **Build hai project từ một repo**: env `NEXT_PUBLIC_*` của admin và web phải đồng bộ; secret chỉ đặt ở env Functions của project admin.
- **Không còn GitHub Actions**: nếu Pages project chưa nối Git integration thì push sẽ không deploy. Kiểm tra trước, đừng coi workflow cũ là đường lui.
- **Docs hạn mức sinh tự động**: quên chạy script thì docs lệch với config.
- Log và audit làm tăng ghi D1: giữ cửa sổ ngắn, tự dọn.
- Số quota là ước tính (Workers AI tính theo neurons), không thay dashboard nhà cung cấp.

## Kiểm chứng

Mỗi mục xong: test nhỏ cho phần tính toán/auth; `npm run lint`, `npx tsc --noEmit`, `npm test`; mở trang admin kiểm tra bằng mắt.

Riêng P0, kiểm tra thêm:
- Mở `https://zenstudy.space/admin/` → 404.
- Mở admin từ máy khác/incognito → bị Access chặn, đăng nhập đúng email mới vào.
- Mở preview URL → cũng bị chặn.
- DevTools → Network/Application → không thấy `ADMIN_TOKEN`, không có `?token=` trong URL.

## Lịch sử bản

- **Bản 1**: 4 tab, P0 auth chưa chốt cơ chế, audit ở P3.
- **Bản 2**: tách hosting khỏi static export, một cổng auth + cookie httpOnly, một endpoint tổng hợp, audit trước khi ghi, nội dung chuyển R2 + manifest.
- **Bản 3**: chốt Cloudflare Pages + Pages Functions + Cloudflare Access; bỏ GitHub Actions; thêm rủi ro preview URL và build hai project.
- **Bản 4**: chốt Access đúng 1 email, P0 chỉ shell + ping, URL `admin.zenstudy.space/admin/`, audit ở D1 `zenspace`.
