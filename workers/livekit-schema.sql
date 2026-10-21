-- Schema D1 cho phòng học nhóm LiveKit trên gói Build (0đ)
-- Dùng chung hoặc tách riêng với data-api database

CREATE TABLE IF NOT EXISTS meet_events (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meet_sessions (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  identity TEXT NOT NULL,
  display_name TEXT,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  duration_seconds INTEGER,
  billing_month TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meet_sessions_month ON meet_sessions(billing_month);

CREATE TABLE IF NOT EXISTS meet_usage_month (
  month TEXT PRIMARY KEY,
  participant_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Trigger tự động cộng dồn participant_seconds vào meet_usage_month khi một phiên học kết thúc (left_at được cập nhật)
CREATE TRIGGER IF NOT EXISTS trg_meet_sessions_close
AFTER UPDATE OF left_at, duration_seconds ON meet_sessions
WHEN NEW.left_at IS NOT NULL AND OLD.left_at IS NULL AND NEW.duration_seconds > 0
BEGIN
  INSERT INTO meet_usage_month (month, participant_seconds, updated_at)
  VALUES (NEW.billing_month, NEW.duration_seconds, NEW.left_at)
  ON CONFLICT(month) DO UPDATE SET
    participant_seconds = participant_seconds + excluded.participant_seconds,
    updated_at = excluded.updated_at;
END;

CREATE TABLE IF NOT EXISTS meet_rooms (
  name TEXT PRIMARY KEY,
  host_uid TEXT NOT NULL,
  host_identity TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
