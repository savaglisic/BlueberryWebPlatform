CREATE TABLE IF NOT EXISTS tissue_questions (
  id INTEGER PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  help_text TEXT,
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'textarea', 'number', 'date', 'boolean', 'genotype')),
  required INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  min_value REAL,
  max_value REAL,
  placeholder TEXT
);

CREATE TABLE IF NOT EXISTS tissue_records (
  id INTEGER PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  combined_name TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO tissue_questions
  (id, field_key, label, help_text, input_type, required, enabled, order_index, min_value, max_value, placeholder)
VALUES
  (1, 'explant_number', 'Explant Number', 'Enter the explant or mother-material number.', 'number', 1, 1, 1, 1, 99999, 'e.g. 54'),
  (2, 'shoot_number', 'Shoot Number', 'Enter the individual shoot number.', 'number', 1, 1, 2, 1, 999, 'e.g. 6'),
  (3, 'genotype', 'Genotype', 'Choose the same genotype used by the Fruit Quality team.', 'genotype', 1, 1, 3, NULL, NULL, 'Search genotypes'),
  (4, 'initiation_date', 'Initiation Date', 'Date the original tissue material entered culture.', 'date', 0, 1, 4, NULL, NULL, NULL),
  (5, 'tissue_culture_batch', 'Tissue Culture Batch', 'Batch number assigned by the tissue culture lab.', 'number', 0, 1, 5, 1, 99999, 'e.g. 24'),
  (6, 'vector_number', 'Vector Number', 'Numeric vector identifier; the V is added automatically.', 'number', 1, 1, 6, 1, 999999, 'e.g. 123'),
  (7, 'transformation_date', 'Transformation Date', 'Date transformation was performed.', 'date', 0, 1, 7, NULL, NULL, NULL),
  (8, 'transformation_method', 'Transformation Method', 'Method used to introduce the target construct.', 'text', 0, 1, 8, NULL, NULL, 'e.g. Agrobacterium'),
  (9, 'target_genes', 'Target Gene(s)', 'Enter one or more target genes.', 'text', 0, 1, 9, NULL, NULL, 'e.g. GeneA, GeneB'),
  (10, 'selection_information', 'Selection Information', 'Was selection applied to this plant?', 'boolean', 0, 1, 10, NULL, NULL, NULL),
  (11, 'shoot_transfer_date', 'Shoot Transfer Date', 'Date the shoot was transferred.', 'date', 0, 1, 11, NULL, NULL, NULL),
  (12, 'dna_extraction_date', 'DNA Extraction', 'Date DNA extraction was completed.', 'date', 0, 1, 12, NULL, NULL, NULL),
  (13, 'pcr_date', 'PCR', 'Date PCR was completed.', 'date', 0, 1, 13, NULL, NULL, NULL),
  (14, 'hrm_date', 'HRM', 'Date high-resolution melting analysis was completed.', 'date', 0, 1, 14, NULL, NULL, NULL),
  (15, 'note', 'Note', 'Add any experimental details that are not captured above.', 'textarea', 0, 1, 15, NULL, NULL, 'Optional notes');

CREATE INDEX IF NOT EXISTS ix_tissue_records_updated_at ON tissue_records(updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_tissue_questions_order ON tissue_questions(order_index);
