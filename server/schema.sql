CREATE TABLE IF NOT EXISTS scores (
  player TEXT NOT NULL,
  mode INTEGER NOT NULL CHECK (mode IN (1, 2, 4)),
  time INTEGER NOT NULL CHECK (time >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player, mode)
);

CREATE INDEX IF NOT EXISTS scores_mode_time ON scores (mode, time ASC, updated_at ASC);
