"""Tests for app/database/db.py — exercises every function with a fake
psycopg connection so no real database is required."""

from datetime import datetime

from app.database import db


def test_constants():
    assert db.VERIFY_STATE_PENDING == 0
    assert db.VERIFY_STATE_ACCEPTED == 1
    assert db.VERIFY_STATE_FAILED_LOCATION == 2
    assert db.VERIFY_STATE_FAILED_IMAGE == 3


def test_get_all_artworks_maps_columns(fake_connect):
    fake_connect.setup([
        (1, 40.35, -74.65, "Title A", "1900s", "desc", "img://a", "Maker A", "bronze"),
        (2, 40.36, -74.66, "Title B", "2000s", None, None, None, None),
    ])

    result = db.get_all_artworks()

    assert len(result) == 2
    assert result[0] == {
        "objectid": 1,
        "lat": 40.35,
        "lon": -74.65,
        "title": "Title A",
        "date_range": "1900s",
        "description": "desc",
        "image_url": "img://a",
        "maker": "Maker A",
        "medium": "bronze",
    }
    # Frontend expects "lon", not "long".
    assert result[1]["lon"] == -74.66
    assert result[1]["maker"] is None


def test_get_all_artworks_empty(fake_connect):
    fake_connect.setup([])
    assert db.get_all_artworks() == []


def test_get_artwork_by_id_found(fake_connect):
    fake_connect.setup([
        (7, 40.0, -74.0, "T", "d", "desc", "img", "m", "med"),
    ])
    result = db.get_artwork_by_id(7)
    assert result["objectid"] == 7
    assert result["title"] == "T"
    # The query was parameterised on the objectid.
    executed = fake_connect.last.cursor_obj.executed
    assert executed[0][1] == (7,)


def test_get_artwork_by_id_missing(fake_connect):
    fake_connect.setup([])
    assert db.get_artwork_by_id(999) is None


def test_get_nearby_artworks_orders_and_rounds(fake_connect):
    fake_connect.setup([
        (1, 40.35, -74.65, "A", "x", "d", "i", "m", "med", 12.345),
        (2, 40.36, -74.66, "B", "y", None, None, None, None, 99.0),
    ])
    result = db.get_nearby_artworks(40.0, -74.0, limit=2)
    assert len(result) == 2
    assert result[0]["distance_m"] == 12.3
    assert result[1]["distance_m"] == 99.0
    # Verify lon, lat, lon, lat, limit ordering of params.
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params == (-74.0, 40.0, -74.0, 40.0, 2)


def test_get_nearby_artworks_default_limit(fake_connect):
    fake_connect.setup([])
    db.get_nearby_artworks(0, 0)
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params[-1] == 3


def test_toggle_favorite_inserts_when_missing(fake_connect):
    # SELECT returns nothing → INSERT path.
    fake_connect.setup([])
    result = db.toggle_favorite(1, 99)
    assert result is True
    assert fake_connect.last.committed is True


def test_toggle_favorite_deletes_when_present(fake_connect):
    fake_connect.setup([(123,)])  # SELECT id returns a row.
    result = db.toggle_favorite(1, 99)
    assert result is False
    assert fake_connect.last.committed is True


def test_get_favorites_serialises_timestamp(fake_connect):
    saved_at = datetime(2024, 1, 1, 12, 0, 0)
    fake_connect.setup([
        (10, 40.0, -74.0, "Title", "img", saved_at),
        (11, 40.1, -74.1, None, None, None),
    ])
    result = db.get_favorites(1)
    assert result[0]["saved_at"] == saved_at.isoformat()
    assert result[1]["saved_at"] is None
    assert result[1]["title"] is None


def test_get_visited_artworks(fake_connect):
    found_at = datetime(2025, 4, 1, 10, 0, 0)
    fake_connect.setup([
        (5, 40.0, -74.0, "Title", "img", found_at, 1),
        (6, 40.1, -74.1, None, None, None, 2),
    ])
    result = db.get_visited_artworks(7)
    assert result[0]["verify_state"] == 1
    assert result[0]["found_at"] == found_at.isoformat()
    assert result[1]["found_at"] is None


