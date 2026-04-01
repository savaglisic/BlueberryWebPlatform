import difflib
from flask import Blueprint, request, jsonify
from extensions import db
from models import HistoricalRank, HistoricalYield, HistoricalScore, HistoricalFruitQuality, Genotype

genotypes_bp = Blueprint("genotypes", __name__)


@genotypes_bp.route("/genotypes", methods=["GET"])
def list_genotypes():
    """Return genotype names filtered by an optional prefix, for autocomplete."""
    q = request.args.get("q", "").strip()
    limit = request.args.get("limit", 20, type=int)
    query = Genotype.query
    if q:
        query = query.filter(Genotype.genotype.ilike(f"%{q}%"))
    results = query.order_by(Genotype.genotype).limit(limit).all()
    return jsonify([g.genotype for g in results])


@genotypes_bp.route("/search_genotype", methods=["GET"])
def search_genotype():
    query = request.args.get("genotype", "")
    pattern = f"%{query}%"

    results = {
        "ranks": [r.to_dict() for r in HistoricalRank.query.filter(HistoricalRank.genotype.ilike(pattern)).all()],
        "yields": [r.to_dict() for r in HistoricalYield.query.filter(HistoricalYield.genotype.ilike(pattern)).all()],
        "scores": [r.to_dict() for r in HistoricalScore.query.filter(HistoricalScore.genotype.ilike(pattern)).all()],
        "fruit_quality": [r.to_dict() for r in HistoricalFruitQuality.query.filter(HistoricalFruitQuality.genotype.ilike(pattern)).all()],
    }
    return jsonify(results)


@genotypes_bp.route("/populate_genotypes", methods=["POST"])
def populate_genotypes():
    sources = [
        db.session.query(HistoricalRank.genotype).distinct(),
        db.session.query(HistoricalYield.genotype).distinct(),
        db.session.query(HistoricalScore.genotype).distinct(),
        db.session.query(HistoricalFruitQuality.genotype).distinct(),
    ]

    all_genotypes = set()
    for source in sources:
        for (g,) in source:
            if g:
                all_genotypes.add(g.strip())

    added = 0
    for g in all_genotypes:
        if not Genotype.query.filter_by(genotype=g).first():
            db.session.add(Genotype(genotype=g))
            added += 1

    db.session.commit()
    return jsonify({"status": "ok", "added": added})


@genotypes_bp.route("/spell_check", methods=["POST"])
def spell_check():
    query = request.get_json().get("genotype", "")
    all_genotypes = [g.genotype for g in Genotype.query.all()]

    exact = next((g for g in all_genotypes if g.lower() == query.lower()), None)
    if exact:
        return jsonify({"match_type": "exact", "genotype": exact})

    matches = difflib.get_close_matches(query, all_genotypes, n=5, cutoff=0.6)
    if matches:
        return jsonify({"match_type": "partial", "suggestions": matches})

    return jsonify({"match_type": "none"}), 404
