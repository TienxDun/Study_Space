# P3.16 — Góp ý trong ứng dụng (plan triển khai)

> Trạng thái: **đã code xong trong repo 2026-11-12 (gồm cả ảnh đính kèm P3.16b, mục 15), đã deploy schema D1 + data-api; chưa deploy web/admin** — cổng chất lượng đạt, kiểm tay trên dev đạt; bước 1–2 mục 10 xong 2026-11-12 (chủ repo xác nhận), còn bước 3–7. Ảnh đính kèm có thêm 5 bước deploy riêng ở mục 15. Bản 3.
> Thuộc P3 mục 16 của [ADMIN_CONSOLE_PLAN.md](./ADMIN_CONSOLE_PLAN.md).
> Mục tiêu: người dùng gửi báo lỗi/góp ý ngay trong app; dữ liệu vào D1; quản trị viên đọc và đánh dấu xử lý trong shell admin — không cần email, không cần máy local.

## 1. Phạm vi

**Làm trong đợt này**

1. Nút "Gửi góp ý" ở cả desktop và mobile.
2. Hộp thoại nhập: loại góp ý, nội dung, liên hệ (tùy chọn).
3. API công khai có xác thực Firebase: `POST /feedback` ở `workers/data-api`.
4. Bảng D1 `user_feedback`, giữ 180 ngày.
5. Tab "Phản hồi" trong admin shell: danh sách, lọc, chi tiết, đánh dấu đã xử lý/bỏ qua kèm ghi chú, ghi `admin_audit`.
6. Cập nhật `/privacy` và bước xóa tài khoản.

**Không làm (để sau, khi có nhu cầu thật)**

- Trả lời lại cho người gửi trong app hoặc qua email.
- Gửi khi chưa đăng nhập (xem mục 11 — nhánh P3.16b).
- Gộp chung hàng chờ với báo cáo vi phạm P2e; hai mục đích khác nhau nên để hai tab.

Ảnh đính kèm từng nằm trong danh sách "để sau" — đã làm ở mục 15 (P3.16b).

## 2. Hiện trạng liên quan

| Thành phần | Hiện có | Dùng lại thế nào |
|---|---|---|
| Báo cáo vi phạm (P2e) | `content_reports` + `POST /report` trong `workers/data-api/worker.js`; tab "Báo cáo" (`admin-host/panels/reports.html`, `scripts/reports.js`, `styles/reports.css`); `admin-worker/reports-api.ts` | Đây là mẫu để bám: cùng luồng xác thực, giới hạn ngày, dọn hạn lưu, audit trước khi ghi |
| Hộp thoại báo cáo AI | `src/components/study/chat/components/ReportAnswerDialog.tsx` | Mẫu cho hộp thoại góp ý (kính tối, bottom sheet trên mobile) |
| Gửi dữ liệu lên data-api | `src/lib/content-reports.ts`, `src/lib/user-blocks.ts` | Mẫu client: truyền `getToken`, quy đổi 401/429/mạng thành câu tiếng Việt |
| Trạng thái panel | `src/components/study/hooks/usePanelState.ts` → `useStudySpaceState.ts` | Thêm `isFeedbackOpen` vào đây, render ở cả hai layout |
| Đăng nhập | `useAuth()` trả `getToken`, `signIn` | Dùng cho nút gửi và lời mời đăng nhập |
| Xóa tài khoản | `DELETE /account` trong `workers/data-api/worker.js` đã dọn `user_data`, `chat_usage`, `content_reports`, `user_blocks`, `meet_*` | Bổ sung `user_feedback` vào cùng danh sách |
| Chỗ đặt nút | Desktop: `StudySettingsModal.tsx`; mobile: `MobileMoreSheet.tsx` (mục "Chung") | Thêm một dòng/nút, không tạo màn hình mới |
| Deploy data-api | Dán tay trên Cloudflare Dashboard (`docs/deployment/DEPLOY.md` Bước 1c) | Phải là bước riêng trong thứ tự deploy |

Chưa có bảng, API, UI hay bản ghi nào cho góp ý. Không có gì phải di trú.

