# faceid-api

REST API PoC built with FastAPI 

## Stack

- Python + FastAPI
- DeepFace
- SQLite (via SQLAlchemy)
- In-memory cache (cachetools TTLCache)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/verify` | Face verification (1:1) |
| POST | `/identify` | Face identification against local DB (1:N) |
| POST | `/analyze` | Facial attribute analysis (age, gender, emotion, race) |
| POST | `/detect` | Face detection and bounding boxes |

## Requirements

- Python 3.10+
- pip

## Setup

```bash
git clone <repo-url>
cd deepface-api

pip install -r requirements.txt

cp .env.example .env
# Edit .env and set your API_KEY
```

## Running

```bash
uvicorn app.main:app --reload
```

API available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## Authentication

All endpoints require an `X-API-Key` header:

```
X-API-Key: your-api-key
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | `changeme` | API key for authentication |
| `FACE_DB_PATH` | `./face_db` | Directory with reference images for `/identify` |
| `MODEL_NAME` | `VGG-Face` | DeepFace recognition model |
| `DETECTOR_BACKEND` | `opencv` | Face detection backend |
| `DISTANCE_METRIC` | `cosine` | Similarity distance metric |
| `CACHE_TTL` | `300` | Cache TTL in seconds |
| `CACHE_MAXSIZE` | `256` | Max number of cached entries |

## Endpoint Reference

## License

