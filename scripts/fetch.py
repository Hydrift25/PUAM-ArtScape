import os
import requests
from contextlib import contextmanager
import psycopg
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

# ---------- DB CONNECTION ----------


@contextmanager
def get_conn():
    conn = psycopg.connect(db_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- API FETCH ----------


def fetch_artwork_metadata(objectid):
    url = f"https://data.artmuseum.princeton.edu/objects/{objectid}"

    try:
        res = requests.get(url, timeout=5)
        res.raise_for_status()
        data = res.json()

        # ---- TITLE ----
        title = data.get("displaytitle")
        if not title and data.get("titles"):
            title = data["titles"][0].get("title")

        # ---- DATE RANGE ----
        date_range = data.get("daterange") or data.get("displaydate")

        # ---- DESCRIPTION (Gallery Label preferred) ----
        description = None
        for text in data.get("texts", []):
            if text.get("textpurpose") == "Gallery Label":
                description = text.get("textentryhtml")
                break

        # fallback: any text
        if not description and data.get("texts"):
            description = data["texts"][0].get("textentryhtml")

        # ---- IMAGE ----
        image_url = None

        if data.get("primaryimage"):
            image_url = data["primaryimage"][0]
        else:
            for media in data.get("media", []):
                if media.get("isprimary") == 1:
                    image_url = media.get("uri")
                    break

        return {
            "title": title,
            "date_range": date_range,
            "description": description,
            "image_url": image_url,
        }

    except Exception as e:
        print(f"[ERROR] {objectid}: {e}")
        return None


# ---------- MAIN SCRIPT ----------


def prefill_metadata(limit=None):
    with get_conn() as conn:
        with conn.cursor() as cur:

            # Get artworks missing metadata
            query = """
                SELECT objectid
                FROM object_details
                WHERE title IS NULL
            """
            if limit:
                query += f" LIMIT {limit}"

            cur.execute(query)
            rows = cur.fetchall()

            print(f"Found {len(rows)} artworks to update")

            for (objectid,) in rows:
                metadata = fetch_artwork_metadata(objectid)

                if not metadata:
                    continue

                update_query = """
                    UPDATE object_details
                    SET title = %s,
                        date_range = %s,
                        description = %s,
                        image_url = %s
                    WHERE objectid = %s
                """

                cur.execute(
                    update_query,
                    (
                        metadata["title"],
                        metadata["date_range"],
                        metadata["description"],
                        metadata["image_url"],
                        objectid,
                    ),
                )

                print(f"[UPDATED] {objectid}")


# ---------- RUN ----------

if __name__ == "__main__":
    prefill_metadata()