## 3. Kiến trúc

Một đầu ghi, một đầu đọc, giống P2e:

```text
Desktop Settings ─┐
Mobile More sheet ┴─> FeedbackDialog ──POST /feedback──> data-api
                                        (Firebase token)      │
                                                              └─> D1 user_feedback
                                                                     │
admin-host tab "Phản hồi" <──GET/POST── admin-worker /api/admin/feedback
                                                                     │
                                                                 admin_audit (mỗi lần xử lý 1 dòng)
```

Lý do đặt ở data-api: đã xác thực Firebase, đã nằm trong luồng xóa tài khoản, cùng D1 `zenspace` với báo cáo vi phạm. Không tạo Worker mới.

## 4. Dữ liệu

File mới `workers/feedback-schema.sql`; đồng thời chép vào `workers/schema.sql` để lần dựng D1 sau có đủ.

```sql
CREATE TABLE IF NOT EXISTS user_feedback (
  id            TEXT PRIMARY KEY,
  uid           TEXT NOT NULL,
  name          TEXT,                    -- tên hiển thị lúc gửi, admin đọc thay UID
  kind          TEXT NOT NULL,           -- 'bug' | 'idea' | 'other'
  message       TEXT NOT NULL,
  contact       TEXT,                    -- email/liên hệ người dùng tự nguyện nhập
  app_version   TEXT,
  platform      TEXT,                    -- 'web' | 'android'
  viewport      TEXT,                    -- vd '1280x800', để đoán lỗi giao diện
  locale        TEXT,
  status        TEXT NOT NULL DEFAULT 'open',  -- open | resolved | dismissed
  created_at    INTEGER NOT NULL,
  resolved_at   INTEGER,
  resolved_by   TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON user_feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_uid_created ON user_feedback (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON user_feedback (created_at);
```

Giới hạn dữ liệu ở cả client và Worker: `kind` theo danh sách cho phép; `message` 10–2.000 ký tự; `contact` ≤ 120; `name` ≤ 30; `app_version` ≤ 20; `platform` ≤ 12; `viewport` ≤ 20; `locale` ≤ 12. Không lưu IP, không lưu user-agent đầy đủ.

Giới hạn tần suất: 5 lượt/ngày/UID (đếm theo ngày UTC như `/report`). Giữ 180 ngày, dọn ở lần đọc danh sách kế tiếp và khi ghi mới.

## 5. Backend người dùng — `workers/data-api/worker.js`

Thêm handler ngay sau nhánh `/report`, cùng khối xác thực:

1. `POST /feedback`, bắt buộc vé Firebase hợp lệ; chặn tài khoản đã xóa (thêm `/feedback` vào `deletedGuarded`).
2. Kiểm `kind`, độ dài, cắt khoảng trắng; `message` rỗng thì trả 400.
3. Đếm số lượt hôm nay theo `uid`; vượt 5 → 429 `RATE_LIMITED`.
4. `INSERT` với `crypto.randomUUID()`; `name` lấy từ body đã chuẩn hóa (client gửi tên hiển thị).
5. Dọn bản ghi cũ hơn 180 ngày.
6. Trả `{ ok: true, id, createdAt }`. Mã lỗi: `INVALID_KIND`, `VALIDATION`, `RATE_LIMITED`, `DELETED_ACCOUNT`, `d1_error`.

`DELETE /account`: thêm `DELETE FROM user_feedback WHERE uid = ?` và đếm vào kết quả trả về (giống cách đang làm với `content_reports`). Đọc tài khoản `/data` không đổi — góp ý không thuộc gói dữ liệu học tập.

File này **deploy bằng cách dán tay** trên dashboard; đừng quên bước này trong thứ tự triển khai.

## 6. Client trong app

**Thư viện** — `src/lib/feedback.ts`:

