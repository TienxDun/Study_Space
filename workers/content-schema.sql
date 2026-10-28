-- P2c — bảng nội dung runtime, dán vào D1 `zenspace` đang chạy.
-- Chạy: npx wrangler d1 execute zenspace --remote --file=workers/content-schema.sql
-- Không có DROP: chỉ thêm bảng mới, không đụng 5 bảng cũ.

CREATE TABLE IF NOT EXISTS content_manifest (
  version    INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  json       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY (version, kind)
);
CREATE INDEX IF NOT EXISTS idx_content_manifest_created ON content_manifest (created_at DESC);
