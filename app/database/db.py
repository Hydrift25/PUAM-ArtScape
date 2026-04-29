import os
import contextlib
import psycopg
from dotenv import load_dotenv

# -----------------------------------------------------------------------

load_dotenv()
db_url = os.getenv("DATABASE_URL")

# -----------------------------------------------------------------------

VERIFY_STATE_PENDING = 0  # submitted, awaiting worker
VERIFY_STATE_ACCEPTED = 1  # accepted
VERIFY_STATE_FAILED_LOCATION = 2  # too far from artwork
VERIFY_STATE_FAILED_IMAGE = 3  # image mismatch

# -----------------------------------------------------------------------


def get_all_artworks():
    """
    Returns artworks with location + metadata.
    """
    query = """
        SELECT
            g.objectid,
            g.lat,
            g.long,
            d.title,
            d.date_range,
            d.description,
            d.image_url,
            d.maker,
            d.medium
        FROM geo_prelim g
        LEFT JOIN object_details d
        ON g.objectid = d.objectid;
    """

    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query)
            rows = cur.fetchall()

    return [
        {
            "objectid": r[0],
            "lat": r[1],
            "lon": r[2],  # normalize naming for frontend
            "title": r[3],
            "date_range": r[4],
            "description": r[5],
            "image_url": r[6],
            "maker": r[7],
            "medium": r[8],
        }
        for r in rows
    ]


def get_artwork_by_id(objectid):
    query = """
        SELECT
            g.objectid,
            g.lat,
            g.long,
            d.title,
            d.date_range,
            d.description,
            d.image_url,
            d.maker,
            d.medium
        FROM geo_prelim g
        LEFT JOIN object_details d
        ON g.objectid = d.objectid
        WHERE g.objectid = %s;
    """

    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (objectid,))
            row = cur.fetchone()

    if not row:
        return None

    return {
        "objectid": row[0],
        "lat": row[1],
        "lon": row[2],
        "title": row[3],
        "date_range": row[4],
        "description": row[5],
        "image_url": row[6],
        "maker": row[7],
        "medium": row[8],
    }


def get_nearby_artworks(user_lat, user_lon, limit=3):
    query = """
        SELECT
            g.objectid,
            g.lat,
            g.long,
            d.title,
            d.date_range,
            d.description,
            d.image_url,
            d.maker,
            d.medium,
            ST_Distance(
                g.geom::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) AS distance_m
        FROM geo_prelim g
        LEFT JOIN object_details d ON g.objectid = d.objectid
        ORDER BY g.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s;
    """

    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_lon, user_lat, user_lon, user_lat, limit))
            rows = cur.fetchall()

    return [
        {
            "objectid": r[0],
            "lat": r[1],
            "lon": r[2],
            "title": r[3],
            "date_range": r[4],
            "description": r[5],
            "image_url": r[6],
            "maker": r[7],
            "medium": r[8],
            "distance_m": round(float(r[9]), 1),
        }
        for r in rows
    ]


def toggle_favorite(user_id, objectid):
    check_query = "SELECT id FROM favorites WHERE user_id = %s AND objectid = %s;"
    insert_query = "INSERT INTO favorites (user_id, objectid) VALUES (%s, %s);"
    delete_query = "DELETE FROM favorites WHERE user_id = %s AND objectid = %s;"

    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(check_query, (user_id, objectid))
            exists = cur.fetchone()
            if exists:
                cur.execute(delete_query, (user_id, objectid))
                conn.commit()
                return False
            else:
                cur.execute(insert_query, (user_id, objectid))
                conn.commit()
                return True


def get_favorites(user_id):
    query = """
        SELECT f.objectid, g.lat, g.long, d.title, d.image_url, f.saved_at
        FROM favorites f
        JOIN geo_prelim g ON f.objectid = g.objectid
        LEFT JOIN object_details d ON f.objectid = d.objectid
        WHERE f.user_id = %s
        ORDER BY f.saved_at DESC;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id,))
            rows = cur.fetchall()

    return [
        {
            "objectid": r[0],
            "lat": r[1],
            "lon": r[2],
            "title": r[3],
            "image_url": r[4],
            "saved_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]


def get_visited_artworks(user_id):
    query = """
        SELECT s.objectid, g.lat, g.long, d.title, d.image_url, s.found_at, s.verify_state
        FROM scavenger_hunt_finds s
        JOIN geo_prelim g ON s.objectid = g.objectid
        LEFT JOIN object_details d ON s.objectid = d.objectid
        WHERE s.user_id = %s
        ORDER BY s.found_at DESC;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id,))
            rows = cur.fetchall()

    return [
        {
            "objectid": r[0],
            "lat": r[1],
            "lon": r[2],
            "title": r[3],
            "image_url": r[4],
            "found_at": r[5].isoformat() if r[5] else None,
            "verify_state": r[6],
        }
        for r in rows
    ]


