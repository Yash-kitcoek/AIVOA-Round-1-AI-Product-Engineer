import json
import os
from datetime import datetime
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pypdf import PdfReader
from io import BytesIO
from .agent import complaint_graph
from .database import Base, engine, get_db
from .models import Complaint
from .schemas import AnalysisRequest, ComplaintCreate, ComplaintOut

Base.metadata.create_all(bind=engine)
app = FastAPI(title="AIVOA Complaint Copilot", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def to_out(row: Complaint):
    data = {key: getattr(row, key) for key in ComplaintOut.model_fields if key not in {"ai_assessment"}}
    data["ai_assessment"] = json.loads(row.ai_assessment or "{}")
    return data


@app.get("/health")
def health(): return {"status": "ok", "agent": "LangGraph", "model": "gemma2-9b-it (configure GROQ_API_KEY)"}

@app.post("/api/complaints/analyze")
def analyze(payload: AnalysisRequest, db: Session = Depends(get_db)):
    prior = db.query(Complaint).order_by(Complaint.created_at.desc()).limit(20).all()
    words = set(payload.text.lower().split())
    existing = [{"complaint_number": c.complaint_number, "product_name": c.product_name, "similarity": min(95, int(100 * len(words & set(c.description.lower().split())) / max(1, len(words))))} for c in prior]
    result = complaint_graph.invoke({"text": payload.text, "existing": [x for x in existing if x["similarity"] >= 18]})
    return {"complaint": result["complaint"], "assessment": result["assessment"]}

@app.post("/api/documents/extract")
async def extract_document(file: UploadFile = File(...)):
    raw = await file.read()
    if file.filename and file.filename.lower().endswith(".pdf"):
        text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(raw)).pages)
    else:
        text = raw.decode("utf-8", errors="replace")
    if not text.strip(): raise HTTPException(422, "No readable text found in the uploaded file")
    return {"filename": file.filename, "text": text[:30000]}

@app.post("/api/complaints", response_model=ComplaintOut, status_code=201)
def create(payload: ComplaintCreate, db: Session = Depends(get_db)):
    number = f"CC-{datetime.utcnow():%Y%m%d}-{db.query(Complaint).count()+1:04d}"
    row = Complaint(complaint_number=number, **payload.model_dump(exclude={"ai_assessment"}), ai_assessment=json.dumps(payload.ai_assessment))
    db.add(row); db.commit(); db.refresh(row)
    return to_out(row)

@app.get("/api/complaints", response_model=list[ComplaintOut])
def list_complaints(db: Session = Depends(get_db)):
    return [to_out(x) for x in db.query(Complaint).order_by(Complaint.created_at.desc()).all()]

@app.get("/api/complaints/{complaint_id}", response_model=ComplaintOut)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    row = db.get(Complaint, complaint_id)
    if not row: raise HTTPException(404, "Complaint not found")
    return to_out(row)
