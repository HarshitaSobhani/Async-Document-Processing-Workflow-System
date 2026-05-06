from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api.documents import router as doc_router
import app.models.document  # ensure models are registered

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="DocFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(doc_router)

@app.get("/health")
def health():
    return {"status": "ok"}
