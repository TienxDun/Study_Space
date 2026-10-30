-- P0.5 bổ sung: lưu tên người báo cáo / người bị báo cáo để admin đọc thay vì UID.
-- Chạy một lần trên D1 `zenspace` (bảng content_reports đã tồn tại):
--   npx wrangler d1 execute zenspace --remote --file workers/report-names-schema.sql
ALTER TABLE content_reports ADD COLUMN reporter_name TEXT;
ALTER TABLE content_reports ADD COLUMN target_name TEXT;
