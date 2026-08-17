CREATE TABLE IF NOT EXISTS hosted_itinerary_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_session_id INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  time_period TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  place_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  estimated_cost REAL NOT NULL DEFAULT 0,
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  transit_mode TEXT,
  transit_minutes INTEGER,
  transit_distance_km REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_session_id) REFERENCES hosted_trip_sessions(id) ON DELETE CASCADE,
  UNIQUE (trip_session_id, day_number, sequence_number)
);

CREATE TABLE IF NOT EXISTS hosted_visa_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_country_code TEXT NOT NULL,
  destination_country_code TEXT NOT NULL,
  status TEXT NOT NULL,
  allowed_days INTEGER,
  summary TEXT NOT NULL,
  official_portal_url TEXT,
  source_note TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (origin_country_code, destination_country_code)
);

CREATE TABLE IF NOT EXISTS hosted_trip_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_session_id INTEGER NOT NULL,
  paid_by TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_session_id) REFERENCES hosted_trip_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hosted_expense_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  participant_name TEXT NOT NULL,
  share_amount REAL NOT NULL,
  is_settled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES hosted_trip_expenses(id) ON DELETE CASCADE,
  UNIQUE (expense_id, participant_name)
);

CREATE INDEX IF NOT EXISTS idx_hosted_itinerary_trip
ON hosted_itinerary_activities(trip_session_id, day_number, sequence_number);

CREATE INDEX IF NOT EXISTS idx_hosted_expenses_trip
ON hosted_trip_expenses(trip_session_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_hosted_expense_splits
ON hosted_expense_splits(expense_id, participant_name);

INSERT OR IGNORE INTO hosted_visa_rules
  (origin_country_code, destination_country_code, status, allowed_days, summary, official_portal_url, source_note)
VALUES
  ('MM', 'TH', 'visa_free', 14, 'Short visits may qualify for visa-free access subject to passport and entry conditions.', 'https://www.thaievisa.go.th/', 'Confirm current eligibility with the official destination authority.'),
  ('TH', 'JP', 'visa_free', 15, 'Short tourism visits may qualify for visa-free entry subject to current conditions.', 'https://www.mofa.go.jp/j_info/visit/visa/', 'Confirm current eligibility with the official destination authority.'),
  ('MM', 'JP', 'evisa_or_arrival', NULL, 'An advance visa or electronic application may be required before departure.', 'https://www.mofa.go.jp/j_info/visit/visa/', 'Use the official destination authority before purchasing travel.'),
  ('TH', 'SG', 'visa_free', 30, 'Short tourism visits commonly qualify for visa-free access subject to entry approval.', 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore', 'Confirm current eligibility with the official destination authority.');

PRAGMA optimize;
