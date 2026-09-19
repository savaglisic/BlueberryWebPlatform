-- D1 Free meters every index entry created and maintained as an additional row
-- written. Keep immutable historical imports unindexed while optimizing the
-- continuously polled plant view and all current/future operational data.
CREATE INDEX IF NOT EXISTS ix_plant_data_activity_sort
  ON plant_data(coalesce(updated_at, timestamp) DESC);

CREATE INDEX IF NOT EXISTS ix_audit_log_active_recorded_at
  ON audit_log(recorded_at)
  WHERE recorded_at >= '2026-09-01';

CREATE INDEX IF NOT EXISTS ix_sensory_results_active_date_pair
  ON sensory_results(session_date, panelist_id, sample_number)
  WHERE session_date >= '2026-09-01';
