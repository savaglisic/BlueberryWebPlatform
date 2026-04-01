"""
One-shot data import from CSV exports.
Usage: python import_data.py /path/to/database_exports/
"""
import csv
import sys
import os
from datetime import datetime
from app import create_app
from extensions import db
from models import (
    HistoricalRank, HistoricalYield, HistoricalScore, HistoricalFruitQuality,
    PlantData, Genotype, OptionConfig, APIKey, EmailWhitelist, User,
)

NULL_VALS = {"NULL", "null", "", None}

def coerce_float(v):
    if v in NULL_VALS: return None
    try: return float(v)
    except: return None

def coerce_int(v):
    if v in NULL_VALS: return None
    try: return int(float(v))
    except: return None

def coerce_dt(v):
    if v in NULL_VALS: return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try: return datetime.strptime(v, fmt)
        except: continue
    return None

def read_csv(path):
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

def run(export_dir):
    app = create_app()
    with app.app_context():

        # ── historical_ranks ──────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'ranks.csv'))
        db.session.query(HistoricalRank).delete()
        for r in rows:
            db.session.add(HistoricalRank(
                id=int(r['id']),
                genotype=r['genotype'],
                location=r.get('location') or None,
                season=r.get('season') or None,
                Flavor_Mean_plus=coerce_float(r.get('Flavor_Mean_plus')),
                Selection_Index_2022=coerce_float(r.get('Selection_Index_2022')),
                Yield_Greens_plus=coerce_float(r.get('Yield_Greens_plus')),
                avg_firm_plus=coerce_float(r.get('avg_firm_plus')),
                brix_plus=coerce_float(r.get('brix_plus')),
                ph_plus=coerce_float(r.get('ph_plus')),
                weight_plus=coerce_float(r.get('weight_plus')),
                ranking_SI22=coerce_float(r.get('ranking_SI22')),
                rkn_Flavor_Mean_plus=coerce_float(r.get('rkn_Flavor_Mean_plus')),
                rkn_Yield_Greens_plus=coerce_float(r.get('rkn_Yield_Greens_plus')),
                rkn_avg_firm_plus=coerce_float(r.get('rkn_avg_firm_plus')),
                rkn_brix_plus=coerce_float(r.get('rkn_brix_plus')),
                rkn_ph_plus=coerce_float(r.get('rkn_ph_plus')),
                rkn_weight_plus=coerce_float(r.get('rkn_weight_plus')),
            ))
        db.session.commit()
        print(f"historical_ranks: {len(rows)} rows")

        # ── historical_yield ──────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'yield.csv'))
        db.session.query(HistoricalYield).delete()
        for r in rows:
            db.session.add(HistoricalYield(
                id=int(r['id']),
                genotype=r['genotype'],
                location=r.get('location') or None,
                season=r.get('season') or None,
                cumulative=coerce_float(r.get('cumulative')),
            ))
        db.session.commit()
        print(f"historical_yield: {len(rows)} rows")

        # ── historical_scores ─────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'scores.csv'))
        db.session.query(HistoricalScore).delete()
        for r in rows:
            db.session.add(HistoricalScore(
                id=int(r['id']),
                genotype=r['genotype'],
                location=r.get('location') or None,
                season=r.get('season') or None,
                flavor_mean=coerce_float(r.get('flavor_mean')),
            ))
        db.session.commit()
        print(f"historical_scores: {len(rows)} rows")

        # ── historical_fruit_quality ──────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'fruit_quality.csv'))
        db.session.query(HistoricalFruitQuality).delete()
        for r in rows:
            db.session.add(HistoricalFruitQuality(
                id=int(r['id']),
                genotype=r['genotype'],
                location=r.get('location') or None,
                season=r.get('season') or None,
                avg_firm=coerce_float(r.get('avg_firm')),
                avg_size=coerce_float(r.get('avg_size')),
                brix=coerce_float(r.get('brix')),
                ph=coerce_float(r.get('ph')),
                tta=coerce_float(r.get('tta')),
                weight=coerce_float(r.get('weight')),
            ))
        db.session.commit()
        print(f"historical_fruit_quality: {len(rows)} rows")

        # ── plant_data ────────────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'plant_data.csv'))
        db.session.query(PlantData).delete()
        for r in rows:
            db.session.add(PlantData(
                id=int(r['id']),
                barcode=r['barcode'],
                genotype=r.get('genotype') or None,
                stage=r.get('stage') or None,
                site=r.get('site') or None,
                block=r.get('block') or None,
                project=r.get('project') or None,
                post_harvest=r.get('post_harvest') or None,
                bush_plant_number=None if r.get('bush_plant_number') in NULL_VALS else r.get('bush_plant_number'),
                notes=None if r.get('notes') in NULL_VALS else r.get('notes'),
                mass=coerce_float(r.get('mass')),
                x_berry_mass=coerce_float(r.get('x_berry_mass')),
                number_of_berries=coerce_int(r.get('number_of_berries')),
                box=coerce_int(r.get('box')),
                ph=coerce_float(r.get('ph')),
                brix=coerce_float(r.get('brix')),
                juicemass=coerce_float(r.get('juicemass')),
                tta=coerce_float(r.get('tta')),
                mladded=coerce_float(r.get('mladded')),
                avg_firmness=coerce_float(r.get('avg_firmness')),
                avg_diameter=coerce_float(r.get('avg_diameter')),
                sd_firmness=coerce_float(r.get('sd_firmness')),
                sd_diameter=coerce_float(r.get('sd_diameter')),
                timestamp=coerce_dt(r.get('timestamp')),
                week=coerce_int(r.get('week')),
                fruitfirm_timestamp=coerce_dt(r.get('fruitfirm_timestamp')),
            ))
        db.session.commit()
        print(f"plant_data: {len(rows)} rows")

        # ── genotypes ─────────────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'genotypes.csv'))
        db.session.query(Genotype).delete()
        for r in rows:
            db.session.add(Genotype(id=int(r['id']), genotype=r['genotype']))
        db.session.commit()
        print(f"genotypes: {len(rows)} rows")

        # ── option_configs ────────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'option_config.csv'))
        db.session.query(OptionConfig).delete()
        for r in rows:
            db.session.add(OptionConfig(
                id=int(r['id']),
                option_type=r['option_type'],
                option_text=r['option_text'],
            ))
        db.session.commit()
        print(f"option_configs: {len(rows)} rows")

        # ── api_keys ──────────────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'api_keys.csv'))
        db.session.query(APIKey).delete()
        for r in rows:
            db.session.add(APIKey(
                id=int(r['id']),
                key=r['key'],
                description=r.get('description') or None,
            ))
        db.session.commit()
        print(f"api_keys: {len(rows)} rows")

        # ── email_whitelist ───────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'email_whitelist.csv'))
        db.session.query(EmailWhitelist).delete()
        for r in rows:
            db.session.add(EmailWhitelist(id=int(r['id']), email=r['email']))
        db.session.commit()
        print(f"email_whitelist: {len(rows)} rows")

        # ── users ─────────────────────────────────────────────────────────
        rows = read_csv(os.path.join(export_dir, 'user.csv'))
        db.session.query(User).delete()
        for r in rows:
            db.session.add(User(
                id=int(r['id']),
                user_name=r['user_name'],
                email=r['email'],
                password=r['password'],
                user_group=r['user_group'],
            ))
        db.session.commit()
        print(f"users: {len(rows)} rows")

        print("\nImport complete.")

if __name__ == "__main__":
    export_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/exports"
    run(export_dir)
