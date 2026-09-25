CREATE TABLE IF NOT EXISTS temporary_trip_drafts (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  payload JSON NOT NULL,
  action ENUM('plan','save','board') NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX draft_expiry (expires_at)
);
