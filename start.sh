#!/bin/bash
set -e

echo "==> Starting PostgreSQL..."
service postgresql start
sleep 3

echo "==> Setting up database..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='docflow'\" | grep -q 1 || psql -c \"CREATE USER docflow WITH PASSWORD 'docflow123';\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='docflow'\" | grep -q 1 || psql -c \"CREATE DATABASE docflow OWNER docflow;\""

echo "==> Starting Redis..."
redis-server --daemonize yes --bind 127.0.0.1
sleep 2

echo "==> Starting Celery worker..."
cd /app/backend
export DATABASE_URL=postgresql://docflow:docflow123@localhost:5432/docflow
export REDIS_URL=redis://localhost:6379/0
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/0
celery -A app.workers.celery_app worker --loglevel=info --detach --logfile=/tmp/celery.log --pidfile=/tmp/celery.pid

echo "==> Starting FastAPI on port 8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
