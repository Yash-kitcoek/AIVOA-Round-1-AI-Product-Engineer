# AIVOA Complaint Copilot

An AI-powered pharmaceutical Customer Complaint Management System (CCMS) built for pharmaceutical API and FDF manufacturers. It transforms distributor emails, complaint notes, and uploaded documents into structured QMS complaint records with AI-driven triage, root cause analysis, CAPA recommendations, and risk classification.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Redux Toolkit + Vite |
| Backend | Python 3.11 + FastAPI + SQLAlchemy |
| AI Agent | LangGraph 8-node pipeline |
| LLM | Groq `gemma2-9b-it` (primary), heuristic fallback |
| Database | SQLite (default) / PostgreSQL |
| Font | Google Inter |

## AI Features

- **Field Extraction** — LLM-based structured extraction of product, batch, customer, type, severity, date
- **AI Summary** — Executive 2–3 sentence complaint summary
- **Completeness Checker** — Scores completeness of complaint data (0–100%)
- **Duplicate Detection** — Jaccard-similarity matching against existing records
- **Root Cause Recommendations** — Pharma-specific root cause hypotheses
- **CAPA Recommendations** — Corrective & Preventive Action suggestions
- **AI Risk Classification** — High / Medium / Low with evidence trail
- **Regulatory Flag** — Identifies potentially reportable adverse events

## LangGraph Pipeline

```
START → extract → summarize → completeness → duplicate → root_cause → risk → recommendation → final → END
```

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env and set GROQ_API_KEY=your_groq_api_key
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=sqlite:///./aivoa.db
CORS_ORIGINS=http://localhost:5173
```

> Without `GROQ_API_KEY`, the system uses deterministic heuristic extraction (all features still work).

## Demo Workflow

1. Open **New Complaint** — paste a distributor email or click a sample complaint (Dissolution / Contamination / Labeling Error)
2. Click **Analyse with AI Copilot** — the LangGraph pipeline runs in < 5 seconds
3. Review the AI analysis panel: risk classification, completeness, duplicate flag, root cause, CAPA actions
4. Edit the auto-filled complaint form if needed, then **Save to Complaint Register**
5. Open **Complaint Register** to view, filter, and sort all complaints
6. Click any record for the **Detail View** — update status, add investigation notes, view full AI assessment

## Sample Complaints

Pre-built sample complaints in `backend/sample_complaints/`:

- `email_tablet_dissolution.txt` — Dissolution failure (Metformin HCl Batch MT-2026-0342)
- `complaint_contamination.txt` — Cross-contamination concern (Amoxicillin Batch AMX-2026-0198)
- `complaint_label_error.txt` — Mislabeling / patient safety (Atorvastatin Batch ATV-2026-0277)

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check + AI mode |
| POST | `/api/analyze-complaint` | Run AI pipeline on text/file |
| GET | `/api/complaints` | List all complaints |
| POST | `/api/complaints` | Create complaint record |
| GET | `/api/complaints/stats` | Dashboard statistics |
| GET | `/api/complaints/{id}` | Get single complaint |
| PUT | `/api/complaints/{id}` | Update complaint (status, notes, etc.) |
| DELETE | `/api/complaints/{id}` | Delete complaint |

> **Note:** This is an interview demonstration, not a validated GxP system. AI suggestions always require Quality review before action.
