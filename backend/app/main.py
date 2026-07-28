import os
from datetime import datetime
from typing import List

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import ComplaintRecord
from .schemas import (
    AnalysisResponse,
    Complaint,
    ComplaintCreate,
    ComplaintUpdate,
    StatsResponse,
)
from .services.ai_pipeline import analyze_complaint

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AIVOA Complaint Copilot",
    version="2.0.0",
    description="AI-powered pharmaceutical customer complaint management system.",
)

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
def health_check() -> dict:
    groq_configured = bool(os.getenv("GROQ_API_KEY", "").strip())
    return {
        "status": "ok",
        "version": "2.0.0",
        "ai_mode": "llm" if groq_configured else "heuristic",
    }


# ─────────────────────────────────────────────────────────────────────────────
# AI Analysis
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/analyze-complaint", response_model=AnalysisResponse, tags=["AI"])
def analyze_endpoint(
    text: str | None = Form(default=None),
    uploaded_file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    """
    Accepts complaint text (form field) or an uploaded .txt / .md / .pdf file.
    Runs the LangGraph pipeline and returns structured analysis.
    """
    raw_text = text or ""

    if uploaded_file is not None:
        filename = (uploaded_file.filename or "").lower()
        file_bytes = uploaded_file.file.read()

        if filename.endswith(".pdf"):
            # Use pypdf to extract text
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(file_bytes))
                pages_text = [page.extract_text() or "" for page in reader.pages]
                raw_text = "\n".join(pages_text) or raw_text
            except Exception:
                raw_text = file_bytes.decode("utf-8", errors="ignore") or raw_text
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore") or raw_text

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Provide complaint text or upload a file.")

    existing_records = db.query(ComplaintRecord).all()
    existing_dicts = [
        {
            "complaint_number": r.complaint_number,
            "product": r.product,
            "batch": r.batch,
            "customer": r.customer,
            "description": r.description,
        }
        for r in existing_records
    ]

    payload = analyze_complaint(raw_text, existing_records=existing_dicts)
    return payload


# ─────────────────────────────────────────────────────────────────────────────
# Complaint CRUD
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/complaints/stats", response_model=StatsResponse, tags=["Complaints"])
def get_stats(db: Session = Depends(get_db)):
    """Aggregate statistics for the dashboard."""
    records = db.query(ComplaintRecord).all()
    total = len(records)
    open_count = sum(1 for r in records if r.status == "Open")
    under_inv = sum(1 for r in records if r.status == "Under Investigation")
    closed = sum(1 for r in records if r.status == "Closed")
    high = sum(1 for r in records if r.risk_level == "High")
    medium = sum(1 for r in records if r.risk_level == "Medium")
    low = sum(1 for r in records if r.risk_level == "Low")
    scores = [r.completeness_score for r in records if r.completeness_score is not None]
    avg_completeness = round(sum(scores) / len(scores), 1) if scores else 0.0
    reg_report = sum(1 for r in records if r.regulatory_reportable)
    return StatsResponse(
        total=total,
        open=open_count,
        under_investigation=under_inv,
        closed=closed,
        high_risk=high,
        medium_risk=medium,
        low_risk=low,
        avg_completeness=avg_completeness,
        regulatory_reportable=reg_report,
    )


@app.get("/api/complaints", response_model=List[Complaint], tags=["Complaints"])
def list_complaints(db: Session = Depends(get_db)):
    return db.query(ComplaintRecord).order_by(ComplaintRecord.created_at.desc()).all()


@app.post("/api/complaints", response_model=Complaint, tags=["Complaints"])
def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)):
    record = ComplaintRecord(**payload.model_dump())
    db.add(record)
    try:
        db.commit()
        db.refresh(record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return record


@app.get("/api/complaints/{complaint_id}", response_model=Complaint, tags=["Complaints"])
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    record = db.query(ComplaintRecord).filter(ComplaintRecord.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return record


@app.put("/api/complaints/{complaint_id}", response_model=Complaint, tags=["Complaints"])
def update_complaint(complaint_id: int, payload: ComplaintUpdate, db: Session = Depends(get_db)):
    record = db.query(ComplaintRecord).filter(ComplaintRecord.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Complaint not found")
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(record, field, value)
    if payload.status == "Closed" and record.closed_at is None:
        record.closed_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()
    try:
        db.commit()
        db.refresh(record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return record


@app.delete("/api/complaints/{complaint_id}", tags=["Complaints"])
def delete_complaint(complaint_id: int, db: Session = Depends(get_db)):
    record = db.query(ComplaintRecord).filter(ComplaintRecord.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Complaint not found")
    db.delete(record)
    db.commit()
    return {"detail": "Complaint deleted"}
