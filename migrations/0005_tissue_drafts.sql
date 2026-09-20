ALTER TABLE tissue_records ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'
  CHECK (status IN ('incomplete', 'complete'));

ALTER TABLE tissue_records ADD COLUMN current_step INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ix_tissue_records_status_updated ON tissue_records(status, updated_at DESC);
