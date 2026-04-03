import os
import flask
from flask import send_from_directory
from app.database import db

#-----------------------------------------------------------------------

app = flask.Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist'),
    static_url_path=''
)

#-----------------------------------------------------------------------


# API endpoint
@app.route("/api/artworks", methods=['GET'])
def artworks():
    data = db.get_all_artworks()
    return flask.jsonify(data)

@app.route("/api/artworks/nearby", methods=['GET'])
def nearby():
    lat = float(flask.request.args.get("lat"))
    lon = float(flask.request.args.get("lon"))
    return flask.jsonify(db.get_nearby_artworks(lat, lon))

@app.route("/api/artworks/favorite", methods=['GET', 'POST'])
def favorite():
    id = int(flask.request.args.get("objectid"))
    if not id:
        return flask.jsonify({"error": "No ID provided"}), 400
    is_now_favorite = db.favorite_artwork(id)
    print(f"Is object {id} favorited: {is_now_favorite}")
    return flask.jsonify({"favorited": is_now_favorite})

# Serve React
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    dist = app.static_folder
    target = os.path.join(dist, path)
    if path and os.path.exists(target):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')