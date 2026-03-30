import csv
import io
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import Blueprint, request, jsonify, Response, stream_with_context
from extensions import db
from models import PlantData
from middleware.api_key import require_api_key

plant_data_bp = Blueprint("plant_data", __name__)

PLANT_FIELDS = [
    "genotype", "stage", "site", "block", "project", "post_harvest",
    "bush_plant_number", "notes", "mass", "x_berry_mass", "number_of_berries",
    "ph", "brix", "juicemass", "tta", "mladded",
    "avg_firmness", "avg_diameter", "sd_firmness", "sd_diameter", "box",
]


@plant_data_bp.route("/add_plant_data", methods=["POST"])
def add_plant_data():
    data = request.get_json()
    barcode = data.get("barcode")
    if not barcode:
        return jsonify({"error": "Barcode required"}), 400

    record = PlantData.query.filter_by(barcode=barcode).first()
    if record:
        for field in PLANT_FIELDS:
            if field in data:
                setattr(record, field, data[field])
    else:
        record = PlantData(barcode=barcode)
        for field in PLANT_FIELDS:
            if field in data:
                setattr(record, field, data[field])
        db.session.add(record)

    db.session.commit()
    return jsonify({"status": "ok", "record": record.to_dict()})


@plant_data_bp.route("/check_barcode", methods=["POST"])
def check_barcode():
    barcode = request.get_json().get("barcode")
    record = PlantData.query.filter_by(barcode=barcode).first()
    if not record:
        return jsonify({"error": "Not found"}), 404
    return jsonify(record.to_dict())


@plant_data_bp.route("/delete_plant_data", methods=["DELETE"])
def delete_plant_data():
    barcode = request.get_json().get("barcode")
    record = PlantData.query.filter_by(barcode=barcode).first_or_404()
    db.session.delete(record)
    db.session.commit()
    return jsonify({"status": "ok"})


@plant_data_bp.route("/get_plant_data", methods=["GET"])
def get_plant_data():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    filters = request.args.get("filters")

    query = PlantData.query

    if filters:
        import json
        filter_list = json.loads(filters)
        include_clauses = []
        for f in filter_list:
            field = f.get("field")
            operator = f.get("operator")
            value = f.get("value", "")
            col = getattr(PlantData, field, None)
            if col is None:
                continue
            if operator == "includes":
                include_clauses.append(col.ilike(f"%{value}%"))
            elif operator == "excludes":
                query = query.filter(~col.ilike(f"%{value}%"))
        if include_clauses:
            from sqlalchemy import or_
            query = query.filter(or_(*include_clauses))

    query = query.order_by(PlantData.timestamp.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "total": paginated.total,
        "page": paginated.page,
        "per_page": paginated.per_page,
        "pages": paginated.pages,
        "data": [r.to_dict() for r in paginated.items],
    })


@plant_data_bp.route("/fruit_firm", methods=["POST"])
@require_api_key
def fruit_firm():
    data = request.get_json()
    barcode = data.get("barcode")
    if not barcode:
        return jsonify({"error": "Barcode required"}), 400

    record = PlantData.query.filter_by(barcode=barcode).first()
    if not record:
        record = PlantData(barcode=barcode)
        db.session.add(record)

    record.avg_firmness = data.get("avg_firmness", record.avg_firmness)
    record.avg_diameter = data.get("avg_diameter", record.avg_diameter)
    record.sd_firmness = data.get("sd_firmness", record.sd_firmness)
    record.sd_diameter = data.get("sd_diameter", record.sd_diameter)
    record.fruitfirm_timestamp = datetime.now(ZoneInfo("America/New_York"))

    db.session.commit()
    return jsonify({"status": "ok", "record": record.to_dict()})


@plant_data_bp.route("/download_plant_data_csv", methods=["GET"])
def download_plant_data_csv():
    columns = [c.name for c in PlantData.__table__.columns]

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        yield buf.getvalue()

        offset = 0
        chunk = 100
        while True:
            rows = PlantData.query.order_by(PlantData.id).offset(offset).limit(chunk).all()
            if not rows:
                break
            for row in rows:
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow([getattr(row, c) for c in columns])
                yield buf.getvalue()
            offset += chunk

    return Response(
        stream_with_context(generate()),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=plant_data.csv"},
    )
