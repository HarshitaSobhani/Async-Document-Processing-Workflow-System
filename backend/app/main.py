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

# API routes first
app.include_router(doc_router)

@app.get("/health")
def health():
    return {"status": "ok"}

# Static files — only mount _next assets directory
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend_out")

if os.path.exists(STATIC_DIR):
    # Serve Next.js static assets
    app.mount("/_next", StaticFiles(directory=os.path.join(STATIC_DIR, "_next")), name="next-assets")

    # Serve all frontend pages via catch-all
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try exact file first
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Try with .html extension
        html_path = file_path + ".html"
        if os.path.isfile(html_path):
            return FileResponse(html_path)
        # Fallback to index.html
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
