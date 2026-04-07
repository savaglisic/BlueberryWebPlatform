import os
from flask import Blueprint, request, jsonify
from models import EmailWhitelist

me_bp = Blueprint("me", __name__)


@me_bp.route("/me", methods=["GET"])
def get_me():
    email = request.headers.get("Cf-Access-Authenticated-User-Email") or os.environ.get("DEV_USER_EMAIL", "")
    is_admin = bool(email and EmailWhitelist.query.filter_by(email=email).first())
    return jsonify({"email": email, "isAdmin": is_admin})