- `FEEDBACK_KINDS`: `bug` ("Báo lỗi"), `idea` ("Đề xuất cải thiện"), `other` ("Khác") — mã phải khớp Worker.
- `FEEDBACK_MESSAGE_MIN = 10`, `FEEDBACK_MESSAGE_MAX = 2000`.
- `submitFeedback({ getToken, kind, message, contact, name, context })` → `POST ${NEXT_PUBLIC_DATA_API_URL}/feedback`; quy đổi lỗi thành thông báo tiếng Việt: chưa đăng nhập, quá giới hạn hôm nay, mạng chập chờn (giống `content-reports.ts`).
- `context` tự thu tại chỗ gọi: `appVersion` (`APP_VERSION_LABEL`), `platform` (`NEXT_PUBLIC_MOBILE_SHELL === "1"` ? `android` : `web`), `viewport` (`innerWidth x innerHeight`), `locale` (`navigator.language`).

**Hộp thoại** — `src/components/study/feedback/FeedbackDialog.tsx`:

- Dựng theo khuôn `ReportAnswerDialog`: nền `bg-black/75`, panel kính tối, mobile là bottom sheet (`rounded-t-2xl`, `max-h-[88dvh]`), desktop là hộp giữa màn hình.
- Nội dung: 3 nút chọn loại (pill, viền sáng khi chọn), textarea kèm đếm ký tự `x/2000`, ô "Email liên hệ (không bắt buộc)", dòng chú thích "Chỉ quản trị viên ZenStudy đọc được. Đừng gửi mật khẩu."
- Nút "Gửi góp ý" chỉ bật khi đã chọn loại và nội dung đủ 10 ký tự; đang gửi thì khóa và đổi nhãn "Đang gửi…".
- Thành công: toast sonner "Đã gửi góp ý, cảm ơn bạn!" rồi đóng và xóa form. Lỗi: toast lỗi, giữ nguyên nội dung đã gõ.
- Chưa đăng nhập: hiện lời mời đăng nhập + nút "Đăng nhập" (`signIn`), nút gửi ẩn/khóa.
- Escape và bấm nền đóng khi không đang gửi; mở lại thì form trắng.

**Điểm mở**

- Desktop: `StudySettingsModal.tsx` thêm nhóm "Hỗ trợ" (cùng khung `SettingsSection` như các nhóm khác) với một nút "Gửi góp ý / báo lỗi".
- Mobile: `MobileMoreSheet.tsx`, mục "Chung", thêm dòng "Gửi góp ý" theo đúng `MoreButton` (icon Phosphor, ô icon màu). Đóng sheet rồi mở hộp thoại.
- State: thêm `isFeedbackOpen` + `handleOpenFeedback`/`handleCloseFeedback` vào `usePanelState`, xuất qua `useStudySpaceState`, gắn `<FeedbackDialog>` ở `StudyDesktopLayout` và `StudyMobileLayout` để cả hai dùng chung một hộp thoại.

## 7. Admin shell

**API** — `admin-worker/feedback-api.ts`, gắn vào `_worker.ts` tại `${API_PREFIX}/feedback` (chỉ sau Access như mọi route admin):

- `GET /api/admin/feedback?status=&limit=&before=` → dọn hạn lưu, đếm theo trạng thái, danh sách phân trang con trỏ `before` (mẫu `reports-api.ts`), trả trích nội dung 300 ký tự.
- `GET /api/admin/feedback/:id` → bản đầy đủ (nội dung tối đa 8.000 ký tự như báo cáo).
- `POST /api/admin/feedback/:id/status` với `{ status: "resolved" | "dismissed", note }` → `logAudit` **trước** khi ghi, action `feedback.resolve`, target `id`, detail gồm trạng thái mới, người gửi, ghi chú; giới hạn ghi dùng bộ đếm mới `allowFeedbackWrite` trong `audit.ts` (30 lượt/phút, cùng khuôn `allowReportWrite`).
- Không có thao tác xóa cứng: giữ lại để đối chiếu, tự dọn theo hạn 180 ngày.

**Giao diện** — tab thứ 8 "Phản hồi", đặt sau "Báo cáo":

