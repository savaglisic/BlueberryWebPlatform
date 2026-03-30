from functools import wraps
from flask import request, jsonify
from models import APIKey


def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-API-KEY")
        if not key or not APIKey.query.filter_by(key=key).first():
            return jsonify({"error": "Invalid or missing API key"}), 401
        return f(*args, **kwargs)
    return decorated
