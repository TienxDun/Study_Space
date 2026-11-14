# P3.17 — Không tự xoá dữ liệu; admin xoá thủ công (plan triển khai)

> Trạng thái: **code xong 2026-11-15 — chưa deploy, chưa kiểm production.** Quyết định: bỏ toàn bộ cơ chế tự xoá dữ liệu trong hệ thống; chỉ xoá khi quản trị viên bấm nút trên shell admin (hoặc khi người dùng chủ động xoá tài khoản). Văn bản policy không nêu mốc ngày lưu trữ.
> Đã chạy: `npm test` (101 file / 862 test), `npx tsc --noEmit`, `npm run lint`, `npm run build:admin` — đều xanh.
> Thuộc P3 mục 17 của [ADMIN_CONSOLE_PLAN.md](./ADMIN_CONSOLE_PLAN.md) (định nghĩa lại: chu kỳ dọn tự động → xoá thủ công).
> Liên quan: [P3_FEEDBACK_PLAN.md](./P3_FEEDBACK_PLAN.md) (góp ý + ảnh), P2e (báo cáo nội dung), P1 (nhật ký lỗi).

## 1. Quyết định đã chốt

- Không cron, không tự xoá theo tuổi ở bất kỳ bảng/tệp nào. Bỏ cả kiểu "dọn ké khi có ghi mới" đang chạy.
- Admin xoá thủ công trên UI: từng dòng ở Phản hồi/Báo cáo, xoá cả nhóm "đã xử lý" (bulk), xoá toàn bộ nhật ký lỗi và nhật ký thao tác.
- Policy (privacy/terms) bỏ mọi mốc ngày lưu trữ và câu "tự động xoá". Giữ câu SLA "xóa tài khoản trong vòng 30 ngày" — đó là thời hạn xử lý yêu cầu, không phải lưu trữ.
- Giữ nguyên (không phải retention): xoá tài khoản theo yêu cầu người dùng, nút "Dọn mồ côi" ở Kho tệp, dọn metadata `meet_rooms` khi phòng đóng (LiveKit).

## 2. Gỡ tự xoá

| File | Việc |
|---|---|
| `admin-worker/errors.ts` | bỏ `ERROR_RETENTION_MS`, block DELETE trong `logAdminError`, biến `errorCleanupAt` |
| `workers/chat-proxy/worker.js` | bỏ block DELETE `admin_error_log` + `ERROR_RETENTION_MS`, sửa comment đầu mục |
| `workers/data-api/worker.js` | bỏ `pruneExpiredFeedback` + lời gọi ở POST /feedback; bỏ DELETE `content_reports` ở POST /report; bỏ `FEEDBACK_RETENTION_MS` nếu chỉ dùng cho prune (kiểm `deleteFeedbackImages` còn dùng cho rollback + xoá tài khoản) |
| `admin-worker/feedback-api.ts` | bỏ `FEEDBACK_RETENTION_MS`, `pruneExpiredFeedback`, lời gọi trong `listFeedback` |
| `admin-worker/reports-api.ts` | bỏ `REPORT_RETENTION_MS` + DELETE trong `listReports` |
| `workers/schema.sql` | sửa comment "giữ 14 ngày", "giữ 180 ngày, dọn ở lần đọc/ghi kế tiếp" |

## 3. API xoá thủ công (admin-worker, sau Cloudflare Access)

| Endpoint | Hành vi |
|---|---|
| `DELETE /api/admin/feedback/:id` | đọc `image_key` → audit → xoá dòng → xoá object R2. `{ ok, deleted: 1 }`; 404 nếu không có |
| `POST /api/admin/feedback/purge` | xoá mọi dòng `resolved`/`dismissed` + ảnh R2 của chúng; trả `{ ok, deleted }`; không có mục đóng thì `deleted: 0` và không audit |
| `DELETE /api/admin/reports/:id` | audit → xoá dòng `content_reports` |
| `POST /api/admin/reports/purge` | xoá mọi báo cáo `resolved`/`dismissed`, trả `{ ok, deleted }` |
| `DELETE /api/admin/errors` | audit → xoá toàn bộ `admin_error_log`; audit lỗi thì không xoá |
| `GET /api/admin/audit?limit=50&before=` | 50 dòng `admin_audit` mới nhất (limit ≤ 100), có `nextBefore` |
| `DELETE /api/admin/audit` | xoá toàn bộ `admin_audit`, sau đó ghi 1 dòng `audit.clear` (kèm số dòng đã xoá) |

- Audit action mới: `feedback.delete`, `feedback.purge`, `report.delete`, `report.purge`, `errors.clear`, `audit.clear`.
- Hạn mức ghi: dùng lại `allowFeedbackWrite` (feedback), `allowReportWrite` (reports), thêm `allowAuditWrite` 10 lần/phút cho errors/audit.
- Mọi endpoint xoá đều audit trước khi xoá; audit lỗi thì không xoá.

## 4. UI admin shell