- `admin-host/panels/feedback.html`: khung `panel-card` + `panel-header` như tab Báo cáo; thanh lọc trạng thái và loại; ba ô đếm Chờ xử lý / Đã xử lý / Đã bỏ qua; bảng cột **Thời gian · Người gửi · Loại · Trích nội dung · Trạng thái · Chi tiết**; khối chi tiết có nội dung đầy đủ, phiên bản, nền tảng, khung hình, liên hệ, ghi chú xử lý và hai nút "Đánh dấu đã xử lý" / "Bỏ qua" (không hỏi xác nhận, giống `reports.js`).
- `admin-host/scripts/feedback.js`: viết theo cấu trúc `reports.js` — gọi `fetch("/api/admin/feedback…")`, đổ bảng, phân trang "Xem thêm", mở/đóng chi tiết, thông báo lỗi qua `#feedback-note`, tải lại sau khi xử lý.
- `admin-host/styles/feedback.css`: chép khuôn `reports.css` (`.reports-*` → `.feedback-*`), không tạo ngôn ngữ hình ảnh mới.
- `admin-host/index.html`: thêm nút tab `data-admin-tab="feedback"`, khối `<!-- include: panels/feedback.html -->`, thẻ link CSS và script.
- Người gửi hiển thị **tên**, UID để trong tooltip/nhãn phụ — không đưa UID làm cột chính.

## 8. Giao diện — bám style hiện có

Yêu cầu: không đổi chất liệu, không thêm bảng màu mới.

| Nơi | Bám theo |
|---|---|
| Hộp thoại trong app | `ReportAnswerDialog` (kính tối `bg-[#0b0f16]/98`, viền `border-white/12`, tiêu đề 14px, chú thích 11px `text-zinc-400`, bo `rounded-2xl`, mobile bottom sheet) |
| Nút chọn loại | Pill như bộ chọn lý do trong `ReportAnswerDialog` (nền `bg-white/[0.04]`, chọn thì viền accent + nền accent/15) |
| Dòng trong mobile | `MoreButton` sẵn có trong `MobileMoreSheet` (icon 16px, ô icon 32px bo 12px, nhãn 14px, phụ 11px) |
| Nhóm trong settings desktop | `SettingsSection` sẵn có (khung `bg-white/[0.02]`, viền `border-white/[0.08]`) |
| Toast | sonner, `duration: 6000`, `id` cố định để không chồng thông báo |
| Admin | `panel-card`, `panel-header`, `btn-ghost`, `flag-input`, `services-table content-table`, `chat-feedback` — chép từ tab Báo cáo |
| Chữ | tiếng Việt, câu ngắn, không dùng thuật ngữ kỹ thuật với người dùng |

Kiểm trên 1280 và 390 px; mobile dùng `docs/guides/mobile-style-guide.md`, không đụng giao diện desktop khi sửa mobile (và ngược lại).

## 9. Kiểm thử

**Admin worker** (`src/__tests__/unit/admin/feedback-api.test.ts`): danh sách + lọc trạng thái/loại, phân trang `before`, dọn bản ghi quá 180 ngày, chi tiết 404, xử lý thành công ghi **đúng 1** dòng `admin_audit`, giới hạn ghi 429, body sai 400, thiếu binding 500.

**Admin panel** (`src/__tests__/unit/admin/feedback-panel.test.ts`, happy-dom, chạy `feedback.js` thật qua `new Function` như `reports-panel.test.ts`): đổ bảng kèm tên + tooltip UID, đổi bộ lọc gọi đúng query, mở chi tiết an toàn XSS, nút Xem thêm ẩn khi hết trang, nối trang không lặp, xử lý/bỏ qua gửi đúng body, lỗi danh sách hiện `#feedback-note`, lỗi xử lý giữ khối chi tiết mở.

**Tab** (`tabs.test.ts`): thêm `feedback` vào danh sách tab ẩn mặc định và ca chuyển tab.

**App** (`src/__tests__/unit/study/feedback.test.ts(x)`): `submitFeedback` thành công/401/429/lỗi mạng; hộp thoại khóa nút gửi khi thiếu dữ liệu, đếm ký tự, thành công thì đóng, lỗi thì giữ nội dung, chưa đăng nhập thì hiện lời mời.

