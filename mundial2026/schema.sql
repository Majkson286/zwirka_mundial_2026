-- Schema bazy danych Mundial 2026 (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mecze: terminarz ładowany z schedule.json, ale wyniki i status trzymamy w bazie
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY,           -- ten sam id co w schedule.json
  stage TEXT NOT NULL,
  group_name TEXT,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  kickoff TEXT NOT NULL,            -- ISO UTC
  venue TEXT,
  home_score INTEGER,              -- NULL = brak wyniku
  away_score INTEGER,
  finished INTEGER NOT NULL DEFAULT 0
);

-- Typy użytkowników: jeden rekord na (user, match)
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  pred_home INTEGER NOT NULL,
  pred_away INTEGER NOT NULL,
  points INTEGER,                  -- wyliczone po meczu, NULL dopóki niepoliczone
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, match_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(match_id) REFERENCES matches(id)
);

-- Sesje (tokeny logowania)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pred_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_pred_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_sess_user ON sessions(user_id);
