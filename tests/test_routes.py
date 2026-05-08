"""Tests for HTTP routes in app/routes/routes.py.

Database functions are patched, the Gemini client is patched (image
verification is tested separately), and Cloudinary upload is patched.
"""

import io
from unittest.mock import patch, MagicMock

import pytest

from app.database import db


# ---------------------------------------------------------------------
# /api/artworks (public)
# ---------------------------------------------------------------------


def test_artworks_returns_db_data(client):
    payload = [{"objectid": 1, "title": "A"}]
    with patch.object(db, "get_all_artworks", return_value=payload) as m:
        resp = client.get("/api/artworks")
    assert resp.status_code == 200
    assert resp.get_json() == payload
    assert "max-age=300" in resp.headers.get("Cache-Control", "")
    m.assert_called_once_with()


def test_artworks_empty(client):
    with patch.object(db, "get_all_artworks", return_value=[]):
        resp = client.get("/api/artworks")
    assert resp.get_json() == []


# ---------------------------------------------------------------------
# /api/artworks/nearby
# ---------------------------------------------------------------------


def test_nearby_calls_db_with_floats(client):
    with patch.object(db, "get_nearby_artworks", return_value=[]) as m:
        resp = client.get("/api/artworks/nearby?lat=40.35&lon=-74.65")
    assert resp.status_code == 200
    m.assert_called_once_with(40.35, -74.65)


def test_nearby_missing_params_raises(app):
    # Missing lat/lon causes float(None) → TypeError. With TESTING=True the
    # exception propagates rather than turning into a 500.
    app.config["PROPAGATE_EXCEPTIONS"] = False
    client = app.test_client()
    try:
        with patch.object(db, "get_nearby_artworks", return_value=[]):
            resp = client.get("/api/artworks/nearby")
        assert resp.status_code == 500
    finally:
        app.config["PROPAGATE_EXCEPTIONS"] = None


# ---------------------------------------------------------------------
# /api/artworks/favorite (auth required)
# ---------------------------------------------------------------------


def test_favorite_requires_login(client):
    resp = client.post("/api/artworks/favorite", json={"objectid": 1})
    assert resp.status_code == 401
    assert resp.get_json() == {"error": "Not logged in"}


def test_favorite_requires_objectid(logged_in_client):
    resp = logged_in_client.post("/api/artworks/favorite", json={})
    assert resp.status_code == 400


def test_favorite_toggles_on(logged_in_client):
    with patch.object(db, "toggle_favorite", return_value=True) as m:
        resp = logged_in_client.post(
            "/api/artworks/favorite", json={"objectid": 99}
        )
    assert resp.status_code == 200
    assert resp.get_json() == {"favorited": True}
    m.assert_called_once_with(42, 99)


def test_favorite_toggles_off(logged_in_client):
    with patch.object(db, "toggle_favorite", return_value=False):
        resp = logged_in_client.post(
            "/api/artworks/favorite", json={"objectid": 99}
        )
    assert resp.get_json() == {"favorited": False}


# ---------------------------------------------------------------------
# /api/artworks/favorites (auth required)
# ---------------------------------------------------------------------


def test_get_favorites_requires_login(client):
    resp = client.get("/api/artworks/favorites")
    assert resp.status_code == 401


def test_get_favorites_returns_list(logged_in_client):
    payload = [{"objectid": 1, "title": "T"}]
    with patch.object(db, "get_favorites", return_value=payload) as m:
        resp = logged_in_client.get("/api/artworks/favorites")
    assert resp.status_code == 200
    assert resp.get_json() == payload
    m.assert_called_once_with(42)


# ---------------------------------------------------------------------
# /api/artworks/visited
# ---------------------------------------------------------------------


def test_get_visited_requires_login(client):
    resp = client.get("/api/artworks/visited")
    assert resp.status_code == 401


def test_get_visited_returns_data(logged_in_client):
    payload = [{"objectid": 1, "verify_state": 1}]
    with patch.object(db, "get_visited_artworks", return_value=payload) as m:
        resp = logged_in_client.get("/api/artworks/visited")
    assert resp.get_json() == payload
    m.assert_called_once_with(42)


def test_post_visited_requires_login(client):
    resp = client.post("/api/artworks/visited", json={"objectid": 1})
    assert resp.status_code == 401


def test_post_visited_requires_objectid(logged_in_client):
    resp = logged_in_client.post("/api/artworks/visited", json={})
    assert resp.status_code == 400


