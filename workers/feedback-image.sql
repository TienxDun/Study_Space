-- P3.16b — thêm cột ảnh đính kèm cho góp ý (D1 `zenspace`).
-- Chỉ chạy MỘT LẦN trên DB đã có bảng user_feedback:
--   npx wrangler d1 execute zenspace --remote --file=workers/feedback-image.sql
--   npx wrangler d1 execute zenspace --local --config wrangler.admin.jsonc --file=workers/feedback-image.sql
-- DB mới chỉ cần feedback-schema.sql (đã có sẵn cột image_key).
-- SQLite không có ADD COLUMN IF NOT EXISTS; chạy lần hai sẽ báo
-- "duplicate column name: image_key" — bỏ qua được, không mất dữ liệu.

ALTER TABLE user_feedback ADD COLUMN image_key TEXT;
