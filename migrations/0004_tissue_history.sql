CREATE TABLE IF NOT EXISTS tissue_history (
  id INTEGER PRIMARY KEY,
  barcode TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_fields TEXT NOT NULL DEFAULT '[]',
  answers_json TEXT NOT NULL DEFAULT '{}',
  combined_name TEXT,
  user_email TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_tissue_history_barcode_date ON tissue_history(barcode, recorded_at DESC);
