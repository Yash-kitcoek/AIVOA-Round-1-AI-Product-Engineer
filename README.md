# AIVOA – AI-Powered Customer Complaint Management System
### Round 1 · AI Product Engineer Internship Submission

> **Built for:** Pharmaceutical Manufacturing (API & FDF) Quality Management Systems  
> **AI Stack:** LangGraph · Groq gemma2-9b-it · FastAPI · React + Redux

---

## 📌 Project Overview

This system automates the intake, triage, root cause analysis, and CAPA generation for customer complaints in a pharmaceutical QMS. It replaces manual complaint logging with an AI Copilot that reads complaint emails/documents and populates structured fields in seconds.

---

## 🏗️ System Architecture — Full Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER (QA Officer / Pharmacist)                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REACT FRONTEND  (Vite + Redux)                         │
│                                                                             │
│   ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│   │  New Complaint  │   │  Complaint        │   │  Dashboard             │  │
│   │  Form (5 Secs)  │   │  Register Table  │   │  Stats + Recent List   │  │
│   │                 │   │  Search/Filter   │   │  Quick Actions         │  │
│   │  - 5 Form Secs  │   │  CRUD Controls   │   │  AI Copilot Status     │  │
│   │  - Upload/Paste │   └──────────────────┘   └────────────────────────┘  │
│   │  - AI Copilot   │                                                       │
│   │  - Chat Panel   │                                                       │
│   └────────┬────────┘                                                       │
│            │  Redux Thunk dispatches API calls                              │
│            │  (complaintsSlice.js → axios FormData / JSON)                  │
└────────────┼────────────────────────────────────────────────────────────────┘
             │
             │  HTTP Requests (localhost:8000)
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND  (Python 3.13)                        │
│                                                                             │
│  POST /api/analyze-complaint   ← multipart: text + optional PDF/TXT file   │
│  GET  /api/complaints/stats    ← dashboard statistics                       │
│  GET  /api/complaints          ← list all (with created_at DESC order)      │
│  POST /api/complaints          ← save analysed complaint to DB              │
│  PUT  /api/complaints/{id}     ← update status / investigation notes        │
│  DELETE /api/complaints/{id}   ← delete complaint                           │
│  GET  /health                  ← liveness check                             │
│                                                                             │
│  Middleware: CORS (React origin allowed)                                    │
│  Serialiser: _row_to_dict() → aligns DB row → frontend JSON shape           │
│  Auto-migration: ALTER TABLE for new columns (legacy DB safe)               │
└────────────────────────────────────────────────────────────────────────────-┘
             │
             │  analyze_complaint(text, existing_records)
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI PIPELINE  (LangGraph + Groq)                          │
│                                                                             │
│   START                                                                     │
│     │                                                                       │
│     ▼                                                                       │
│   ┌──────────────┐                                                          │
│   │  1. EXTRACT  │  gemma2-9b-it extracts structured fields from raw text   │
│   │              │  → product, batch, customer, type, severity, date        │
│   │  Fallback:   │  Heuristic regex + keyword rules (no API key needed)     │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │ 2. SUMMARIZE │  gemma2-9b-it writes executive AI summary (2-3 lines)    │
│   │              │  → ai_summary field shown in form Section 5              │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────────┐                                                      │
│   │ 3. COMPLETENESS  │  Checks 6 required fields (product, batch,           │
│   │                  │  customer, type, date, description)                  │
│   │                  │  → completeness_score (0–100%) + missing_fields list │
│   └──────┬───────────┘                                                      │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │ 4. DUPLICATE │  Jaccard similarity vs last 30 complaints in DB          │
│   │   DETECTION  │  → duplicate_flag, duplicate_reference, similarity score │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │ 5. ROOT CAUSE│  gemma2-9b-it suggests 3 probable root cause hypotheses  │
│   │   ANALYSIS   │  (GMP-specific: manufacturing, supply chain, analytical) │
│   │  Fallback:   │  Heuristic lookup by complaint type                      │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │  6. RISK     │  Rule-based: severity + regulatory_reportable +          │
│   │  SCORING     │  duplicate_flag + completeness → Low / Medium / High     │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────────┐                                                      │
│   │ 7. CAPA &        │  gemma2-9b-it writes 3–5 CAPA actions                │
│   │  RECOMMENDATION  │  (Corrective + Preventive, GMP-specific)             │
│   │                  │  + quality_impact statement                          │
│   │  Fallback:       │  Heuristic CAPA by type + risk                       │
│   └──────┬───────────┘                                                      │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │  8. FINAL    │  Assembles complete AnalysisResponse payload             │
│   │   ASSEMBLY   │  → all fields + evidence + confidence metadata           │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│         END                                                                 │
└──────────┼──────────────────────────────────────────────────────────────────┘
           │
           │  JSON response → FastAPI → HTTP 200
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REDUX STATE UPDATE  (Frontend)                         │
│                                                                             │
│  analyzeComplaint.fulfilled → state.analysis = payload                      │
│                                                                             │
│  React useEffect watches analysis →                                         │
│  Populates all 25+ form fields automatically                                │
│  Shows AI Summary, Risk Panel, Completeness Bar                             │
│  Adds success message to AI Assistant chat                                  │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           │  User reviews → clicks "Save Complaint"
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE  (SQLite dev / Neon PostgreSQL prod)          │
│                                                                             │
│  Table: complaints (37 columns)                                             │
│  complaint_number (auto: CC-YYYYMMDD-0001)                                  │
│  product_name, batch_number, severity, risk_level                           │
│  ai_summary, root_cause, capa_actions, quality_impact                       │
│  completeness_score, duplicate_flag, regulatory_reportable                  │
│  status (Open / Under Investigation / Closed)                               │
│  created_at, updated_at                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Summary

