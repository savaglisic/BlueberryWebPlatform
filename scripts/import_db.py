#!/usr/bin/env python3
"""Import database CSVs into the running postgres container."""

import io
import re
import subprocess
import sys
from pathlib import Path

import pandas as pd

DUMP_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("databasedump")
DB = "blueweb"
USER = "postgres"

FLOAT_COLS = {
    "plant_data": ["mass", "x_berry_mass", "ph", "brix", "juicemass", "tta",
                   "mladded", "avg_firmness", "avg_diameter", "sd_firmness", "sd_diameter"],
}

TABLES = [
    ("genotypes",       "genotypes"),
    ("user",            "users"),
    ("api_keys",        "api_keys"),
    ("email_whitelist", "email_whitelist"),
    ("option_config",   "option_configs"),
    ("plant_data",      "plant_data"),
    ("fruit_quality",   "historical_fruit_quality"),
    ("ranks",           "historical_ranks"),
    ("scores",          "historical_scores"),
    ("yield",           "historical_yield"),
]


def find_container():
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        capture_output=True, text=True, check=True
    )
    for name in result.stdout.splitlines():
        if re.search(r'blue', name, re.IGNORECASE) and name.endswith("db-1"):
            return name
    sys.exit("Error: could not find a running container matching blue.*db-1")


def psql(container, sql):
    subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-U", USER, "-d", DB, "-c", sql],
        check=True
    )


def import_table(container, csv_file: Path, table: str):
    df = pd.read_csv(csv_file, dtype=str, keep_default_na=False)

    for col in FLOAT_COLS.get(table, []):
        if col not in df.columns:
            continue
        mask = df[col].apply(
            lambda v: v not in ("", "NULL") and not re.match(r'^-?[0-9]*\.?[0-9]+$', v)
        )
        if mask.any():
            for idx in df[mask].index:
                print(f"  [dirty] row {idx + 2} col {col}: {df.at[idx, col]!r} -> NULL")
            df.loc[mask, col] = "NULL"

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    cols = ", ".join(f'"{c}"' for c in df.columns)
    proc = subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-U", USER, "-d", DB,
         "-c", f"\\COPY {table} ({cols}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL 'NULL')"],
        input=buf.read(), text=True, capture_output=True
    )
    if proc.returncode != 0:
        print(f"  ERROR: {proc.stderr.strip()}")
        sys.exit(1)
    print(f"  {proc.stdout.strip()}")


def main():
    container = find_container()
    print(f"Using container: {container}")
    print(f"Importing CSVs from: {DUMP_DIR}")

    print("Truncating tables...")
    psql(container,
         f"TRUNCATE {', '.join(t for _, t in TABLES)} RESTART IDENTITY CASCADE;")

    for csv_name, table in TABLES:
        csv_file = DUMP_DIR / f"{csv_name}.csv"
        if not csv_file.exists():
            print(f"  [skip] {csv_file} not found")
            continue
        print(f"  -> {table}")
        import_table(container, csv_file, table)

    print("Syncing sequences...")
    psql(container, """
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE'
  LOOP
    BEGIN
      EXECUTE format(
        'SELECT setval(pg_get_serial_sequence(%L, ''id''), COALESCE((SELECT MAX(id) FROM %I), 1))',
        r.table_name, r.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
""")
    print("Done.")


if __name__ == "__main__":
    main()
