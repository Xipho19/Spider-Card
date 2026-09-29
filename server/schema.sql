CREATE TABLE IF NOT EXISTS scores (
  player TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('classic', 'endless')),
  mode INTEGER NOT NULL CHECK (mode IN (1, 2, 4)),
  time INTEGER NOT NULL DEFAULT 0 CHECK (time >= 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player, category, mode)
);

CREATE INDEX IF NOT EXISTS scores_category_mode_time ON scores (category, mode, time ASC, updated_at ASC);
CREATE INDEX IF NOT EXISTS scores_category_mode_streak ON scores (category, mode, streak DESC, updated_at ASC);
