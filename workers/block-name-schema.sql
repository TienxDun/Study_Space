-- P0.5 bổ sung: lưu tên hiển thị của người bị chặn để Cài đặt hiện tên thay vì UID.
-- Chạy một lần trên D1 `zenspace` (bảng user_blocks đã tồn tại):
--   npx wrangler d1 execute zenspace --remote --file workers/block-name-schema.sql
ALTER TABLE user_blocks ADD COLUMN blocked_name TEXT;
