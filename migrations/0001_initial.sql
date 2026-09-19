PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  user_group TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_whitelist (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS genotypes (
  id INTEGER PRIMARY KEY,
  genotype TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS plant_data (
  id INTEGER PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  genotype TEXT,
  stage TEXT,
  site TEXT,
  block TEXT,
  project TEXT,
  post_harvest TEXT,
  bush_plant_number TEXT,
  mass REAL,
  number_of_berries INTEGER,
  x_berry_mass REAL,
  box INTEGER,
  ph REAL,
  brix REAL,
  juicemass REAL,
  tta REAL,
  mladded REAL,
  avg_firmness REAL,
  avg_diameter REAL,
  sd_firmness REAL,
  sd_diameter REAL,
  firm_category REAL,
  size_category REAL,
  notes TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  fruitfirm_timestamp TEXT,
  updated_at TEXT,
  week INTEGER
);

CREATE TABLE IF NOT EXISTS historical_ranks (
  id INTEGER PRIMARY KEY,
  genotype TEXT NOT NULL,
  location TEXT,
  season TEXT,
  "Flavor_Mean_plus" REAL,
  "Selection_Index_2022" REAL,
  "Yield_Greens_plus" REAL,
  avg_firm_plus REAL,
  brix_plus REAL,
  ph_plus REAL,
  weight_plus REAL,
  ranking_SI22 REAL,
  rkn_Flavor_Mean_plus REAL,
  rkn_Yield_Greens_plus REAL,
  rkn_avg_firm_plus REAL,
  rkn_brix_plus REAL,
  rkn_ph_plus REAL,
  rkn_weight_plus REAL
);

CREATE TABLE IF NOT EXISTS historical_yield (
  id INTEGER PRIMARY KEY,
  genotype TEXT NOT NULL,
  location TEXT,
  season TEXT,
  cumulative REAL
);

CREATE TABLE IF NOT EXISTS historical_scores (
  id INTEGER PRIMARY KEY,
  genotype TEXT NOT NULL,
  location TEXT,
  season TEXT,
  flavor_mean REAL
);

CREATE TABLE IF NOT EXISTS historical_fruit_quality (
  id INTEGER PRIMARY KEY,
  genotype TEXT NOT NULL,
  location TEXT,
  season TEXT,
  avg_firm REAL,
  avg_size REAL,
  brix REAL,
  ph REAL,
  tta REAL,
  weight REAL
);

CREATE TABLE IF NOT EXISTS option_configs (
  id INTEGER PRIMARY KEY,
  option_type TEXT NOT NULL,
  option_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS sensory_questions (
  id INTEGER PRIMARY KEY,
  order_index INTEGER NOT NULL DEFAULT 0,
  question_type TEXT NOT NULL,
  attribute TEXT,
  wording TEXT,
  options_json TEXT,
  capture_video INTEGER NOT NULL DEFAULT 0,
  demographic_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sensory_setup (
  id INTEGER PRIMARY KEY,
  samples_per_panelist INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS sensory_samples (
  id INTEGER PRIMARY KEY,
  setup_id INTEGER NOT NULL DEFAULT 1 REFERENCES sensory_setup(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  sample_number TEXT NOT NULL,
  real_identifier TEXT
);

CREATE TABLE IF NOT EXISTS sensory_results (
  id INTEGER PRIMARY KEY,
  session_date TEXT,
  panelist_id TEXT NOT NULL,
  sample_number TEXT,
  question_id INTEGER,
  question_type TEXT,
  attribute TEXT,
  wording TEXT,
  response TEXT,
  numeric_response REAL,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS panelists (
  id INTEGER PRIMARY KEY,
  panelist_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  demographics_complete INTEGER NOT NULL DEFAULT 0,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(panelist_id, session_date)
);

CREATE TABLE IF NOT EXISTS sensory_question_sets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  barcode TEXT NOT NULL,
  action TEXT NOT NULL,
  fields_changed TEXT,
  user_email TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensory_videos (
  id INTEGER PRIMARY KEY,
  session_date TEXT NOT NULL,
  panelist_id TEXT NOT NULL,
  sample_number TEXT NOT NULL,
  question_id INTEGER,
  attribute TEXT,
  object_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS plant_data_set_updated_at
AFTER UPDATE ON plant_data
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE plant_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
