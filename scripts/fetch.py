import os
import time
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

        # ---- MAKER ----
        # Use the first (primary) maker sorted by displayorder
        maker = None
        makers = data.get("makers", [])
        if makers:
            primary = sorted(makers, key=lambda m: m.get("displayorder", 99))[0]
            maker = primary.get("displaymaker") or primary.get("displayname")

        # ---- MEDIUM ----
        medium = data.get("medium")

        # ---- CULTURE ----
        # displayculture includes style qualifier (e.g. "Maya (Codex style)")
        culture = data.get("displayculture")
        if not culture and data.get("cultures"):
            culture = data["cultures"][0].get("displayculture")

        # ---- PERIOD ----
        period = data.get("displayperiod")
        if not period and data.get("periods"):
            period = data["periods"][0].get("displayperiod")

        return {
            "title": title,
            "date_range": date_range,
            "description": description,
            "image_url": image_url,
            "maker": maker,
            "medium": medium,
            "culture": culture,
            "period": period,
        }

    except Exception as e:
        print(f"[ERROR] {objectid}: {e}")
        return None


# ---------- MAIN SCRIPT ----------


def prefill_metadata(limit=None, refill=False, single_id=None):
    """
    Args:
        limit:     Max rows to process (None = all).
        refill:    If True, re-fetch rows that already have a title (force refresh).
        single_id: If set, update only this objectid.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:

            if single_id:
                cur.execute(
                    "SELECT objectid FROM object_details WHERE objectid = %s",
                    (single_id,),
                )
            elif refill:
                query = "SELECT objectid FROM object_details"
                if limit:
                    query += f" LIMIT {limit}"
                cur.execute(query)
            else:
                # Default: only rows missing title
                query = "SELECT objectid FROM object_details WHERE title IS NULL"
                if limit:
                    query += f" LIMIT {limit}"
                cur.execute(query)

            rows = cur.fetchall()
            print(f"Found {len(rows)} artworks to update")

            for i, (objectid,) in enumerate(rows):
                metadata = fetch_artwork_metadata(objectid)

                if not metadata:
                    continue

                cur.execute(
                    """
                    UPDATE object_details
                    SET title      = %s,
                        date_range = %s,
                        description = %s,
                        image_url  = %s,
                        maker      = %s,
                        medium     = %s,
                        culture    = %s,
                        period     = %s
                    WHERE objectid = %s
                    """,
                    (
                        metadata["title"],
                        metadata["date_range"],
                        metadata["description"],
                        metadata["image_url"],
                        metadata["maker"],
                        metadata["medium"],
                        metadata["culture"],
                        metadata["period"],
                        objectid,
                    ),
                )

                print(f"[UPDATED] {objectid} — {metadata.get('title', 'untitled')}")

                # Commit every 25 rows
                if (i + 1) % 25 == 0:
                    conn.commit()
                    print(f"  → committed batch at row {i + 1}")

                # Be polite to the PUAM API
                time.sleep(0.1)

            conn.commit()
            print("Done.")


# ---------- RUN ----------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Prefill object_details metadata from PUAM API")
    parser.add_argument("--limit", type=int, default=None, help="Max rows to process")
    parser.add_argument("--refill", action="store_true", help="Re-fetch all rows, not just nulls")
    parser.add_argument("--id", type=int, default=None, dest="single_id", help="Update a single objectid")
    args = parser.parse_args()

    prefill_metadata(limit=args.limit, refill=args.refill, single_id=args.single_id)