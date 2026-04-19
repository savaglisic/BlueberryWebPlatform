import json
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from models.audit import AuditLog
from models.plant import PlantData
from extensions import db
from sqlalchemy import func

overview_bp = Blueprint("overview", __name__)


def _build_query(start_str, end_str):
    q = db.session.query(AuditLog)
    if start_str:
        start = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
        q = q.filter(AuditLog.recorded_at >= start)
    if end_str:
        end = datetime.fromisoformat(end_str).replace(tzinfo=timezone.utc)
        q = q.filter(AuditLog.recorded_at < end)
    return q


@overview_bp.route("/overview/most_recent_date", methods=["GET"])
def most_recent_date():
    result = db.session.query(func.max(AuditLog.recorded_at)).scalar()
    return jsonify({"date": result.date().isoformat() if result else None})


@overview_bp.route("/overview/stats", methods=["GET"])
def overview_stats():
    entries = _build_query(request.args.get("start"), request.args.get("end")).all()

    created_barcodes = set()
    data_collected = 0
    ph_barcodes = set()
    fruitfirm_barcodes = set()

    for e in entries:
        fields = json.loads(e.fields_changed) if e.fields_changed else []
        if e.action == "barcode_created":
            created_barcodes.add(e.barcode)
        if e.action == "field_updated":
            data_collected += 1
            if "ph" in fields:
                ph_barcodes.add(e.barcode)
            if e.user_email == "FruitFirm":
                fruitfirm_barcodes.add(e.barcode)

    return jsonify({
        "barcodes_created": len(created_barcodes),
        "data_collected": data_collected,
        "ph_collected": len(ph_barcodes),
        "fruitfirm_collected": len(fruitfirm_barcodes),
    })


@overview_bp.route("/overview/projects", methods=["GET"])
def overview_projects():
    entries = _build_query(request.args.get("start"), request.args.get("end")).all()

    all_barcodes = {e.barcode for e in entries}

    barcode_to_project = {}
    if all_barcodes:
        rows = db.session.query(PlantData.barcode, PlantData.project).filter(
            PlantData.barcode.in_(all_barcodes)
        ).all()
        for r in rows:
            barcode_to_project[r.barcode] = r.project or "Unassigned"

    projects: dict[str, dict] = {}

    for e in entries:
        project = barcode_to_project.get(e.barcode, "Unassigned")
        if project not in projects:
            projects[project] = {
                "project": project,
                "created": set(),
                "ph": set(),
                "mass": set(),
                "brix": set(),
                "tta": set(),
                "fruitfirm": set(),
            }
        p = projects[project]
        fields = json.loads(e.fields_changed) if e.fields_changed else []
        if e.action == "barcode_created":
            p["created"].add(e.barcode)
        if e.action == "field_updated":
            if "ph" in fields:
                p["ph"].add(e.barcode)
            if "mass" in fields:
                p["mass"].add(e.barcode)
            if "brix" in fields:
                p["brix"].add(e.barcode)
            if "tta" in fields:
                p["tta"].add(e.barcode)
            if e.user_email == "FruitFirm":
                p["fruitfirm"].add(e.barcode)

    result = sorted(
        [
            {
                "project": p["project"],
                "barcodes_created": len(p["created"]),
                "ph": len(p["ph"]),
                "mass": len(p["mass"]),
                "brix": len(p["brix"]),
                "tta": len(p["tta"]),
                "fruitfirm": len(p["fruitfirm"]),
            }
            for p in projects.values()
        ],
        key=lambda x: x["project"] or "",
    )

    return jsonify(result)