**Cổng chất lượng**: `npm test` (98 file / 814 test), `npm run lint` (0 lỗi, 11 cảnh báo có sẵn, `lint:css OK`), `npx tsc --noEmit`, `npm run build:admin` — tất cả đạt 2026-11-12.

## 10. Thứ tự triển khai

Code trong repo đã xong (mục 9 đạt). Bước 1–2 đã chạy ngày 2026-11-12 (chủ repo xác nhận); các bước còn lại là deploy:

Mỗi bước không khóa bước khác, nhưng thứ tự dưới đây tránh 404 và tránh bảng thiếu:

1. [x] Chạy `workers/feedback-schema.sql` trên D1 `zenspace` — xong 2026-11-12 (chủ repo xác nhận); muốn kiểm lại: `SELECT name FROM sqlite_master WHERE name='user_feedback'`.
2. [x] Dán `workers/data-api/worker.js` mới lên dashboard — xong 2026-11-12 (chủ repo xác nhận).
3. [ ] Kiểm API bằng curl: không token → 401; `kind` lạ → 400; nội dung ngắn → 400; hợp lệ → 200 và có dòng trong D1; gửi lần thứ 6 trong ngày → 429.
4. [ ] Push code admin (worker + shell) — Workers Builds tự deploy; nếu check vắng thì `npm run build:admin` + `npx wrangler deploy --config wrangler.admin.jsonc`.
5. [ ] Push web (hộp thoại + nút + `/privacy` đã sửa sẵn trong repo). Sau bước này người dùng mới thấy nút.
6. [x] Cập nhật `/privacy` (mục 7) và ghi chú xóa tài khoản — đã sửa trong repo, live sau bước 5.
7. [ ] Kiểm tay: đăng nhập trên production, gửi 1 góp ý từ desktop và 1 từ mobile; admin thấy trong ≤ 10 giây sau khi bấm Làm mới; đánh dấu đã xử lý kèm ghi chú; kiểm 1 dòng `admin_audit`.

**Đã kiểm trên dev** (2026-11-12, `localhost:3001`, chưa đăng nhập): Cài đặt → mục HỖ TRỢ hiện dòng "Gửi góp ý / báo lỗi"; bấm Gửi mở hộp thoại đúng kính tối; 3 pill loại + đếm ký tự 26/2000 cập nhật; chưa đăng nhập thì hiện lời mời đăng nhập và nút gửi khóa; Escape đóng hộp thoại; console không có lỗi. Chưa kiểm luồng gửi thật trên dev vì cần đăng nhập + data-api mới; chưa kiểm bố cục mobile bằng mắt (in-app browser không xuất được ảnh chụp). Từ 2026-11-12 data-api mới đã deploy nên bước gửi thật trên dev (đăng nhập rồi gửi 1 góp ý) giờ làm được, gộp vào bước 3 và bước 7 ở trên.

**Sửa sau kiểm UI mobile** (2026-11-12): bản đầu dùng chung khuôn `ReportAnswerDialog` nên trên mobile là tấm dính đáy, thanh điều hướng đè lên và không có header/kính giống các sheet. Nay mobile dùng `FeedbackSheet` bọc trong `MobileSheetShell` (kính mờ, viền sáng, header + nút Zen, khay nằm trên thanh điều hướng, giữ trong DOM sau lần mở đầu, đóng thì xoá form); desktop vẫn là hộp giữa màn hình. Khay còn được mở như một màn hình trong stack mobile (`mobilePush("feedback")`) nên header có nút quay lại về bảng "Thêm" và nút Back của Android đóng đúng khay. Có test happy-dom cho khay (đúng role/tiêu đề/nút Zen/nút quay lại/đủ trường, mở lại thì form trắng). Khay góp ý còn được tính vào `isAnyMobileSheetOpen` nên đồng hồ giữa màn, thanh nhạc và lớp mờ nền ẩn hoặc bật giống mọi sheet khác (bản trước bị sót cờ này); tab "Thêm" trên thanh điều hướng cũng nhận đúng khay đang mở. `npm test` 98 file / 814 test.