def update_visited_artwork(user_id, objectid):
    query = """
        INSERT INTO scavenger_hunt_finds (user_id, objectid)
        VALUES (%s, %s)
        ON CONFLICT (user_id, objectid) DO NOTHING;
    """

    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id, objectid))
            conn.commit()


def record_find(user_id, objectid, photo_url, verify_state=VERIFY_STATE_PENDING):
    # ON CONFLICT UPDATE allows re-submission when prior verification failed
    query = """
        INSERT INTO scavenger_hunt_finds (user_id, objectid, photo_url, verify_state)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, objectid)
        DO UPDATE SET
            photo_url = EXCLUDED.photo_url,
            verify_state = EXCLUDED.verify_state;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id, objectid, photo_url, verify_state))
            conn.commit()


def update_verify_state(user_id, objectid, verify_state):
    query = """
        UPDATE scavenger_hunt_finds
        SET verify_state = %s
        WHERE user_id = %s AND objectid = %s;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (verify_state, user_id, objectid))
            conn.commit()


def get_finds(user_id):
    query = """
        SELECT
            s.objectid,
            s.verify_state,
            s.found_at,
            d.title,
            d.image_url
        FROM scavenger_hunt_finds s
        LEFT JOIN object_details d ON s.objectid = d.objectid
        WHERE s.user_id = %s
        ORDER BY s.found_at DESC;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id,))
            rows = cur.fetchall()

    return [
        {
            "objectid": r[0],
            "verify_state": r[1],
            "found_at": r[2].isoformat() if r[2] else None,
            "title": r[3],
            "image_url": r[4],
        }
        for r in rows
    ]


def get_scavenger_stats(user_id):
    query = """
        SELECT COUNT(*) AS total_finds
        FROM scavenger_hunt_finds
        WHERE user_id = %s AND verify_state = 1;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()

    total_finds = int(row[0])

    return {
        "total_finds": total_finds,
        "total_score": total_finds * 10,
    }


def get_leaderboard(limit=20):
    query = """
        WITH scores AS (
            SELECT
                u.id,
                u.display_name,
                u.email,
                COUNT(s.objectid)           AS total_finds,
                COUNT(s.objectid) * 10      AS score
            FROM users u
            LEFT JOIN scavenger_hunt_finds s ON u.id = s.user_id AND s.verify_state = 1
            GROUP BY u.id, u.display_name, u.email
            HAVING COUNT(s.objectid) > 0
        )
        SELECT
            id,
            display_name,
            email,
            total_finds,
            score,
            RANK() OVER (ORDER BY score DESC) AS rank
        FROM scores
        ORDER BY score DESC
        LIMIT %s;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "display_name": r[1],
            "email": r[2],
            "total_finds": int(r[3]),
            "score": int(r[4]),
            "rank": int(r[5]),
        }
        for r in rows
    ]


def get_leaderboard_me(user_id):
    query = """
        WITH scores AS (
            SELECT
                u.id,
                u.display_name,
                u.email,
                COUNT(s.objectid)           AS total_finds,
                COUNT(s.objectid) * 10      AS score
            FROM users u
            LEFT JOIN scavenger_hunt_finds s ON u.id = s.user_id AND s.verify_state = 1
            GROUP BY u.id, u.display_name, u.email
            HAVING COUNT(s.objectid) > 0
        ),
        ranked AS (
            SELECT *, RANK() OVER (ORDER BY score DESC) AS rank
            FROM scores
        )
        SELECT
            id,
            display_name,
            email,
            total_finds,
            score,
            rank
        FROM ranked
        WHERE id = %s;
    """
    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()

    if not row:
        return None

    return {
        "id": row[0],
        "display_name": row[1],
        "email": row[2],
        "total_finds": int(row[3]),
        "score": int(row[4]),
        "rank": int(row[5]),
    }


def get_or_create_user(google_sub, email, display_name, avatar_url):
    query = """
        INSERT INTO users (google_sub, email, display_name, avatar_url)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (google_sub) DO UPDATE
            SET email        = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                avatar_url   = EXCLUDED.avatar_url
        RETURNING id, google_sub, email, display_name, avatar_url, created_at;
    """

    with contextlib.closing(psycopg.connect(db_url)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (google_sub, email, display_name, avatar_url))
            row = cur.fetchone()
            conn.commit()

    return {
        "id": row[0],
        "google_sub": row[1],
        "email": row[2],
        "display_name": row[3],
        "avatar_url": row[4],
        "created_at": row[5].isoformat() if row[5] else None,
    }
