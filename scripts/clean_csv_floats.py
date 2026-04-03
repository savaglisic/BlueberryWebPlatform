#!/usr/bin/env python3
import csv, sys, re

filepath = sys.argv[1]
cols = set(sys.argv[2].split(","))
float_re = re.compile(r'^-?[0-9]*\.?[0-9]+$')

with open(filepath, newline='') as f:
    reader = csv.DictReader(f)
    writer = csv.DictWriter(sys.stdout, fieldnames=reader.fieldnames)
    writer.writeheader()
    for i, row in enumerate(reader, start=2):
        for col in cols:
            val = row.get(col, '')
            if val not in ('', 'NULL') and not float_re.match(val):
                print(f"  [dirty] row {i} col {col}: {val!r} -> NULL", file=sys.stderr)
                row[col] = 'NULL'
        writer.writerow(row)
