"""
AIVOA Complaint Copilot — FastAPI Backend
==========================================
Endpoints:
  GET  /health
  POST /api/analyze-complaint          ← multipart: text + optional file (used by frontend)
  POST /api/documents/extract          ← raw file text extraction
  GET  /api/complaints/stats           ← dashboard statistics
  GET  /api/complaints                 ← list all complaints
  POST /api/complaints                 ← create complaint
  GET  /api/complaints/{id}            ← get single complaint
  PUT  /api/complaints/{id}            ← update complaint
  DELETE /api/complaints/{id}          ← delete complaint
"""
import json
import os
from datetime import datetime
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session
from pypdf import PdfReader
from io import BytesIO
from typing import Optional
from .database import Base, engine, get_db
from .models import Complaint
from .schemas import ComplaintCreate, ComplaintOut, ComplaintUpdate, StatsOut
from .services.ai_pipeline import analyze_complaint as run_pipeline

Base.metadata.create_all(bind=engine)

# ── Lightweight migration: add any columns that don't yet exist in an older DB ─
_NEW_COLUMNS = {
    "complaint_source": "VARCHAR(100) DEFAULT ''",
    "product_name": "VARCHAR(255) DEFAULT ''",
    "product_strength": "VARCHAR(100) DEFAULT ''",
    "batch_number": "VARCHAR(100) DEFAULT ''",
    "manufacturing_date": "VARCHAR(50) DEFAULT ''",
    "expiry_date": "VARCHAR(50) DEFAULT ''",
    "affected_quantity": "VARCHAR(100) DEFAULT ''",
    "originating_site": "VARCHAR(255) DEFAULT ''",
    "impacted_materials": "VARCHAR(255) DEFAULT ''",
    "country": "VARCHAR(100) DEFAULT ''",
    "complaint_date": "VARCHAR(30) DEFAULT ''",
    "received_date": "VARCHAR(30) DEFAULT ''",
    "customer_name": "VARCHAR(255) DEFAULT ''",
    "source_text": "TEXT DEFAULT ''",
    "severity": "VARCHAR(30) DEFAULT ''",
    "priority": "VARCHAR(30) DEFAULT ''",
    "quality_impact": "TEXT DEFAULT ''",
    "root_cause": "TEXT DEFAULT ''",
    "recommendations": "TEXT DEFAULT ''",
    "capa_actions": "TEXT DEFAULT ''",
    "ai_summary": "TEXT DEFAULT ''",
    "completeness_score": "INTEGER DEFAULT 0",
    "duplicate_flag": "BOOLEAN DEFAULT 0",
    "duplicate_reference": "VARCHAR(50) DEFAULT ''",
    "regulatory_reportable": "BOOLEAN DEFAULT 0",
    "investigation_notes": "TEXT DEFAULT ''",
    "assigned_to": "VARCHAR(255) DEFAULT ''",
    "updated_at": "DATETIME",
    "risk_score": "INTEGER DEFAULT 0",
    "ai_assessment": "TEXT DEFAULT '{}'",
}

with engine.begin() as conn:
    existing_cols = {c["name"] for c in inspect(conn).get_columns("complaints")}
    for col_name, col_def in _NEW_COLUMNS.items():
        if col_name not in existing_cols:
            conn.execute(text(f"ALTER TABLE complaints ADD COLUMN {col_name} {col_def}"))