```
User Input (text / PDF)
        │
        ▼
  Redux dispatch(analyzeComplaint(FormData))
        │
        ▼
  POST /api/analyze-complaint   [FastAPI multipart endpoint]
        │
        ├─ PDF? → pypdf extracts text
        ├─ TXT? → raw decode
        └─ Merges with pasted text
        │
        ▼
  LangGraph pipeline (8 nodes, ~3–8 seconds)
        │
        ▼
  JSON response (25+ fields)
        │
        ▼
  Redux state.analysis updated
        │
        ▼
  React useEffect populates form draft
        │
        ▼
  User reviews & saves
        │
        ▼
  POST /api/complaints → SQLAlchemy → Database
        │
        ▼
  Redux fetchComplaints() refreshes register + dashboard
```

---

## 📁 Project Structure

```
AIVOA – Round 1 AI Product Engineer/
│
├── frontend/                        # React + Vite + Redux
│   ├── src/
│   │   ├── App.jsx                  # All views: Dashboard, New, Register, Detail
│   │   ├── index.css                # Full design system (dark glassmorphism)
│   │   ├── main.jsx                 # React entry point + Redux Provider
│   │   └── features/complaints/
│   │       ├── complaintsSlice.js   # Redux slice: state + all 6 async thunks
│   │       └── store.js             # Redux store configuration
│   ├── index.html                   # HTML shell + Inter font + SEO meta
│   └── vite.config.js               # Vite config with React plugin
│
├── backend/                         # Python + FastAPI
│   ├── app/
│   │   ├── main.py                  # FastAPI app: 7 endpoints + CORS + migration
│   │   ├── models.py                # SQLAlchemy ORM: Complaint table (37 cols)
│   │   ├── schemas.py               # Pydantic schemas: ComplaintCreate/Out/Update
│   │   ├── database.py              # DB engine: SQLite (dev) / Neon PG (prod)
│   │   └── services/
│   │       └── ai_pipeline.py       # LangGraph 8-node pipeline + LLM helpers
│   ├── sample_complaints/           # 5 realistic pharma complaint text files
│   │   ├── complaint_contamination.txt
│   │   ├── complaint_dissolution_failure.txt
│   │   ├── complaint_adverse_event.txt
│   │   ├── complaint_stability_failure.txt
│   │   └── complaint_labeling.txt
│   ├── requirements.txt             # All Python dependencies
│   └── .env                         # GROQ_API_KEY, DATABASE_URL
│
└── README.md
```

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend UI | React 18 + Vite | Component-based SPA |
| State Management | Redux Toolkit | Global state, async thunks |
| Backend API | FastAPI (Python 3.13) | REST endpoints, CORS, validation |
| ORM | SQLAlchemy 2.0 | DB abstraction, auto-migration |
| Database (dev) | SQLite | Zero-config local storage |
| Database (prod) | Neon PostgreSQL | Serverless cloud Postgres |
| AI Framework | LangGraph | 8-node stateful AI workflow |
| LLM | Groq gemma2-9b-it | Structured extraction, CAPA, summaries |
| LLM Fallback | llama-3.3-70b-versatile | Large context processing |
| PDF Extraction | pypdf | Reads uploaded PDF complaints |
| Validation | Pydantic v2 | Request/response schema validation |

