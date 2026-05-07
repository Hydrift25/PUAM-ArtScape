"""Shared test fixtures.

Sets fake environment variables BEFORE importing the Flask app so that
config values like DATABASE_URL, GOOGLE_CLIENT_ID, etc., are present when
modules are imported. This avoids any need for real credentials in tests.
"""

import os
import sys
from pathlib import Path

# Ensure project root is on sys.path so `import app...` resolves regardless
# of where pytest is invoked from.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Fake env values for modules that read os.getenv at import time.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("APP_SECRET_KEY", "test-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("CLOUDINARY_URL", "cloudinary://k:s@test")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("VERIFY_MIN_DIST_M", "50")

import pytest


@pytest.fixture
def app():
    from app.routes.prelimroutes import app as flask_app

    flask_app.config.update(TESTING=True)
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def logged_in_client(client):
    """A test client with a fake user already in the session."""
    with client.session_transaction() as sess:
        sess["user"] = {
            "id": 42,
            "google_sub": "sub-42",
            "email": "test@example.com",
            "display_name": "Test User",
            "avatar_url": "https://example.com/a.png",
            "created_at": "2024-01-01T00:00:00",
        }
    return client


class FakeCursor:
    """Minimal cursor mock — supports execute / fetchone / fetchall."""

    def __init__(self, rows=None):
        self._rows = list(rows) if rows is not None else []
        self.executed = []

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeConnection:
    def __init__(self, rows=None):
        self.cursor_obj = FakeCursor(rows)
        self.committed = False
        self.closed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def fake_connect(monkeypatch):
    """Patches psycopg.connect inside app.database.db with a configurable fake.

    Returns a `setup(rows)` function that installs a connection whose cursor
    will return `rows` from fetchone/fetchall. Tests can call it once or
    repeatedly; a list of FakeConnection objects is exposed via `.conns` so
    tests can assert on commits / executed queries.
    """
    from app.database import db as db_module

    state = {"rows": [], "conns": []}

    def _connect(_url):
        conn = FakeConnection(state["rows"])
        state["conns"].append(conn)
        return conn

    monkeypatch.setattr(db_module.psycopg, "connect", _connect)

    class Handle:
        @staticmethod
        def setup(rows):
            state["rows"] = rows

        @property
        def conns(self):
            return state["conns"]

        @property
        def last(self):
            return state["conns"][-1] if state["conns"] else None

    return Handle()
