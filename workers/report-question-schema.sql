-- P0.5 bổ sung: lưu câu hỏi của người dùng cạnh câu trả lời AI bị báo cáo.
-- Chạy một lần trên D1 `zenspace` (bảng content_reports đã tồn tại):
--   npx wrangler d1 execute zenspace --remote --file workers/report-question-schema.sql
ALTER TABLE content_reports ADD COLUMN question TEXT;
