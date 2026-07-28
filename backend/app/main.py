import os
from typing import List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db
from .models import ComplaintRecord
from .schemas import AnalysisResponse, Complaint, ComplaintCreate
from .services.ai_pipeline import analyze_complaint

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AIVOA Complaint Copilot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/api/analyze-complaint", response_model=AnalysisResponse)
def analyze_endpoint(
    text: str | None = Form(default=None),
    uploaded_file: UploadFile | None = File(default=None),
    db: Session = None,
):
    if db is None:
        db = SessionLocal()
    try:
        raw_text = text or ""
        if uploaded_file is not None:
            contents = uploaded_file.file.read().decode("utf-8", errors="ignore")
            raw_text = contents or raw_text
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="Provide complaint text or upload a file")

        existing_records = db.query(ComplaintRecord).all()
        payload = analyze_complaint(raw_text, existing_records=[{key: getattr(item, key) for key in ["complaint_number", "product", "batch", "customer", "description"]} for item in existing_records])
        return payload
    finally:
        if db is not None and db is not SessionLocal():
            db.close()


@app.get("/api/complaints", response_model=List[Complaint])
def list_complaints(db: Session = None):
    if db is None:
        db = SessionLocal()
    try:
        records = db.query(ComplaintRecord).order_by(ComplaintRecord.created_at.desc()).all()
        return records
    finally:
        if db is not None and db is not SessionLocal():
            db.close()


@app.post("/api/complaints", response_model=Complaint)
def create_complaint(payload: ComplaintCreate, db: Session = None):
    if db is None:
        db = SessionLocal()
    try:
        record = ComplaintRecord(**payload.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if db is not None and db is not SessionLocal():
            db.close()


@app.get("/api/complaints/{complaint_id}", response_model=Complaint)
def get_complaint(complaint_id: int, db: Session = None):
    if db is None:
        db = SessionLocal()
    try:
        record = db.query(ComplaintRecord).filter(ComplaintRecord.id == complaint_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Complaint not found")
        return record
    finally:
        if db is not None and db is not SessionLocal():
            db.close()
