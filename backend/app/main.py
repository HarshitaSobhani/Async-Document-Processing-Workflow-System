import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base
from app.api.documents import router as doc_router
import app.models.document

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DocFlow API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(doc_router)

@app.get("/health")
def health():
    return {"status": "ok"}

# Serve Next.js static export — must be after API routes
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend_out")
if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
