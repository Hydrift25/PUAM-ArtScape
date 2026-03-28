import os
import contextlib
import psycopg
import math
from decimal import Decimal

#-----------------------------------------------------------------------

DATABASE_URL = "DATABASE_URL_REMOVED"

#-----------------------------------------------------------------------

def get_all_artworks(limit=50):
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
            d.favorited
        FROM geo_prelim g
        LEFT JOIN object_details d
        ON g.objectid = d.objectid
        LIMIT %s;
    """

    with contextlib.closing(
        psycopg.connect(DATABASE_URL)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(query, (limit,))
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
            "favorited": r[7],
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
            d.favorited
        FROM geo_prelim g
        LEFT JOIN object_details d
        ON g.objectid = d.objectid
        WHERE g.objectid = %s;
    """

    with contextlib.closing(
        psycopg.connect(DATABASE_URL)) as conn:
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
        "favorited": row[7]
    }


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(Decimal(lat2) - Decimal(lat1))
    dlambda = math.radians(Decimal(lon2) - Decimal(lon1))

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_nearby_artworks(user_lat, user_lon, limit=3):
    artworks = get_all_artworks(limit=100)  # small dataset for now

    for art in artworks:
        art["distance"] = haversine(user_lat, user_lon, art["lat"], art["lon"])

    artworks.sort(key=lambda x: x["distance"])

    return artworks[:limit]


def favorite_artwork(objectid):
    update_query = """
                    UPDATE object_details
                    SET favorited = NOT COALESCE(favorited, false)
                    WHERE objectid = %s
                    RETURNING favorited;
                """

    with contextlib.closing(
        psycopg.connect(DATABASE_URL)) as conn:
        with contextlib.closing(conn.cursor()) as cur:
            cur.execute(update_query, (objectid,))
            new_status = cur.fetchone()[0]
            conn.commit()
            return new_status
