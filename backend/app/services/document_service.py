import os
import uuid
import aiofiles
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from fastapi import UploadFile

from app.models.document import Document, JobStatus
from app.schemas.document import ReviewUpdate
from app.config import settings

async def save_upload(file: UploadFile) -> tuple[str, int]:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    size = 0
    async with aiofiles.open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)
            size += len(chunk)

    return file_path, size

def create_document(db: Session, filename: str, original_filename: str, file_path: str, file_type: str, file_size: int) -> Document:
    doc = Document(
        filename=filename,
        original_filename=original_filename,
        file_path=file_path,
        file_type=file_type or "application/octet-stream",
        file_size=file_size,
        status=JobStatus.queued,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

def list_documents(db: Session, status: Optional[str] = None, search: Optional[str] = None, sort: str = "created_at", page: int = 1, page_size: int = 20):
    q = db.query(Document)
    if status:
        q = q.filter(Document.status == status)
    if search:
        q = q.filter(or_(
            Document.original_filename.ilike(f"%{search}%"),
            Document.extracted_title.ilike(f"%{search}%"),
            Document.extracted_category.ilike(f"%{search}%"),
        ))
    sort_col = getattr(Document, sort, Document.created_at)
    q = q.order_by(sort_col.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return items, total

def get_document(db: Session, document_id: str) -> Optional[Document]:
    return db.query(Document).filter(Document.id == document_id).first()

def update_review(db: Session, doc: Document, data: ReviewUpdate) -> Document:
    doc.reviewed_output = {
        "title": data.title or doc.extracted_title,
        "category": data.category or doc.extracted_category,
        "summary": data.summary or doc.extracted_summary,
        "keywords": data.keywords or doc.extracted_keywords,
    }
    db.commit()
    db.refresh(doc)
    return doc

def finalize_document(db: Session, doc: Document) -> Document:
    doc.is_finalized = "true"
    doc.finalized_at = datetime.utcnow()
    doc.status = JobStatus.finalized
    db.commit()
    db.refresh(doc)
    return doc

def retry_document(db: Session, doc: Document) -> Document:
    doc.status = JobStatus.queued
    doc.error_message = None
    doc.celery_task_id = None
    db.commit()
    db.refresh(doc)
    return doc