**Rà thiết kế hộp góp ý** (2026-11-12, Chromium 390×844 và 360×640): lượt hai lược bớt chữ thừa — bỏ dòng gợi ý dưới mỗi ô loại góp ý, bỏ nhãn "Nội dung"/"Liên hệ" (thay bằng `aria-label`), rút câu mời đăng nhập còn một dòng, nút gửi đổi thành "Gửi"; ô nội dung và ô liên hệ dùng biến thể ô lõm `.lg-input-inset` (nền tối đặc, viền mảnh, bỏ lớp kính nổi) thay cho `lg-input` để cảnh nền không lọt vào chữ; nút gửi khi chưa đủ điều kiện dùng nền xám mờ chữ trắng 35% thay cho nền emerald mờ 40% (không đọc được); hàng nút Hủy/Gửi chuyển xuống khay `footer` của `MobileSheetShell` nên dính đáy khi ruột dài; mọi nút bấm cao 40 px. Trong ảnh kiểm, đầu trang (thanh trên) vẫn hiện đúng như các sheet khác; độ mờ của cả tấm là quy tắc kính chung của app, không sửa riêng cho hộp này. Nhịp dọc 16 px giữa các nhóm (ô đăng nhập → loại góp ý → ô nội dung), 12 px trước ô email, đệm đáy 12 px. Hộp mời đăng nhập xếp một hàng: câu nhắc bên trái, nút "Đăng nhập" trắng bên phải. Khay giữ nút mở rộng toàn màn hình; ở chế độ đó form đứng giữa theo chiều dọc (`my-auto`) thay vì dồn lên trên và để khoảng trống lớn phía dưới. Khay thường cao theo nội dung: 390×844 cao 498 px, cách thanh điều hướng 78 px.

## 11. Điểm cần chốt

1. **Bắt buộc đăng nhập** — đã chốt, đã code: khớp `/report`, không phải lưu IP, xóa tài khoản dọn sạch được. Người dùng local-only bấm nút sẽ thấy lời mời đăng nhập. Nếu sau này cần nhận cả từ người chưa đăng nhập, mở nhánh **P3.16c**: cho gửi ẩn danh, giới hạn theo IP đã băm, thêm mục riêng trong `/privacy`.
2. **Hạn lưu 180 ngày** — đã chốt, đã code, giống báo cáo vi phạm. Muốn giữ lâu hơn để làm roadmap thì nâng riêng cho `user_feedback`.
3. **Tên tab**: "Phản hồi" — đã chốt, đã code — ngắn, đủ nghĩa, không lẫn với "Báo cáo" vi phạm.

## 12. Ước lượng

Khoảng 1.100–1.300 dòng gồm test: SQL 40; data-api 90; admin worker 240 + route 10; admin shell 430 (HTML/CSS/JS); app 300 (lib + hộp thoại + state + điểm mở); test 280.

## 13. Rủi ro và cách né

- **Quên dán data-api**: web gọi `/feedback` nhận 404. Thứ tự bước 2 trước bước 5; kiểm curl ở bước 3.
- **Bảng chưa tạo**: API 500. Bước 1 luôn chạy trước; lỗi trả về là `d1_error` để dễ nhận ra.
- **Lẫn hai hàng chờ**: tiêu đề tab và mô tả ghi rõ "góp ý/báo lỗi chung", khác "báo cáo vi phạm".
- **Dữ liệu cá nhân**: chỉ lưu tên, nội dung và liên hệ tự nguyện; không IP, không user-agent; hiển thị tên thay UID; nói rõ trong hộp thoại và `/privacy`.
- **Spam**: 5 lượt/ngày/UID, cắt độ dài, không endpoint đọc công khai.
- **Nút khó thấy**: đặt trong Cài đặt (desktop) và mục "Chung" của mobile — hai nơi người dùng đã quen tìm.

## 14. Lịch sử thay đổi

