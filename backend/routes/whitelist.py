from flask import Blueprint, request, jsonify
from extensions import db
from models import EmailWhitelist

whitelist_bp = Blueprint("whitelist", __name__)


@whitelist_bp.route("/email_whitelist", methods=["GET"])
def get_whitelist():
    entries = EmailWhitelist.query.all()
    return jsonify([e.email for e in entries])


@whitelist_bp.route("/email_whitelist", methods=["POST"])
def add_to_whitelist():
    email = request.get_json().get("email")
    if not email:
        return jsonify({"error": "Email required"}), 400
    if EmailWhitelist.query.filter_by(email=email).first():
        return jsonify({"error": "Email already whitelisted"}), 409
    db.session.add(EmailWhitelist(email=email))
    db.session.commit()
    return jsonify({"status": "ok"}), 201


@whitelist_bp.route("/email_whitelist/<email>", methods=["DELETE"])
def remove_from_whitelist(email):
    entry = EmailWhitelist.query.filter_by(email=email).first_or_404()
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"status": "ok"})