app = FastAPI(title="AIVOA Complaint Copilot", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Serialisation helper ────────────────────────────────────────────────────

def _row_to_dict(row: Complaint) -> dict:
    """Convert a DB row to the response shape the frontend expects."""
    data = {}
    for col in ComplaintOut.model_fields:
        if col == "ai_assessment":
            data[col] = json.loads(row.ai_assessment or "{}")
        else:
            data[col] = getattr(row, col, None)
    # Extra fields not in ComplaintCreate but in ComplaintOut
    data["investigation_notes"] = row.investigation_notes or ""
    data["assigned_to"] = row.assigned_to or ""
    return data


# ── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "pipeline": "LangGraph", "model": "gemma2-9b-it / llama-3.3-70b-versatile"}


# ── AI Analysis — multipart (text + optional file) ──────────────────────────

@app.post("/api/analyze-complaint")
async def analyze_complaint_endpoint(
    text: Optional[str] = Form(default=None),
    uploaded_file: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
):
    """
    Accepts multipart form:
      - text: raw complaint text / pasted email
      - uploaded_file: .txt / .pdf file

    Runs the 8-node LangGraph pipeline and returns structured analysis.
    """
    complaint_text = ""

    # Extract text from uploaded file
    if uploaded_file and uploaded_file.filename:
        raw = await uploaded_file.read()
        fname = uploaded_file.filename.lower()
        if fname.endswith(".pdf"):
            try:
                complaint_text = "\n".join(
                    page.extract_text() or "" for page in PdfReader(BytesIO(raw)).pages
                )
            except Exception:
                complaint_text = raw.decode("utf-8", errors="replace")
        else:
            complaint_text = raw.decode("utf-8", errors="replace")

    # Merge with pasted text
    if text and text.strip():
        complaint_text = (complaint_text + "\n" + text).strip() if complaint_text else text.strip()

    if not complaint_text.strip():
        raise HTTPException(422, "No complaint text provided. Paste text or upload a file.")

    # Fetch existing complaints for duplicate detection
    existing = [
        {
            "complaint_number": c.complaint_number,
            "product": c.product_name,
            "batch": c.batch_number,
            "description": c.description,
        }
        for c in db.query(Complaint).order_by(Complaint.created_at.desc()).limit(30).all()
    ]

    result = run_pipeline(complaint_text[:30000], existing_records=existing)
    return result


# ── Raw document extraction ─────────────────────────────────────────────────

@app.post("/api/documents/extract")
async def extract_document(file: UploadFile = File(...)):
    raw = await file.read()
    fname = (file.filename or "").lower()
    if fname.endswith(".pdf"):
        text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(raw)).pages)
    else:
        text = raw.decode("utf-8", errors="replace")
    if not text.strip():
        raise HTTPException(422, "No readable text found in the uploaded file.")
    return {"filename": file.filename, "text": text[:30000]}


# ── Stats ───────────────────────────────────────────────────────────────────

@app.get("/api/complaints/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    all_rows = db.query(Complaint).all()
    total = len(all_rows)
    open_count = sum(1 for r in all_rows if (r.status or "").lower() == "open")
    under_inv = sum(1 for r in all_rows if (r.status or "").lower() == "under investigation")
    closed = sum(1 for r in all_rows if (r.status or "").lower() == "closed")
    high_risk = sum(1 for r in all_rows if (r.risk_level or "").lower() == "high")
    reg_rep = sum(1 for r in all_rows if r.regulatory_reportable)
    avg_comp = int(sum(r.completeness_score or 0 for r in all_rows) / total) if total else 0
    return StatsOut(
        total=total,
        open=open_count,
        under_investigation=under_inv,
        closed=closed,
        high_risk=high_risk,
        regulatory_reportable=reg_rep,
        avg_completeness=avg_comp,
    )


# ── CRUD ────────────────────────────────────────────────────────────────────

@app.get("/api/complaints", response_model=list[ComplaintOut])
def list_complaints(db: Session = Depends(get_db)):
    rows = db.query(Complaint).order_by(Complaint.created_at.desc()).all()
    return [_row_to_dict(r) for r in rows]


@app.post("/api/complaints", response_model=ComplaintOut, status_code=201)
def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)):
    seq = db.query(Complaint).count() + 1
    number = f"CC-{datetime.utcnow():%Y%m%d}-{seq:04d}"
    ai_json = json.dumps(payload.ai_assessment) if payload.ai_assessment else "{}"
    data = payload.model_dump(exclude={"ai_assessment"})
    row = Complaint(complaint_number=number, ai_assessment=ai_json, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


@app.get("/api/complaints/{complaint_id}", response_model=ComplaintOut)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    row = db.get(Complaint, complaint_id)
    if not row:
        raise HTTPException(404, "Complaint not found")
    return _row_to_dict(row)


@app.put("/api/complaints/{complaint_id}", response_model=ComplaintOut)
def update_complaint(complaint_id: int, payload: ComplaintUpdate, db: Session = Depends(get_db)):
    row = db.get(Complaint, complaint_id)
    if not row:
        raise HTTPException(404, "Complaint not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row_to_dict(row)


@app.delete("/api/complaints/{complaint_id}", status_code=204)
def delete_complaint(complaint_id: int, db: Session = Depends(get_db)):
    row = db.get(Complaint, complaint_id)
    if not row:
        raise HTTPException(404, "Complaint not found")
    db.delete(row)
    db.commit()