---

## 🚀 How to Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API Key from [console.groq.com](https://console.groq.com)

### Step 1 — Configure Environment
```bash
# In backend/.env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=sqlite:///./aivoa.db    # local SQLite
# or for Neon PostgreSQL:
# DATABASE_URL=postgresql://user:pass@host/dbname
```

### Step 2 — Start Backend
```bash
cd "AIVOA – Round 1 AI Product Engineer/backend"
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
Backend runs at: **http://localhost:8000**  
API docs at: **http://localhost:8000/docs**

### Step 3 — Start Frontend
```bash
cd "AIVOA – Round 1 AI Product Engineer/frontend"
npm install
npm run dev
```
Frontend runs at: **http://localhost:5173**

---

## 🤖 LangGraph Pipeline — Node Detail

| Node # | Name | LLM Used | Fallback |
|--------|------|----------|---------|
| 1 | extract | gemma2-9b-it | Regex + keyword heuristics |
| 2 | summarize | gemma2-9b-it | Template-based summary |
| 3 | completeness | Rule-based | — |
| 4 | duplicate | Jaccard similarity | — |
| 5 | root_cause | gemma2-9b-it | Type-based heuristic |
| 6 | risk | Rule-based scoring | — |
| 7 | recommendation | gemma2-9b-it | Heuristic CAPA |
| 8 | final | Assembly | — |

---

## 🔑 Key Features

- ✅ **AI-powered field extraction** — paste/upload complaint → 25+ fields auto-populated
- ✅ **5 Quick Test Prompts** — pre-loaded pharmaceutical scenarios for instant demo
- ✅ **8-node LangGraph workflow** — fully stateful AI pipeline with graceful fallback
- ✅ **Duplicate detection** — Jaccard similarity against last 30 complaints
- ✅ **Risk classification** — High / Medium / Low with regulatory flag
- ✅ **CAPA recommendations** — GMP-specific corrective + preventive actions
- ✅ **Completeness scoring** — 0–100% with missing field identification
- ✅ **Complaint register** — search, filter by risk/status, sort, CRUD
- ✅ **Dashboard** — live stats (total, open, high-risk, avg completeness)
- ✅ **AI Assistant chat** — contextual Q&A panel per complaint
- ✅ **PDF upload** — drag & drop or browse, text extracted server-side

---

## 📊 API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness check |
| POST | `/api/analyze-complaint` | Multipart: analyse text/file via AI |
| GET | `/api/complaints/stats` | Dashboard statistics |
| GET | `/api/complaints` | List all complaints (newest first) |
| POST | `/api/complaints` | Create/save a complaint |
| GET | `/api/complaints/{id}` | Get single complaint detail |
| PUT | `/api/complaints/{id}` | Update complaint fields |
| DELETE | `/api/complaints/{id}` | Delete complaint |
| POST | `/api/documents/extract` | Raw PDF/TXT text extraction |

---

## 🎓 Research Basis

This system is modelled on real pharmaceutical QMS complaint management requirements:

- **ICH Q10** — Pharmaceutical Quality System guideline
- **21 CFR Part 211.198** — US FDA requirement for complaint files
- **Schedule M (Revised)** — Indian GMP requirements for complaint handling
- **ISO 13485** — QMS for medical devices (complaint procedure alignment)

Key pharma QMS principles applied:
1. Every complaint must receive a unique complaint number within 24 hours
2. Risk classification determines investigation timeline (High = immediate)
3. CAPA must address both root cause (corrective) and prevention (preventive)
4. Regulatory reportability assessment is mandatory for serious events
5. Completeness of complaint data directly impacts investigation quality
