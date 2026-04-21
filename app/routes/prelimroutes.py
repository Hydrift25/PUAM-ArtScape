import os
import flask
from flask import send_from_directory, session, redirect, url_for
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
from flask_compress import Compress
from app.database import db
from multiprocessing import Process, Queue
import torch
import clip
from PIL import Image
from io import BytesIO
import requests
import cloudinary.uploader
from dotenv import load_dotenv
from shared import image_verify_queue
from flask_socketio import SocketIO, join_room
from flask import request

print("QUEUE ID (Flask):", id(image_verify_queue))

load_dotenv()

SCRIPT_DIR = os.path.dirname(__file__)

#-----------------------------------------------------------------------

app = flask.Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist'),
    static_url_path=''
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
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def handle_connect(auth):
    user_id = auth.get("user_id")

    if not user_id:
        return False  # reject connection

    join_room(f"user_{user_id}")

#-----------------------------------------------------------------------


# API endpoint
@app.route("/api/artworks", methods=['GET'])
def artworks():
    data = db.get_all_artworks()
    resp = flask.jsonify(data)
    resp.headers['Cache-Control'] = 'public, max-age=300'
    return resp

@app.route("/api/artworks/nearby", methods=['GET'])
def nearby():
    lat = float(flask.request.args.get("lat"))
    lon = float(flask.request.args.get("lon"))
    return flask.jsonify(db.get_nearby_artworks(lat, lon))

@app.route("/api/artworks/favorite", methods=['POST'])
def favorite():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    objectid = flask.request.json.get("objectid")
    if not objectid:
        return flask.jsonify({"error": "No objectid provided"}), 400
    is_now_favorite = db.toggle_favorite(user["id"], objectid)
    return flask.jsonify({"favorited": is_now_favorite})

@app.route("/api/artworks/favorites", methods=['GET'])
def get_favorites():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_favorites(user["id"]))

# Serve React
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    dist = app.static_folder
    target = os.path.join(dist, path)
    if path and os.path.exists(target):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')

@app.route("/api/artworks/visited", methods=['GET'])
def visited_artworks():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_visited_artworks(user["id"]))

@app.route("/api/artworks/visited", methods=['POST'])
def update_visited_artwork():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    objectid = flask.request.json.get("objectid")
    if not objectid:
        return flask.jsonify({"error": "No objectid provided"}), 400
    db.update_visited_artwork(user["id"], objectid)
    return flask.jsonify({"success": True})

#-----------------------------------------------------------------------

@app.route("/api/scavenger/find", methods=['POST'])
def scavenger_find():
    print(flask.request.data)
    print(flask.request.get_json())
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401

    objectid = flask.request.json.get("currObjectId")
    user_image_url = flask.request.json.get("userImageUrl")
    if not objectid:
        return flask.jsonify({"error": "No objectid provided"}), 400
    if not user_image_url:
        return flask.jsonify({"error": "No user image URL provided"}), 400

    db.record_find(user["id"], objectid, user_image_url)

    print("ENQUEING JOB: ", user["id"], objectid, user_image_url, id(image_verify_queue))
    image_verify_queue.put((user["id"], objectid, user_image_url))

    return flask.jsonify({"success": True})

@app.route("/api/scavenger/verify/<int:objectid>", methods=['POST'])
def scavenger_verify(objectid):
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    db.verify_find(user["id"], objectid)
    return flask.jsonify({"success": True})

@app.route("/api/scavenger/finds", methods=['GET'])
def scavenger_finds():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_finds(user["id"]))

@app.route("/api/scavenger/stats", methods=['GET'])
def scavenger_stats():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_scavenger_stats(user["id"]))

@app.route("/api/leaderboard", methods=['GET'])
def leaderboard():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    return flask.jsonify(db.get_leaderboard())

@app.route("/api/leaderboard/me", methods=['GET'])
def leaderboard_me():
    user = session.get("user")
    if not user:
        return flask.jsonify({"error": "Not logged in"}), 401
    result = db.get_leaderboard_me(user["id"])
    if result is None:
        return flask.jsonify({"error": "User not found"}), 404
    return flask.jsonify(result)

#-----------------------------------------------------------------------

@app.route("/api/auth/login")
def auth_login():
    callback_url = url_for("auth_callback", _external=True)
    return oauth.google.authorize_redirect(callback_url)

@app.route("/api/auth/callback")
def auth_callback():
    token = oauth.google.authorize_access_token()
    userinfo = token.get("userinfo", {})
    user = db.get_or_create_user(
        google_sub=userinfo.get("sub"),
        email=userinfo.get("email"),
        display_name=userinfo.get("name"),
        avatar_url=userinfo.get("picture"),
    )
    session["user"] = user
    frontend_url = os.getenv("FRONTEND_URL", "/")
    return redirect(frontend_url)

@app.route("/api/auth/logout")
def auth_logout():
    session.pop("user", None)
    return flask.jsonify({"success": True})

@app.route("/api/auth/me")
def auth_me():
    user = session.get("user")
    resp = flask.jsonify(user if user else {"user": None})
    resp.headers['Cache-Control'] = 'private, max-age=60'
    return resp

#-----------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def upload():
    file = flask.request.files.get("image")

    if not file:
        return flask.jsonify({"error": "No file"}), 400

    # Upload to Cloudinary
    result = cloudinary.uploader.upload(file)

    image_url = result["secure_url"]
    print(image_url)

    return flask.jsonify({
        "image_url": image_url,
    })