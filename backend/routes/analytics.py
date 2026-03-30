from flask import Blueprint, request, jsonify, Response
from sqlalchemy import func, text
from extensions import db
from models import PlantData

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/download_yield", methods=["GET"])
def download_yield():
    import pandas as pd
    import io

    rows = (
        db.session.query(
            PlantData.genotype,
            PlantData.site,
            PlantData.week,
            func.avg(PlantData.mass).label("avg_mass"),
        )
        .filter(
            PlantData.genotype.isnot(None),
            PlantData.genotype != "",
            PlantData.week != 100,
        )
        .group_by(PlantData.genotype, PlantData.site, PlantData.week)
        .all()
    )

    if not rows:
        return Response("No data", mimetype="text/csv")

    df = pd.DataFrame(rows, columns=["genotype", "site", "week", "avg_mass"])
    pivot = df.pivot_table(
        index=["genotype", "site"], columns="week", values="avg_mass", aggfunc="mean"
    )
    pivot.columns = [f"Week_{int(w)}" for w in pivot.columns]
    pivot["TotalMass"] = pivot.sum(axis=1)
    pivot = pivot.sort_values("TotalMass", ascending=False).reset_index()

    return Response(
        pivot.to_csv(index=False),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=yield.csv"},
    )


@analytics_bp.route("/pivot_fruit_quality", methods=["GET"])
def pivot_fruit_quality():
    import pandas as pd

    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("pageSize", 10, type=int)
    search = request.args.get("search", "")

    query = db.session.query(
        PlantData.genotype,
        PlantData.site,
        PlantData.week,
        func.avg(PlantData.mass).label("avg_mass"),
    ).filter(
        PlantData.genotype.isnot(None),
        PlantData.genotype != "",
        PlantData.week != 100,
    )

    if search:
        query = query.filter(PlantData.genotype.ilike(f"%{search}%"))

    rows = query.group_by(PlantData.genotype, PlantData.site, PlantData.week).all()

    if not rows:
        return jsonify({"data": [], "total": 0})

    df = pd.DataFrame(rows, columns=["genotype", "site", "week", "avg_mass"])
    pivot = df.pivot_table(
        index=["genotype", "site"], columns="week", values="avg_mass", aggfunc="mean"
    )
    pivot.columns = [f"Week_{int(w)}" for w in pivot.columns]
    pivot["TotalMass"] = pivot.sum(axis=1)
    pivot = pivot.sort_values("TotalMass", ascending=False).reset_index()

    total = len(pivot)
    start = (page - 1) * page_size
    page_df = pivot.iloc[start : start + page_size]

    return jsonify({"data": page_df.to_dict(orient="records"), "total": total})
