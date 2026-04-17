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
    year_prefix = request.args.get("year_prefix")
    date_filter_field = request.args.get("date_filter_field")
    date_filter_date = request.args.get("date_filter_date")

    query = PlantData.query

    if year_prefix:
        query = query.filter(PlantData.barcode.like(f"{year_prefix}%"))

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

    if date_filter_field and date_filter_date:
        try:
            day_start = datetime.strptime(date_filter_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            day_end = day_start.replace(hour=23, minute=59, second=59)
            col = PlantData.timestamp if date_filter_field == "timestamp" else PlantData.updated_at
            query = query.filter(col >= day_start, col <= day_end)
        except ValueError:
            pass

    from sqlalchemy import case, func
    sort_col = func.coalesce(PlantData.updated_at, PlantData.timestamp)
    query = query.order_by(sort_col.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "total": paginated.total,
        "page": paginated.page,
        "per_page": paginated.per_page,
        "pages": paginated.pages,
        "data": [r.to_dict() for r in paginated.items],
    })


@plant_data_bp.route("/fruit_firm", methods=["POST"])
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
    record.firm_category = data.get("firm_category", record.firm_category)
    record.size_category = data.get("size_category", record.size_category)
    record.fruitfirm_timestamp = datetime.now(ZoneInfo("America/New_York"))

    db.session.commit()
    return jsonify({"status": "ok", "record": record.to_dict()})


@plant_data_bp.route("/download_plant_data_csv", methods=["GET"])
def download_plant_data_csv():
    import json as _json
    year_prefix = request.args.get("year_prefix")
    filters_raw = request.args.get("filters")
    date_filter_field = request.args.get("date_filter_field")
    date_filter_date = request.args.get("date_filter_date")

    columns = [c.name for c in PlantData.__table__.columns]

    def generate():
        query = PlantData.query
        if year_prefix:
            query = query.filter(PlantData.barcode.like(f"{year_prefix}%"))
        if date_filter_field and date_filter_date:
            try:
                day_start = datetime.strptime(date_filter_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                day_end = day_start.replace(hour=23, minute=59, second=59)
                col = PlantData.timestamp if date_filter_field == "timestamp" else PlantData.updated_at
                query = query.filter(col >= day_start, col <= day_end)
            except ValueError:
                pass
        if filters_raw:
            filter_list = _json.loads(filters_raw)
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
        query = query.order_by(PlantData.id)

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        yield buf.getvalue()

        offset = 0
        chunk = 100
        while True:
            rows = query.offset(offset).limit(chunk).all()
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
