import flask
import db

app = flask.Flask(__name__)


# Serve frontend
@app.route("/")
@app.route("/index")
def index():
    return flask.render_template("index.html")


# API endpoint
@app.route("/api/artworks")
def artworks():
    data = db.get_all_artworks()
    return flask.jsonify(data)

@app.route("/api/artworks/nearby")
def nearby():
    lat = float(flask.request.args.get("lat"))
    lon = float(flask.request.args.get("lon"))
    return flask.jsonify(db.get_nearby_artworks(lat, lon))

@app.route("/api/artworks/favorite")
def favorite():
    id = float(flask.request.args.get("id"))
    db.favorite_artwork(id)
    print(f"Favorited objectid = {id}")
    return "Done writing favorite to DB"

if __name__ == "__main__":
    app.run(debug=True)