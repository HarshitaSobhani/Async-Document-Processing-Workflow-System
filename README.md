# DocFlow — Async Document Processing System

A production-style full-stack app: upload documents, process them async via Celery, track live progress via SSE + Redis Pub/Sub, review extracted output, finalize, and export.

## Stack
- **Frontend**: Next.js 14 + TypeScript
- **Backend**: Python + FastAPI
- **Database**: PostgreSQL
- **Background processing**: Celery
- **Messaging/state**: Redis (broker + Pub/Sub)
- **Progress delivery**: Server-Sent Events (SSE)

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (includes Docker Compose)
- OR: Python 3.11+, Node.js 20+, PostgreSQL 15, Redis 7

---

## Option A — Docker (Recommended, one command)

```bash
git clone <repo>
cd docflow
docker compose up --build
```

Open:
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

---

## Option B — Run locally without Docker

### 1. Start PostgreSQL and Redis

```bash
# macOS with Homebrew
brew install postgresql redis
brew services start postgresql
brew services start redis

# Ubuntu / WSL
sudo apt install postgresql redis-server -y
sudo service postgresql start
sudo service redis-server start
```

Create the database:
```bash
psql -U postgres -c "CREATE USER docflow WITH PASSWORD 'docflow123';"
psql -U postgres -c "CREATE DATABASE docflow OWNER docflow;"
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env`:
```
DATABASE_URL=postgresql://docflow:docflow123@localhost:5432/docflow
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

Start API:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Start Celery worker (new terminal)

```bash
cd backend
source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info
```

### 4. Frontend setup (new terminal)

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

### 5. Open http://localhost:3000

---

## Architecture

```
Browser
  ├── GET/POST → FastAPI (port 8000)
  │     ├── Upload: saves file, creates DB record, enqueues Celery task
  │     ├── SSE /progress: subscribes to Redis Pub/Sub channel, streams events
  │     └── REST: list, detail, review, finalize, retry, export
  │
  ├── Celery Worker (async)
  │     ├── Receives task from Redis broker
  │     ├── Runs multi-stage pipeline with sleep delays (simulated)
  │     ├── Publishes events to Redis Pub/Sub doc:progress:{id}
  │     └── Writes final structured output to PostgreSQL
  │
  └── Redis
        ├── Celery broker queue
        └── Pub/Sub channels for live progress
```

## Processing Stages

1. `job_queued` → Task enqueued
2. `job_started` → Worker picks up task
3. `document_received` → File validated
4. `parsing_started` → Text extraction begins
5. `parsing_completed` → Text ready
6. `field_extraction_started` → Structured fields extracted
7. `field_extraction_completed` → Fields ready
8. `storing_result` → Writing to database
9. `job_completed` / `job_failed` → Terminal state

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/documents/upload | Upload files |
| GET | /api/documents | List with search/filter/sort |
| GET | /api/documents/{id} | Get single document |
| GET | /api/documents/{id}/progress | SSE progress stream |
| GET | /api/documents/{id}/status | Polling fallback |
| PUT | /api/documents/{id}/review | Update reviewed fields |
| POST | /api/documents/{id}/finalize | Mark as finalized |
| POST | /api/documents/{id}/retry | Retry failed job |
| GET | /api/documents/{id}/export/json | Export as JSON |
| GET | /api/documents/{id}/export/csv | Export as CSV |

## Assumptions & Tradeoffs

- Text extraction is simulated for non-text files (replace with PyMuPDF, pdfminer, etc.)
- SSE is used over WebSockets for simplicity (no bidirectional needed)
- No auth (bonus feature)
- Files stored on local disk (swap for S3/GCS in production)
- Retry uses Celery's built-in retry with 10s cooldown

## Limitations

- No auth/authorization
- File storage is local (not S3-backed)
- Large file OCR not implemented
- Single worker node (scale with more Celery workers)