- **Bản 2** (2026-11-12): triển khai xong trong repo — schema, data-api, admin worker + tab "Phản hồi", hộp thoại trong app, privacy, 5 bộ test mới; cổng chất lượng đạt; kiểm tay trên dev đạt phần chưa đăng nhập. Chưa deploy.
- **Bản 1** (2026-11-12): lên plan P3.16 — nút góp ý trong app, `user_feedback` trên D1, `POST /feedback` ở data-api, tab "Phản hồi" trong admin shell, audit mỗi lần xử lý, cập nhật privacy và xóa tài khoản. Kèm thứ tự deploy 7 bước và 3 điểm cần chốt.

## 15. P3.16b — Ảnh đính kèm (2026-11-12, code xong trong repo, chưa deploy)

**Đã chốt phạm vi**

- Mỗi lần gửi tối đa **1 ảnh**; ảnh được nén ngay trên máy xuống **≤ 1 MB**; mỗi tài khoản gửi tối đa **3 ảnh/ngày**; ảnh lưu trong **R2** chứ không nhét vào D1.
- Ảnh chỉ xem được trong tab "Phản hồi" (sau Cloudflare Access), không có URL công khai.
- Ảnh bị xóa cùng góp ý: dọn theo hạn 180 ngày và khi người dùng xóa tài khoản.

**Dữ liệu**

- `workers/feedback-schema.sql` thêm cột `image_key TEXT` (khoá R2 dạng `feedback/<yyyy-mm>/<uuid>.<ext>`, null nếu không có ảnh).
- DB đang chạy phải chạy thêm **một lần** `workers/feedback-image.sql` (`ALTER TABLE … ADD COLUMN image_key TEXT`). DB mới chỉ cần `feedback-schema.sql`.

**data-api (`workers/data-api/worker.js`)**

- `POST /feedback` nhận `multipart/form-data` (field `image`) hoặc JSON như cũ; từ chối body > 8 MB → 413 `PAYLOAD_TOO_LARGE`.
- Kiểm ảnh ở server, không tin client: > 1 MB → 400 `IMAGE_TOO_LARGE`; magic byte không phải JPEG/PNG/WebP → 400 `IMAGE_INVALID_TYPE`; thiếu binding `R2` → 503 `IMAGE_DISABLED` (góp ý dạng chữ vẫn gửi được).
- Đếm ảnh trong ngày: 3 ảnh/UID/ngày → 429 `IMAGE_RATE_LIMITED`; giới hạn 5 góp ý/ngày giữ nguyên và độc lập.
- Ghi thứ tự: `R2.put` trước, `INSERT` sau; `INSERT` lỗi thì xóa ảnh vừa ghi. Khoá dùng `crypto.randomUUID()` nên không đoán được.
- `DELETE /account`: đọc `image_key` của UID, xóa dòng, rồi xóa ảnh trong R2.
- Dọn hạn 180 ngày khi ghi mới lấy luôn `image_key` của dòng quá hạn và xóa ảnh tương ứng.

**Client**

- `src/lib/feedback-image.ts`: nén JPEG bằng canvas (cạnh dài 1600 px, hạ chất lượng/cạnh dần tới khi ≤ 1 MB), nhận JPG/PNG/WebP, gốc ≤ 20 MB, thông báo tiếng Việt cho từng trường hợp lỗi; PNG nền trong suốt được tô trắng để không ra nền đen.
- `src/lib/feedback.ts`: có ảnh thì gửi `FormData`, không thì JSON; chuyển mã lỗi server thành câu tiếng Việt (riêng `IMAGE_RATE_LIMITED` báo "đã đủ 3 ảnh hôm nay").
- `FeedbackDialog.tsx`: nút "Đính kèm ảnh (tối đa 1 MB)" + ảnh xem trước (blob URL, thu hồi khi bỏ ảnh/đóng/unmount), nút "Bỏ ảnh đính kèm", khóa nút gửi khi đang nén.

**Admin**

