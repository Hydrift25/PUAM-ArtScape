import os
import flask
from flask import send_from_directory, session, redirect, url_for
from authlib.integrations.flask_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from flask_cors import CORS
from flask_compress import Compress
import requests
from google import genai
from google.genai import types
from app.database import db
from app.database.db import (
    VERIFY_STATE_ACCEPTED,
    VERIFY_STATE_FAILED_LOCATION,
    VERIFY_STATE_FAILED_IMAGE,
)
from dotenv import load_dotenv

load_dotenv()

import cloudinary.uploader  # must import after load_dotenv()!

# -----------------------------------------------------------------------

app = flask.Flask(
    __name__,
    static_folder=os.path.join(
        os.path.dirname(__file__), "..", "..", "frontend", "dist"
    ),
)
app.secret_key = os.getenv("APP_SECRET_KEY")
Compress(app)
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    CORS(app, supports_credentials=True, origins=frontend_url)
else:
    CORS(app, supports_credentials=True)

oauth = OAuth(app)
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

VERIFY_MIN_DIST_M = float(os.getenv("VERIFY_MIN_DIST_M", 50))

# -----------------------------------------------------------------------


# API endpoint
@app.route("/api/artworks", methods=["GET"])
def artworks():
    data = db.get_all_artworks()
    resp = flask.jsonify(data)
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp


@app.route("/api/artworks/nearby", methods=["GET"])
def nearby():
    lat = float(flask.request.args.get("lat"))
    lon = float(flask.request.args.get("lon"))
    return flask.jsonify(db.get_nearby_artworks(lat, lon))


@app.route("/api/artworks/favorite", methods=["POST"])
def favorite():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    objectid = flask.request.json.get("objectid")
    if not objectid:
        return flask.jsonify({"error": "No objectid provided"}), 400
    is_now_favorite = db.toggle_favorite(user["id"], objectid)
    return flask.jsonify({"favorited": is_now_favorite})


@app.route("/api/artworks/favorites", methods=["GET"])
def get_favorites():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_favorites(user["id"]))


@app.route("/api/artworks/visited", methods=["GET"])
def visited_artworks():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_visited_artworks(user["id"]))


@app.route("/api/artworks/visited", methods=["POST"])
def update_visited_artwork():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    objectid = flask.request.json.get("objectid")
    if not objectid:
        return flask.jsonify({"error": "No objectid provided"}), 400
    db.update_visited_artwork(user["id"], objectid)
    return flask.jsonify({"success": True})


# -----------------------------------------------------------------------


@app.route("/api/scavenger/find", methods=["POST"])
def scavenger_find():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401

    data = flask.request.json
    objectid = data.get("objectid")
    image_url = data.get("imageUrl")
    dist_to_object = data.get("distToObject")

    if not objectid:
        return flask.jsonify({"error": "No objectid provided"}), 400
    if not image_url:
        return flask.jsonify({"error": "No image URL provided"}), 400
    if dist_to_object is None:
        return flask.jsonify({"error": "No distance provided"}), 400

    if os.getenv("DEV_BYPASS_LOCATION") == "true":
        print(
            f"[DEV] bypassing location check for user={user['id']} objectid={objectid}"
        )
        dist_to_object = 0

    if float(dist_to_object) > VERIFY_MIN_DIST_M:
        db.record_find(user["id"], objectid, image_url, VERIFY_STATE_FAILED_LOCATION)
        return flask.jsonify({"verify_state": VERIFY_STATE_FAILED_LOCATION})

    artwork = db.get_artwork_by_id(objectid)
    if not artwork:
        return flask.jsonify({"error": "Artwork not found"}), 404

    try:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        user_bytes = requests.get(image_url).content

        title = artwork.get("title") or "Unknown"
        maker = artwork.get("maker") or "Unknown artist"
        medium = artwork.get("medium") or "unknown medium"
        date_range = artwork.get("date_range") or ""
        date_str = f" ({date_range})" if date_range else ""

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=[
                f"You are verifying a scavenger hunt photo submission at Princeton University Art Museum's outdoor campus. "
                f"The user is trying to find an artwork titled '{title}'{date_str} by {maker}, which is a {medium} located outdoors on campus. "
                f"Does the user's photo clearly show this artwork? "
                f"Reply with only YES or NO.",
                types.Part.from_bytes(data=user_bytes, mime_type="image/jpeg"),
            ],
        )

        answer = response.text.strip().upper()
        verify_state = VERIFY_STATE_ACCEPTED if "YES" in answer else VERIFY_STATE_FAILED_IMAGE
    except Exception as e:
        print(f"[verify] Gemini error: {e}")
        verify_state = VERIFY_STATE_FAILED_IMAGE

    db.record_find(user["id"], objectid, image_url, verify_state)
    return flask.jsonify({"verify_state": verify_state})


@app.route("/api/upload", methods=["POST"])
def upload():
    if not session.get("user"):
        return flask.jsonify({"error": "Not logged in"}), 401
    file = flask.request.files.get("image")
    if not file:
        return flask.jsonify({"error": "No file"}), 400
    result = cloudinary.uploader.upload(file)
    return flask.jsonify({"image_url": result["secure_url"]})


@app.route("/api/scavenger/finds", methods=["GET"])
def scavenger_finds():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_finds(user["id"]))


@app.route("/api/scavenger/stats", methods=["GET"])
def scavenger_stats():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_scavenger_stats(user["id"]))


@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_leaderboard())


@app.route("/api/leaderboard/me", methods=["GET"])
def leaderboard_me():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    result = db.get_leaderboard_me(user["id"])
    return flask.jsonify(result)


# -----------------------------------------------------------------------


@app.route("/api/auth/login")
def auth_login():
    callback_url = url_for("auth_callback", _external=True)
    return oauth.google.authorize_redirect(callback_url)


@app.route("/api/auth/callback")
def auth_callback():
    frontend_url = os.getenv("FRONTEND_URL", "/")
    try:
        token = oauth.google.authorize_access_token()
    except OAuthError:
        return redirect(frontend_url + "/?auth_cancelled=true")
    userinfo = token.get("userinfo", {})
    user = db.get_or_create_user(
        google_sub=userinfo.get("sub"),
        email=userinfo.get("email"),
        display_name=userinfo.get("name"),
        avatar_url=userinfo.get("picture"),
    )
    session["user"] = user
    return redirect(frontend_url)


@app.route("/api/auth/logout")
def auth_logout():
    session.pop("user", None)
    return flask.jsonify({"success": True})


@app.route("/api/auth/me")
def auth_me():
    user = session.get("user")
    resp = flask.jsonify(user if user else {"user": None})
    resp.headers["Cache-Control"] = "private, max-age=60"
    return resp


# -----------------------------------------------------------------------


# Serve React
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    dist = app.static_folder
    target = os.path.join(dist, path)
    if path and os.path.exists(target):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")