def test_post_visited_calls_db(logged_in_client):
    with patch.object(db, "update_visited_artwork") as m:
        resp = logged_in_client.post(
            "/api/artworks/visited", json={"objectid": 7}
        )
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    m.assert_called_once_with(42, 7)


# ---------------------------------------------------------------------
# /api/scavenger/find — image-verification gemini call patched out.
# ---------------------------------------------------------------------


def test_scavenger_find_requires_login(client):
    resp = client.post("/api/scavenger/find", json={})
    assert resp.status_code == 401


@pytest.mark.parametrize(
    "body,expected_error",
    [
        ({"imageUrl": "http://x", "distToObject": 0}, "No objectid provided"),
        ({"objectid": 1, "distToObject": 0}, "No image URL provided"),
        ({"objectid": 1, "imageUrl": "http://x"}, "No distance provided"),
    ],
)
def test_scavenger_find_validates_body(logged_in_client, body, expected_error):
    resp = logged_in_client.post("/api/scavenger/find", json=body)
    assert resp.status_code == 400
    assert resp.get_json() == {"error": expected_error}


def test_scavenger_find_too_far_records_failed_location(logged_in_client):
    with patch.object(db, "record_find") as record:
        resp = logged_in_client.post(
            "/api/scavenger/find",
            json={
                "objectid": 1,
                "imageUrl": "http://photo",
                "distToObject": 9999,
            },
        )
    assert resp.status_code == 200
    assert resp.get_json() == {"verify_state": db.VERIFY_STATE_FAILED_LOCATION}
    record.assert_called_once_with(
        42, 1, "http://photo", db.VERIFY_STATE_FAILED_LOCATION
    )


def test_scavenger_find_artwork_not_found(logged_in_client):
    with patch.object(db, "get_artwork_by_id", return_value=None), \
         patch.object(db, "record_find") as record:
        resp = logged_in_client.post(
            "/api/scavenger/find",
            json={
                "objectid": 9999,
                "imageUrl": "http://photo",
                "distToObject": 5,
            },
        )
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Artwork not found"}
    record.assert_not_called()


def test_scavenger_find_dev_bypass_location(logged_in_client, monkeypatch):
    """DEV_BYPASS_LOCATION=true overrides the distance check.

    We still patch out Gemini and the network fetch — image verification is
    out of scope here. Just confirm the bypass routes past the distance gate.
    """
    monkeypatch.setenv("DEV_BYPASS_LOCATION", "true")

    artwork = {"title": "X", "maker": "Y", "medium": "z", "date_range": "2020"}
    fake_response = MagicMock()
    fake_response.text = "YES"
    fake_client = MagicMock()
    fake_client.models.generate_content.return_value = fake_response

    with patch.object(db, "get_artwork_by_id", return_value=artwork), \
         patch.object(db, "record_find") as record, \
         patch("app.server.routes.genai.Client", return_value=fake_client), \
         patch("app.server.routes.requests.get") as req_get:
        req_get.return_value.content = b"img"

        resp = logged_in_client.post(
            "/api/scavenger/find",
            json={
                "objectid": 1,
                "imageUrl": "http://photo",
                # Distance > VERIFY_MIN_DIST_M, but bypass should override.
                "distToObject": 99999,
            },
        )

    # Should not be VERIFY_STATE_FAILED_LOCATION.
    body = resp.get_json()
    assert body["verify_state"] != db.VERIFY_STATE_FAILED_LOCATION
    record.assert_called_once()


# ---------------------------------------------------------------------
# /api/upload
# ---------------------------------------------------------------------


def test_upload_requires_login(client):
    resp = client.post("/api/upload")
    assert resp.status_code == 401


def test_upload_no_file(logged_in_client):
    resp = logged_in_client.post("/api/upload", data={})
    assert resp.status_code == 400


def test_upload_returns_secure_url(logged_in_client):
    with patch(
        "app.server.routes.cloudinary.uploader.upload",
        return_value={"secure_url": "https://cdn/img.jpg"},
    ) as upload:
        resp = logged_in_client.post(
            "/api/upload",
            data={"image": (io.BytesIO(b"img-bytes"), "photo.jpg")},
            content_type="multipart/form-data",
        )
    assert resp.status_code == 200
    assert resp.get_json() == {"image_url": "https://cdn/img.jpg"}
    upload.assert_called_once()


# ---------------------------------------------------------------------
# /api/scavenger/finds and /api/scavenger/stats
# ---------------------------------------------------------------------


