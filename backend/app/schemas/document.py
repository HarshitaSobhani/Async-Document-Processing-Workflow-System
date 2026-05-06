from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from app.models.document import JobStatus

class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_type: str
    file_size: int

class DocumentCreate(DocumentBase):
    file_path: str

class DocumentOut(BaseModel):
    id: UUID
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: JobStatus
    retry_count: int
    extracted_title: Optional[str] = None
    extracted_category: Optional[str] = None
    extracted_summary: Optional[str] = None
    extracted_keywords: Optional[List[str]] = None
    raw_text: Optional[str] = None
    structured_output: Optional[Any] = None
    reviewed_output: Optional[Any] = None
    is_finalized: str = "false"
    finalized_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DocumentList(BaseModel):
    items: List[DocumentOut]
    total: int

class ReviewUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    keywords: Optional[List[str]] = None

class ProgressEvent(BaseModel):
    document_id: str
    event: str
    message: str
    progress: int  # 0-100
    timestamp: str
