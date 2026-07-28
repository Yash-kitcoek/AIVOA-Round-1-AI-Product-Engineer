# AIVOA Complaint Copilot

An AI-assisted pharmaceutical customer complaint management demo. It turns a free-text complaint or uploaded text/PDF into a reviewable complaint record, applies a transparent risk triage, flags missing information and likely duplicates, and suggests investigation/CAPA actions.

## Stack

- React + TypeScript + Redux Toolkit (Vite)
- FastAPI + SQLAlchemy (SQLite by default; set `DATABASE_URL` to use Postgres)
- LangGraph + Groq (`gemma2-9b-it`), with a deterministic demo fallback when no token is configured

## Run locally

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The API docs are at http://localhost:8000/docs.

## Demo narrative

1. Paste a distributor email or upload a `.txt`, `.md`, or text-based `.pdf`.
2. Select **Analyse with AI**. The LangGraph pipeline extracts fields, checks completeness, finds similar records, assigns a risk, and recommends next actions.
3. Review/edit the generated complaint form and save it to the complaint register.
4. Open the record to see the auditable AI risk assessment and CAPA recommendation.

> This is an interview demonstration, not a validated GxP system. AI suggestions always require Quality review.