def test_scavenger_finds_requires_login(client):
    assert client.get("/api/scavenger/finds").status_code == 401


def test_scavenger_finds_returns_data(logged_in_client):
    with patch.object(db, "get_finds", return_value=[{"objectid": 1}]) as m:
        resp = logged_in_client.get("/api/scavenger/finds")
    assert resp.get_json() == [{"objectid": 1}]
    m.assert_called_once_with(42)


def test_scavenger_stats_requires_login(client):
    assert client.get("/api/scavenger/stats").status_code == 401


def test_scavenger_stats_returns_data(logged_in_client):
    payload = {"total_finds": 5, "total_score": 50}
    with patch.object(db, "get_scavenger_stats", return_value=payload) as m:
        resp = logged_in_client.get("/api/scavenger/stats")
    assert resp.get_json() == payload
    m.assert_called_once_with(42)


# ---------------------------------------------------------------------
# /api/leaderboard
# ---------------------------------------------------------------------


def test_leaderboard_requires_login(client):
    assert client.get("/api/leaderboard").status_code == 401


def test_leaderboard_returns_rankings(logged_in_client):
    payload = [{"id": 1, "rank": 1, "score": 100}]
    with patch.object(db, "get_leaderboard", return_value=payload) as m:
        resp = logged_in_client.get("/api/leaderboard")
    assert resp.get_json() == payload
    m.assert_called_once_with()


def test_leaderboard_me_requires_login(client):
    assert client.get("/api/leaderboard/me").status_code == 401


def test_leaderboard_me_returns_data(logged_in_client):
    payload = {"id": 42, "rank": 7}
    with patch.object(db, "get_leaderboard_me", return_value=payload) as m:
        resp = logged_in_client.get("/api/leaderboard/me")
    assert resp.get_json() == payload
    m.assert_called_once_with(42)


def test_leaderboard_me_unranked(logged_in_client):
    with patch.object(db, "get_leaderboard_me", return_value=None):
        resp = logged_in_client.get("/api/leaderboard/me")
    assert resp.get_json() is None


# ---------------------------------------------------------------------
# /api/auth/*
# ---------------------------------------------------------------------


def test_auth_logout_clears_session(logged_in_client):
    resp = logged_in_client.get("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    # Session user should be gone.
    with logged_in_client.session_transaction() as sess:
        assert sess.get("user") is None


def test_auth_logout_when_not_logged_in(client):
    # Logging out without being logged in should still 200.
    resp = client.get("/api/auth/logout")
    assert resp.status_code == 200


def test_auth_me_logged_out(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.get_json() == {"user": None}


def test_auth_me_logged_in(logged_in_client):
    resp = logged_in_client.get("/api/auth/me")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["id"] == 42
    assert body["email"] == "test@example.com"


def test_auth_callback_oauth_error_redirects(client):
    from authlib.integrations.base_client.errors import OAuthError

    with patch(
        "app.server.routes.oauth.google.authorize_access_token",
        side_effect=OAuthError("user cancelled"),
    ):
        resp = client.get("/api/auth/callback")
    assert resp.status_code == 302
    assert "auth_cancelled=true" in resp.headers["Location"]


def test_auth_callback_success_creates_session(client):
    fake_token = {
        "userinfo": {
            "sub": "google-sub-1",
            "email": "u@x.com",
            "name": "Test User",
            "picture": "https://av",
        }
    }
    user_row = {
        "id": 1,
        "google_sub": "google-sub-1",
        "email": "u@x.com",
        "display_name": "Test User",
        "avatar_url": "https://av",
        "created_at": None,
    }
    with patch(
        "app.server.routes.oauth.google.authorize_access_token",
        return_value=fake_token,
    ), patch.object(db, "get_or_create_user", return_value=user_row):
        resp = client.get("/api/auth/callback")
    assert resp.status_code == 302
    # Session is populated.
    with client.session_transaction() as sess:
        assert sess["user"]["email"] == "u@x.com"


# ---------------------------------------------------------------------
# Static / SPA fallback
# ---------------------------------------------------------------------


def test_serve_react_returns_index_for_root(client):
    # Uses the real frontend/dist if present.
    import os

    dist = client.application.static_folder
    if not (dist and os.path.exists(os.path.join(dist, "index.html"))):
        pytest.skip("frontend/dist/index.html not built")

    resp = client.get("/")
    assert resp.status_code == 200
    assert b"<!doctype html" in resp.data.lower() or b"<html" in resp.data.lower()
