import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum

class JobStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    finalized = "finalized"

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.queued, nullable=False)
    celery_task_id = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)

    # Processing output
    extracted_title = Column(String, nullable=True)
    extracted_category = Column(String, nullable=True)
    extracted_summary = Column(Text, nullable=True)
    extracted_keywords = Column(JSON, nullable=True)
    raw_text = Column(Text, nullable=True)
    structured_output = Column(JSON, nullable=True)

    # Finalization
    reviewed_output = Column(JSON, nullable=True)
    is_finalized = Column(String, default="false")
    finalized_at = Column(DateTime, nullable=True)

    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