def test_update_visited_artwork_commits(fake_connect):
    fake_connect.setup([])
    db.update_visited_artwork(1, 50)
    assert fake_connect.last.committed is True
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params == (1, 50)


def test_record_find_default_state(fake_connect):
    fake_connect.setup([])
    db.record_find(1, 50, "https://photo")
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params == (1, 50, "https://photo", db.VERIFY_STATE_PENDING)
    assert fake_connect.last.committed is True


def test_record_find_explicit_state(fake_connect):
    fake_connect.setup([])
    db.record_find(1, 50, "https://photo", db.VERIFY_STATE_ACCEPTED)
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params[-1] == db.VERIFY_STATE_ACCEPTED


def test_update_verify_state(fake_connect):
    fake_connect.setup([])
    db.update_verify_state(1, 50, db.VERIFY_STATE_FAILED_IMAGE)
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params == (db.VERIFY_STATE_FAILED_IMAGE, 1, 50)


def test_get_finds(fake_connect):
    found_at = datetime(2025, 4, 1, 10, 0, 0)
    fake_connect.setup([
        (5, 1, found_at, "Title", "img"),
        (6, 2, None, None, None),
    ])
    result = db.get_finds(1)
    assert result[0] == {
        "objectid": 5,
        "verify_state": 1,
        "found_at": found_at.isoformat(),
        "title": "Title",
        "image_url": "img",
    }
    assert result[1]["found_at"] is None


def test_get_scavenger_stats(fake_connect):
    fake_connect.setup([(4,)])
    result = db.get_scavenger_stats(1)
    assert result == {"total_finds": 4, "total_score": 40}


def test_get_scavenger_stats_zero(fake_connect):
    fake_connect.setup([(0,)])
    result = db.get_scavenger_stats(1)
    assert result["total_finds"] == 0
    assert result["total_score"] == 0


def test_get_leaderboard(fake_connect):
    fake_connect.setup([
        (1, "Alice", "a@x.com", 5, 50, 1),
        (2, "Bob",   "b@x.com", 3, 30, 2),
    ])
    result = db.get_leaderboard(limit=10)
    assert result[0]["display_name"] == "Alice"
    assert result[0]["rank"] == 1
    assert result[1]["score"] == 30
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params == (10,)


def test_get_leaderboard_default_limit(fake_connect):
    fake_connect.setup([])
    db.get_leaderboard()
    _, params = fake_connect.last.cursor_obj.executed[0]
    assert params == (20,)


def test_get_leaderboard_me_found(fake_connect):
    fake_connect.setup([(1, "Alice", "a@x.com", 5, 50, 3)])
    result = db.get_leaderboard_me(1)
    assert result == {
        "id": 1,
        "display_name": "Alice",
        "email": "a@x.com",
        "total_finds": 5,
        "score": 50,
        "rank": 3,
    }


def test_get_leaderboard_me_missing(fake_connect):
    fake_connect.setup([])
    assert db.get_leaderboard_me(99) is None


def test_get_or_create_user(fake_connect):
    created = datetime(2024, 1, 1, 0, 0, 0)
    fake_connect.setup([
        (7, "sub-7", "u@x.com", "User", "https://av", created),
    ])
    result = db.get_or_create_user(
        google_sub="sub-7",
        email="u@x.com",
        display_name="User",
        avatar_url="https://av",
    )
    assert result == {
        "id": 7,
        "google_sub": "sub-7",
        "email": "u@x.com",
        "display_name": "User",
        "avatar_url": "https://av",
        "created_at": created.isoformat(),
    }
    assert fake_connect.last.committed is True


def test_get_or_create_user_no_created_at(fake_connect):
    fake_connect.setup([(7, "sub-7", "u@x.com", "User", "https://av", None)])
    result = db.get_or_create_user("sub-7", "u@x.com", "User", "https://av")
    assert result["created_at"] is None