- `GET /api/admin/feedback/:id/image` (sau Access) đọc `image_key` từ D1 rồi stream từ R2 với `Content-Type` gốc, `Cache-Control: private, max-age=300`, `X-Content-Type-Options: nosniff`; không có ảnh/không có file → 404.
- Danh sách và chi tiết trả `hasImage`; bảng hiện nhãn "Có ảnh", khối chi tiết hiện ảnh (tối đa cao 420 px, bấm mở tab mới). Đóng chi tiết thì bỏ `src` để nhả bộ nhớ ảnh.
- `readFileIndex` trong `admin-worker/content-api.ts` bỏ qua khoá `feedback/` nên ảnh góp ý không hiện trong "Kho tệp", không bị tính là mồ côi và không thể bị dọn nhầm (prune cũng chỉ nhận thư mục media).

**Privacy**

- `/privacy` mục 7 nói rõ: 1 ảnh/lần, nén ≤ 1 MB, 3 ảnh/ngày, lưu ở Cloudflare, xóa cùng góp ý sau 180 ngày, nhắc che thông tin riêng tư trước khi gửi ảnh. Ngày cập nhật trang: 12/11/2026.

**Thứ tự deploy (thêm vào mục 10, làm trước bước 4–5)**

1. [ ] `npx wrangler d1 execute zenspace --remote --file=workers/feedback-image.sql` (chạy lại lần hai chỉ báo "duplicate column name", bỏ qua được).
2. [ ] Thêm binding **R2** tên `R2` → bucket `study-space` cho Worker data-api trên Cloudflare Dashboard (Worker này không có wrangler config trong repo). Thiếu bước này ảnh trả 503, chữ vẫn chạy.
3. [ ] Dán `workers/data-api/worker.js` mới.
4. [ ] Deploy admin worker + shell (`npm run build:admin` nếu Workers Builds không chạy) để có endpoint ảnh và nhãn "Có ảnh".
5. [ ] Push web (nút đính kèm + nén ảnh + privacy).

**Test** (đạt 2026-11-12)

- `study-worker-feedback.test.ts`: multipart lưu R2 đúng khoá, sai định dạng/quá 1 MB bị chặn, giới hạn 3 ảnh/ngày (chữ vẫn gửi được), thiếu R2 → 503, dọn hạn xóa ảnh.
- `study-worker-account-deletion.test.ts`: xóa tài khoản xóa đúng ảnh của UID, không đụng ảnh người khác.
- `feedback.test.ts(x)`: gửi FormData có `Authorization` và không tự đặt `Content-Type`, thông báo `IMAGE_RATE_LIMITED`, các nhánh từ chối của `prepareFeedbackImage`.
- `feedback-api.test.ts` + `feedback-panel.test.ts`: `hasImage`, proxy ảnh đúng header, 404 khi thiếu, dọn hạn xóa ảnh, nhãn "Có ảnh" và ảnh trong chi tiết, đóng chi tiết thì bỏ `src`.
- Kiểm tay trên admin local (2026-11-12): seed `image_key` + `wrangler r2 object put --local`, endpoint trả 200 `image/png` 60.741 byte, ảnh hiện trong chi tiết 480×320, nhãn "Có ảnh" chỉ ở dòng có ảnh, "Kho tệp" không liệt kê khoá `feedback/`.
- Cổng chất lượng: `npm test` 98 file / 828 test, `npx tsc --noEmit`, `npm run lint` (0 lỗi, 11 cảnh báo có sẵn), `npm run build:admin` — đạt.

**Rủi ro riêng của ảnh**

- Ảnh có thể chứa thông tin cá nhân ngoài ý muốn: chỉ admin đọc được, xóa cùng hạn 180 ngày, và copy `/privacy` nhắc che thông tin trước khi gửi. Không quét nội dung ảnh — chấp nhận vì số lượng nhỏ và có người duyệt.
- Ảnh nằm chung bucket `study-space`: mọi thao tác liệt kê/dọn của kho nội dung phải bỏ qua tiền tố `feedback/`; nếu thêm chỗ liệt kê R2 mới thì nhớ cùng quy tắc.
- R2 binding đặt tên khác (`R2` là chuẩn của admin worker) sẽ khiến data-api trả 503; kiểm bằng một lần gửi ảnh sau deploy.
