import csv
import json
import io
import redis
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document, JobStatus
from app.schemas.document import DocumentOut, DocumentList, ReviewUpdate
from app.services import document_service as svc
from app.workers.tasks import process_document
from app.config import settings

router = APIRouter(prefix="/api/documents", tags=["documents"])
redis_client = redis.from_url(settings.REDIS_URL)

@router.post("/upload", response_model=list[DocumentOut])
async def upload_documents(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    results = []
    for file in files:
        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(413, f"{file.filename} exceeds 50MB limit")

        file_path, file_size = await svc.save_upload(file)
        content_type = file.content_type or "application/octet-stream"

        doc = svc.create_document(
            db,
            filename=file_path.split("/")[-1],
            original_filename=file.filename or "unknown",
            file_path=file_path,
            file_type=content_type,
            file_size=file_size,
        )

        task = process_document.delay(str(doc.id))
        doc.celery_task_id = task.id
        db.commit()
        db.refresh(doc)
        results.append(doc)

    return results

@router.get("", response_model=DocumentList)
def list_documents(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("created_at"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = svc.list_documents(db, status, search, sort, page, page_size)
    return {"items": items, "total": total}

@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = svc.get_document(db, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc

@router.get("/{document_id}/progress")
async def stream_progress(document_id: str):
    """SSE endpoint for real-time progress events."""
    async def event_generator():
        pubsub = redis_client.pubsub()
        channel = f"doc:progress:{document_id}"
        pubsub.subscribe(channel)

        # Send cached status first
        cached = redis_client.get(f"doc:status:{document_id}")
        if cached:
            yield f"data: {cached.decode()}\n\n"

        timeout = 120  # 2 min max
        start = asyncio.get_event_loop().time()

        try:
            while True:
                if asyncio.get_event_loop().time() - start > timeout:
                    break
                message = pubsub.get_message(timeout=0.5)
                if message and message["type"] == "message":
                    yield f"data: {message['data'].decode()}\n\n"
                    data = json.loads(message["data"])
                    if data.get("event") in ("job_completed", "job_failed"):
                        break
                await asyncio.sleep(0.1)
        finally:
            pubsub.unsubscribe(channel)
            pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

@router.get("/{document_id}/status")
def get_status(document_id: str):
    """Polling fallback for progress."""
    cached = redis_client.get(f"doc:status:{document_id}")
    if cached:
        return json.loads(cached)
    return {"event": "unknown", "progress": 0}

@router.put("/{document_id}/review", response_model=DocumentOut)
def update_review(document_id: str, data: ReviewUpdate, db: Session = Depends(get_db)):
    doc = svc.get_document(db, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in (JobStatus.completed, JobStatus.finalized):
        raise HTTPException(400, "Document not yet processed")
    return svc.update_review(db, doc, data)

@router.post("/{document_id}/finalize", response_model=DocumentOut)
def finalize(document_id: str, db: Session = Depends(get_db)):
    doc = svc.get_document(db, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in (JobStatus.completed, JobStatus.finalized):
        raise HTTPException(400, "Document not yet processed")
    return svc.finalize_document(db, doc)

@router.post("/{document_id}/retry", response_model=DocumentOut)
def retry(document_id: str, db: Session = Depends(get_db)):
    doc = svc.get_document(db, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != JobStatus.failed:
        raise HTTPException(400, "Only failed jobs can be retried")
    doc = svc.retry_document(db, doc)
    task = process_document.delay(str(doc.id))
    doc.celery_task_id = task.id
    db.commit()
    db.refresh(doc)
    return doc

@router.get("/{document_id}/export/{fmt}")
def export(document_id: str, fmt: str, db: Session = Depends(get_db)):
    doc = svc.get_document(db, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in (JobStatus.completed, JobStatus.finalized):
        raise HTTPException(400, "Document not yet processed")

    output = doc.reviewed_output or doc.structured_output or {}

    if fmt == "json":
        content = json.dumps({
            "id": str(doc.id),
            "original_filename": doc.original_filename,
            "status": doc.status,
            "output": output,
            "exported_at": datetime.utcnow().isoformat(),
        }, indent=2)
        return StreamingResponse(
            io.StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={doc.id}.json"},
        )

    elif fmt == "csv":
        si = io.StringIO()
        writer = csv.writer(si)
        writer.writerow(["Field", "Value"])
        writer.writerow(["ID", str(doc.id)])
        writer.writerow(["Filename", doc.original_filename])
        writer.writerow(["Status", doc.status])
        for k, v in output.items():
            if isinstance(v, (list, dict)):
                writer.writerow([k, json.dumps(v)])
            else:
                writer.writerow([k, v])
        si.seek(0)
        return StreamingResponse(
            si,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={doc.id}.csv"},
        )

    raise HTTPException(400, "Invalid format. Use json or csv")
