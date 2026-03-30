from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from extensions import db
from models import User, EmailWhitelist

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not EmailWhitelist.query.filter_by(email=email).first():
        return jsonify({"status": "email_not_whitelisted"}), 403

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"status": "user_not_found_but_whitelisted"}), 404

    if not check_password_hash(user.password, password):
        return jsonify({"status": "incorrect_password"}), 401

    return jsonify({"status": "login_successful", "user": user.to_dict()})


@auth_bp.route("/update_user", methods=["PUT"])
def update_user():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    user_name = data.get("user_name")

    if not EmailWhitelist.query.filter_by(email=email).first():
        return jsonify({"error": "Email not whitelisted"}), 403

    user = User.query.filter_by(email=email).first()
    if user:
        if user_name:
            user.user_name = user_name
        if password:
            user.password = generate_password_hash(password)
    else:
        if not password:
            return jsonify({"error": "Password required for new user"}), 400
        user = User(
            email=email,
            user_name=user_name or "",
            password=generate_password_hash(password),
            user_group="ops",
        )
        db.session.add(user)

    db.session.commit()
    return jsonify({"status": "ok", "user": user.to_dict()})


@auth_bp.route("/get_user_group", methods=["GET"])
def get_user_group():
    email = request.args.get("email")
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user_group": user.user_group})
