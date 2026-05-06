FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib \
    redis-server \
    curl gnupg \
    libpq-dev gcc \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Build Next.js static export
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
ARG NEXT_PUBLIC_API_URL=/
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN cd frontend && npm run build

# Copy backend FIRST, then copy static files into it
COPY backend/ ./backend/
RUN mkdir -p backend/frontend_out && cp -r frontend/out/. backend/frontend_out/

RUN mkdir -p backend/uploads

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 8000
CMD ["./start.sh"]
