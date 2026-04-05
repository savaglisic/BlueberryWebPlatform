import io
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, Response, make_response
from sqlalchemy import func, desc, case, Integer

from extensions import db
from models import PlantData

analytics_bp = Blueprint("analytics", __name__)


def _current_year():
    return datetime.now(timezone.utc).year


def _build_week_aggregates(pivot_weeks):
    return [
        func.avg(
            case(
                (PlantData.week == week, PlantData.mass.cast(Integer)),
                else_=None,
            )
        ).label(f"Week{week}")
        for week in pivot_weeks
    ]


def _year_filter():
    return func.extract("year", PlantData.timestamp) == _current_year()


@analytics_bp.route("/download_yield", methods=["GET"])
def download_yield():
    import pandas as pd

    year_filter = _year_filter()

    weeks = [
        w
        for (w,) in db.session.query(PlantData.week)
        .filter(year_filter, PlantData.week != 100)
        .distinct()
        .order_by(PlantData.week)
        .all()
    ]

    if not weeks:
        return Response("No data", mimetype="text/csv")

    week_aggregates = _build_week_aggregates(weeks)
    total_mass = func.avg(PlantData.mass.cast(Integer)).label("TotalMass")

    rows = (
        db.session.query(
            PlantData.genotype,
            PlantData.site,
            *week_aggregates,
            total_mass,
        )
        .filter(
            year_filter,
            PlantData.genotype.isnot(None),
            PlantData.genotype != "",
        )
        .group_by(PlantData.genotype, PlantData.site)
        .order_by(desc("TotalMass").nulls_last())
        .all()
    )

    if not rows:
        return Response("No data", mimetype="text/csv")

    columns = ["genotype", "site"] + [f"Week{w}" for w in weeks] + ["TotalMass"]
    df = pd.DataFrame(rows, columns=columns)

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    resp = make_response(buf.getvalue())
    resp.headers["Content-Disposition"] = "attachment; filename=yield.csv"
    resp.headers["Content-Type"] = "text/csv"
    return resp


@analytics_bp.route("/pivot_fruit_quality", methods=["GET"])
def pivot_fruit_quality():
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("pageSize", 10, type=int)
    search = request.args.get("search", "").strip()

    year_filter = _year_filter()

    weeks = [
        w
        for (w,) in db.session.query(PlantData.week)
        .filter(year_filter, PlantData.week != 100)
        .distinct()
        .order_by(PlantData.week)
        .all()
    ]

    if not weeks:
        return jsonify({"data": [], "total": 0})

    week_aggregates = _build_week_aggregates(weeks)
    total_mass = func.avg(PlantData.mass.cast(Integer)).label("TotalMass")

    base_filter = [
        year_filter,
        PlantData.genotype.isnot(None),
        PlantData.genotype != "",
    ]
    if search:
        base_filter.append(PlantData.genotype.ilike(f"%{search}%"))

    # Count distinct (genotype, site) for pagination
    count_q = (
        db.session.query(PlantData.genotype, PlantData.site)
        .filter(*base_filter)
        .distinct()
    )
    total_rows = db.session.query(func.count()).select_from(count_q.subquery()).scalar()

    results = (
        db.session.query(
            PlantData.genotype,
            PlantData.site,
            *week_aggregates,
            total_mass,
        )
        .filter(*base_filter)
        .group_by(PlantData.genotype, PlantData.site)
        .order_by(desc("TotalMass").nulls_last())
        .limit(page_size)
        .offset((page - 1) * page_size)
        .all()
    )

    columns = ["genotype", "site"] + [f"Week{w}" for w in weeks] + ["TotalMass"]
    str_cols = {"genotype", "site"}
    data = [
        {col: (round(float(val), 2) if val is not None else None) if col not in str_cols else val
         for col, val in zip(columns, row)}
        for row in results
    ]

    return jsonify({"data": data, "total": total_rows, "columns": columns})