1. **Phản hồi** (`panels/feedback.html`, `scripts/feedback.js`): mỗi dòng thêm nút "Xóa" cạnh "Xem"; toolbar thêm "Xóa mục đã xử lý" (ẩn/disable khi `resolved + dismissed = 0`). Xác nhận bằng `AdminDialog` (tone danger, hiện loại + thời gian + số lượng).
2. **Báo cáo** (`panels/reports.html`, `scripts/reports.js`): tương tự — "Xóa" từng dòng + "Xóa báo cáo đã xử lý".
3. **Chẩn đoán — Nhật ký sự cố** (`panels/diagnostics.html`, `scripts/dashboard.js`): bỏ copy "tự động dọn dẹp sau 14 ngày" và các câu "Giữ 14 ngày"; thêm nút "Xóa toàn bộ nhật ký" ở footer card, xác nhận danger, xoá xong tải lại overview.
4. **Chẩn đoán — mục mới "Nhật ký thao tác quản trị"**: bảng 50 dòng `admin_audit` (thời gian, người thao tác, hành động, đối tượng; chi tiết JSON nằm trong tooltip ô đối tượng), nút "Làm mới" + "Xóa toàn bộ". Script đọc `GET /api/admin/audit` khi tải trang; sau khi xoá thì tải lại và hiện note.
- Xoá thành công thì tải lại danh sách đang xem; nếu chi tiết đang mở đúng bản ghi vừa xoá thì đóng chi tiết.
- Không thêm CSS mới trừ khi cần khoảng cách nút trong `.feedback-actions` / `.reports-actions` / footer card Chẩn đoán.

## 5. Policy

- `src/app/privacy/page.tsx`
  - dòng 74 (báo cáo): bỏ "tự động xóa sau khoảng 180 ngày" → "chỉ dùng để xem xét xử lý vi phạm và được quản trị viên xoá khi không còn cần thiết".
  - dòng 75 (góp ý + ảnh): bỏ câu tự động 180 ngày.
  - dòng 219 "Thời gian lưu trữ báo cáo": bỏ 180 ngày + "hệ thống sẽ tự động xóa sạch".
  - dòng 222 "Gửi góp ý và báo lỗi": bỏ "lưu tối đa khoảng 180 ngày rồi tự động xóa (ảnh đính kèm bị xóa cùng)".
  - dòng 239 (nhật ký kỹ thuật): bỏ "tự động xóa sau khoảng 14 ngày".
  - cập nhật "Cập nhật lần cuối" → 15/11/2026.
- `src/app/terms/page.tsx` dòng 227: bỏ 180 ngày + "tự động xóa sạch".
- `src/app/account-deletion/page.tsx` dòng 142: bỏ "tối đa 14 ngày", giữ ý log hạ tầng không chứa nội dung.
- Giữ nguyên câu 30 ngày ở `privacy:295` và `account-deletion` mục 5–6.

## 6. Test & cổng

- Bỏ/sửa test khẳng định tự dọn: `feedback-api.test.ts` ("dọn góp ý quá 180 ngày", ca xoá ảnh), `reports-api.test.ts`, `study-worker-feedback.test.ts` (2 ca 180 ngày).
- Test mới:
  - feedback: DELETE theo id xoá dòng + object R2, 404 khi id lạ, purge chỉ chạm `resolved`/`dismissed`, audit được ghi.
  - reports: DELETE theo id, purge closed, audit.
  - errors/audit: DELETE xoá sạch, `audit.clear` còn đúng 1 dòng sau khi xoá.
  - panel happy-dom: nút Xóa gọi đúng method/URL, bulk ẩn khi không có mục đóng, bảng audit render dòng.
- Cổng: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build:admin`.

## 7. Deploy

- Admin Worker + shell + `dist-admin`: Workers Builds tự deploy khi push `main`; fallback `npm run build:admin` + `npx wrangler deploy --config wrangler.admin.jsonc`.
- **`workers/data-api/worker.js` và `workers/chat-proxy/worker.js` phải dán lại thủ công** trên dashboard (ghi chú vào `docs/deployment/DEPLOY.md`).
- Policy lên production theo lần build Pages kế tiếp.

## 8. Kiểm tay sau deploy

1. Góp ý → bấm "Xóa" → dòng biến mất, ảnh 404, R2 giảm 1 object, audit có `feedback.delete`.
2. "Xóa mục đã xử lý" chỉ xoá mục đã đóng; mục chờ còn nguyên.
3. Báo cáo: xoá từng dòng + bulk hoạt động như trên.
4. Chẩn đoán: nhật ký lỗi xoá được; bảng thao tác hiện dòng mới sau mỗi lần xoá; "Xóa toàn bộ" để lại 1 dòng `audit.clear`.
5. `/privacy` và `/terms` không còn cụm "tự động xóa" hay mốc 180/14 ngày.

## 9. Kết quả code (2026-11-15)

- Đã gỡ 6 điểm tự xoá (mục 2) — không còn `RETENTION_MS` nào trong repo.
- API như bảng mục 3, thêm `admin-worker/maintenance-api.ts` cho `/errors` + `/audit`; route trong `_worker.ts`; hạn mức `allowAuditWrite` 10 lần/phút.
- UI: `feedback.js`/`reports.js` có nút "Xóa" từng dòng + "Xóa mục đã xử lý" (disable khi 0 mục đóng); `dashboard.js` có "Xóa toàn bộ nhật ký" + card "Nhật ký thao tác quản trị"; CSS thêm `.btn-ghost.is-danger`, `.panel-actions`, `.reports-actions`, `.audit-target`.
- Test: thêm `maintenance-api.test.ts` (9 ca) và `dashboard-panel.test.ts` (4 ca: nhật ký thao tác, xoá nhật ký lỗi/audit, nút xoá disable khi lỗi đọc); sửa `feedback-api` (+5 ca xoá/purge), `reports-api` (+5 ca), `feedback-panel` (+5 ca), `reports-panel` (+4 ca); hai ca retention ở `study-worker-feedback` đảo thành "không tự dọn".
- Policy: privacy (74/75/219/222/239 + mốc 15/11/2026), terms (227 + mốc), account-deletion (142); giữ SLA 30 ngày. Comment `src/lib/feedback.ts` cập nhật theo.
- Còn lại: deploy data-api + chat-proxy (dán tay), deploy admin Worker, chạy checklist mục 8 trên production.
