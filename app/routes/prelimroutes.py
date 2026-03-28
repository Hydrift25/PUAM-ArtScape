import flask
import app.database.db as db

#-----------------------------------------------------------------------

app = flask.Flask(__name__, template_folder="../templates")

#-----------------------------------------------------------------------


# Serve frontend
@app.route("/", methods=['GET'])
@app.route("/index", methods=['GET'])
def index():
    return flask.render_template("index.html")


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
