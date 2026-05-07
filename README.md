# PUAM-ArtScape
A Geo-Spatial Campus Art Discovery Platform

## Running locally

The app has a Flask backend (`app/`) and a React + Vite frontend (`frontend/`). For development, run them as two separate processes.

### Backend

From the project root:

```bash
pip install -r requirements.txt
python3 runserver.py
```

Defaults to port `8000` (override with `B_PORT` in `.env`). Requires a `.env` file with `DATABASE_URL`, `APP_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, and Cloudinary credentials.

### Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

Defaults to port `3000` (override with `F_PORT`). To build for production:

```bash
npm run build
```

## Running tests

### Backend (pytest)

From the project root:

```bash
python3 -m pytest tests/
```

### Frontend (vitest)

From `frontend/`:

```bash
npm test                 
npm run test:watch        
npm run test:coverage    
 # HTML coverage report is stored at frontend/coverage/index.html
```
