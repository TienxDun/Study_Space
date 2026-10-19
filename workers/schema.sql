-- ZenStudy — Kho dữ liệu học tập trên Cloudflare D1 (gói Free).
-- Dùng CHUNG cho 2 Worker: `data-api` (kho dữ liệu) và `chat-proxy` (sổ đếm câu chat).
-- Cách tạo & gắn: xem docs/d1-backend.md.
-- Quy ước: mọi mốc thời gian lưu dạng số nguyên mili-giây (Date.now()).

-- Hồ sơ người dùng.
CREATE TABLE IF NOT EXISTS users (
  uid          TEXT PRIMARY KEY,
  display_name TEXT,
  photo_url    TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Cài đặt & dữ liệu nhỏ của từng người (mỗi key 1 giá trị JSON).
-- Chứa được: scene đang chọn, âm lượng, cài Pomodoro, danh sách yêu thích,
-- trạng thái tour, board kanban, ghi chú... (đều là JSON).
CREATE TABLE IF NOT EXISTS user_settings (
  uid        TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (uid, key)
);

-- Phiên tập trung Pomodoro (chỉ thêm, không sửa — đồng bộ lại nhiều lần vẫn an toàn).
CREATE TABLE IF NOT EXISTS focus_sessions (
  id              TEXT PRIMARY KEY,
  uid             TEXT NOT NULL,
  task_id         TEXT NOT NULL,
  task_title      TEXT,
  board_id        TEXT,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER NOT NULL,
  focus_seconds   INTEGER NOT NULL,
  planned_seconds INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_focus_uid_started ON focus_sessions (uid, started_at);

-- Sổ đếm số câu chat của từng người theo ngày (thay sổ KV cũ — KV chỉ 1.000 ghi/ngày).
CREATE TABLE IF NOT EXISTS chat_usage (
  uid   TEXT NOT NULL,
  day   TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, day)
);

-- Sổ đếm Workers AI toàn hệ thống theo ngày (thay KV `cf:rpd:*` và `cfn:rpd:*`).
CREATE TABLE IF NOT EXISTS cf_usage (
  day      TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  neurons  REAL NOT NULL DEFAULT 0
);

-- (Dùng ở Bước 4 — chỉ khi chuyển lịch sử chat từ Firestore sang D1.)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  uid        TEXT NOT NULL,
  title      TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_uid ON chat_sessions (uid, created_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           TEXT PRIMARY KEY,
  uid          TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  role         TEXT NOT NULL,
  text         TEXT NOT NULL,
  thought_secs INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (uid, session_id, created_at);
