# 🎬 AIVOA Demo Script — Complete Video Guide
### AI-Powered Customer Complaint Management System
#### AIVOA Round 1 · AI Product Engineer Internship

> **Video Target:** 8–12 minutes total  
> **What they want:** End-to-end walkthrough — user input → API → LangGraph pipeline → final output  
> **Tone:** Confident, technical, curious, professional

---

## ⏱️ TIMING OVERVIEW

| Segment | Duration | Topic |
|---------|----------|-------|
| 0:00–0:45 | 45 sec | Introduction & context |
| 0:45–1:30 | 45 sec | Research — what is pharma QMS? |
| 1:30–2:30 | 1 min | Architecture overview (point at README diagram) |
| 2:30–4:30 | 2 min | Live Demo — Dashboard + New Complaint intake |
| 4:30–6:30 | 2 min | AI Pipeline walkthrough (code + output) |
| 6:30–8:00 | 1:30 | Complaint Register + Detail view |
| 8:00–9:00 | 1 min | Tech decisions + what I learned |
| 9:00–9:30 | 30 sec | Closing |

---

---

## 🎙️ SEGMENT 1 — INTRODUCTION (0:00 – 0:45)

### [Show: Your face or screen with the running application]

> "Hi, my name is [YOUR NAME]. I'm applying for the AI Product Engineer internship at AIVOA.
>
> The task was to build an AI-powered Customer Complaint Management System for the pharmaceutical manufacturing industry — specifically for companies that manufacture APIs — Active Pharmaceutical Ingredients — and FDFs — Finished Dosage Forms.
>
> Before I wrote a single line of code, I researched how pharmaceutical companies actually handle complaints, because this isn't just a form — it's a regulatory requirement.
>
> Let me walk you through everything — the research, the architecture, the AI pipeline, and the live system."

---

## 🎙️ SEGMENT 2 — RESEARCH (0:45 – 1:30)

### [Show: README.md Research Basis section or a quick note on screen]

> "When a pharmacy or hospital reports a quality issue — say, a tablet that disintegrates too fast, or capsules with the wrong colour — a pharmaceutical company is legally required to:
>
> One: Log it with a unique complaint number within 24 hours.
> Two: Classify the risk — High, Medium, or Low — based on patient safety impact.
> Three: Investigate the root cause using a structured CAPA — Corrective and Preventive Action — process.
> Four: Assess if the event is regulatory reportable — meaning the FDA or CDSCO needs to be notified.
>
> These requirements come from ICH Q10, 21 CFR 211.198 in the US, and Schedule M Revised in India.
>
> Traditionally, QA officers do all of this manually — reading emails, filling Excel sheets, writing root cause hypotheses from memory. That's slow, inconsistent, and error-prone.
>
> This system replaces that entire manual intake process with an AI Copilot."

---

## 🎙️ SEGMENT 3 — ARCHITECTURE OVERVIEW (1:30 – 2:30)

### [Show: README.md architecture diagram — point at each layer]

> "Here's how the system is structured.
>
> The user interacts with a React frontend, built with Vite and Redux Toolkit for state management.
>
> When a QA officer pastes a complaint email or uploads a PDF, Redux dispatches an async thunk that sends a multipart POST request to our FastAPI backend.
>
> FastAPI receives the text, extracts content from any uploaded PDF using pypdf, then passes it to the AI pipeline.
>
> The AI pipeline is built on LangGraph — a stateful workflow framework from LangChain. It has 8 nodes that run in sequence: extract, summarize, completeness, duplicate detection, root cause analysis, risk scoring, CAPA generation, and final assembly.
>
> Each node either calls Groq's gemma2-9b-it model, or falls back to deterministic heuristics if no API key is available — so the system always returns a result.
>
> The final JSON response flows back to Redux, which populates all 25 form fields automatically. The user reviews, edits if needed, and saves to the database — SQLite locally, or Neon serverless PostgreSQL in production."

---

## 🎙️ SEGMENT 4 — LIVE DEMO (2:30 – 4:30)

### [Show: The running application in the browser at localhost:5173]

#### Step 1 — Dashboard (2:30 – 2:50)

> "This is the Dashboard. It shows real-time stats — total complaints, open cases, under investigation, high-risk events, regulatory flags, and average data completeness.
>
> Everything here is live from the database through a dedicated stats endpoint."

#### Step 2 — New Complaint — Upload / Quick Prompts (2:50 – 3:20)

> "Now let me go to New Complaint.
>
> This is the main intake screen. On the left is the structured form — five sections covering origin, product identification, complaint details, assessment, and AI outputs.
>
> On the right is the AI Complaint Intake Assistant. Notice these five Quick Test Prompt cards — these are pre-loaded pharmaceutical scenarios I built specifically for demo purposes.
>
> Let me click 'Cross-Contamination' — the most critical scenario."

#### Step 3 — Load sample and analyse (3:20 – 3:50)

### [Click the Cross-Contamination card, show text loading]

> "The complaint text loads instantly — this is a realistic report from a pharmacy chain reporting discoloured Amoxicillin capsules with external lab findings showing a foreign compound peak in HPLC analysis.
>
> Now I'll click 'Analyse with AI Copilot'."

### [Click Analyse, show the progress bar animating]

> "You can see the extraction progress bar. This is running through our LangGraph pipeline on Groq — the gemma2-9b-it model processes the text through all 8 nodes.
>
> This typically takes three to eight seconds depending on network latency to Groq's servers."

### [Show: form fields filling in automatically]

> "And — the form populates. Product name, batch number, complaint type, severity, customer, date — all extracted automatically. In Section 5 you can see the AI Summary, Quality Impact statement, Root Cause Hypotheses, and CAPA Actions — all generated in one pipeline run."

#### Step 4 — Show the risk panel (3:50 – 4:10)

> "The risk panel shows 'High' — because contamination in an antibiotic is a critical patient safety event. The completeness score shows how complete the complaint data is. If fields are missing, the system tells you exactly which ones to collect from the customer."

#### Step 5 — Save (4:10 – 4:30)

> "I'll click Save Complaint. FastAPI creates a unique complaint number — CC-YYYYMMDD-0001 — stores all fields in the database, and the dashboard updates automatically."

---

## 🎙️ SEGMENT 5 — AI PIPELINE DEEP DIVE (4:30 – 6:30)

### [Show: ai_pipeline.py in your code editor — split screen or switch]

> "Now let me walk you through the AI pipeline code — this is where the intelligence lives.
>
> The file is `backend/app/services/ai_pipeline.py`."

#### Show Node 1 — Extract (4:30 – 4:50)

### [Scroll to _node_extract function]

> "Node 1 is extraction. I call gemma2-9b-it via LangChain's ChatGroq integration. The prompt instructs the model to respond ONLY with valid JSON — no markdown, no extra text — because I need structured output I can parse reliably.
>
> If the LLM fails — network error, rate limit, no API key — it falls back to `_heuristic_extract`, which uses regex patterns and keyword matching. So the system never crashes."

#### Show Node 4 — Duplicate Detection (4:50 – 5:10)

### [Scroll to _find_duplicate function]

> "Node 4 is duplicate detection. I fetch the last 30 complaints from the database and run Jaccard similarity between the new complaint text and existing records. If similarity exceeds 18%, it flags the complaint as a potential duplicate and stores the reference number — preventing double-processing of the same event."

#### Show Node 5 — Root Cause (5:10 – 5:30)

### [Scroll to ROOT_CAUSE_PROMPT]

> "Node 5 is root cause analysis. The prompt passes the complaint type, product, batch, and severity to gemma2-9b-it and asks for 2–3 GMP-specific root cause hypotheses. For contamination, it might suggest equipment cleaning validation failures or supplier-side API contamination — real possibilities a QA investigator would look at."

#### Show Node 7 — CAPA (5:30 – 5:50)

### [Scroll to CAPA_PROMPT]

> "Node 7 generates CAPA — Corrective and Preventive Actions. The output always distinguishes Corrective actions — immediate fixes — from Preventive actions — long-term systemic improvements. This is exactly what regulators look for in a CAPA response."

#### Show the graph builder (5:50 – 6:10)

### [Scroll to _build_graph function]

> "Finally, the graph builder. This is where LangGraph's power shows — I define 8 nodes, add sequential edges, and compile. LangGraph manages the state object flowing through each node. The output of node 1 becomes the input of node 2, and so on, until node 8 assembles the complete response.
>
> If LangGraph itself fails to import — old Python environment, missing package — the code falls through to a pure heuristic path that runs all the same logic without the graph framework."

#### Show FastAPI endpoint (6:10 – 6:30)

### [Show main.py _node_analyze endpoint]

> "Back in FastAPI, the analyze endpoint is a multipart form handler. It reads the uploaded file — supporting PDF and TXT — merges it with any pasted text, passes up to 30,000 characters to the pipeline, and returns the structured JSON. The 30K character limit is intentional — it stays within Groq's context window for gemma2-9b-it."

---

## 🎙️ SEGMENT 6 — REGISTER + DETAIL VIEW (6:30 – 8:00)

### [Show: Complaint Register tab]

> "The Complaint Register shows all saved complaints in a searchable, filterable table.
>
> I can search by any text, filter by risk level — High, Medium, Low — filter by status — Open, Under Investigation, Closed — and sort by any column."

### [Click on a saved complaint to open Detail view]

> "Clicking a complaint opens the Detail view. This shows the full record — AI summary at the top, all structured fields, the CAPA actions, root cause, quality impact. The status can be updated here — for example, moving a complaint from Open to Under Investigation when an investigation begins."

---

## 🎙️ SEGMENT 7 — TECH DECISIONS (8:00 – 9:00)

### [Show: code editor or stay on screen]

> "A few design decisions I want to highlight:
>
> First — I chose LangGraph over a simple sequential chain because it gives me named, inspectable nodes. Each node has a clear responsibility. I can extend this graph later — for example, adding a node that queries a regulatory database to auto-fill reportability requirements.
>
> Second — I built a deterministic heuristic fallback for every LLM node. This means the system degrades gracefully. Without an API key, you still get structured output — just from rules instead of the model. This is important for a production pharmaceutical system where reliability is non-negotiable.
>
> Third — the database schema has 37 columns covering every field a regulatory complaint record might need. I built an auto-migration script that adds new columns to existing databases without dropping data — so upgrading the schema is safe.
>
> Fourth — I used Redux Toolkit's createAsyncThunk for all API calls. This gives me three state transitions — pending, fulfilled, rejected — which I use to drive loading spinners, error banners, and success messages in the UI automatically.
>
> Fifth — pool_pre_ping in SQLAlchemy. This was a real bug I hit — Neon's serverless PostgreSQL goes to sleep after a few minutes. Without pool_pre_ping, SQLAlchemy would reuse a dead connection and crash with a socket error. With it, it tests the connection before every request and reconnects if needed."

---

## 🎙️ SEGMENT 8 — CLOSING (9:00 – 9:30)

### [Optional: show your face]

> "To summarise — I built an AI-powered complaint management system that covers the full QMS intake workflow: structured data extraction, risk scoring, duplicate detection, root cause analysis, and CAPA generation — all in a single 8-node LangGraph pipeline running on Groq.
>
> The frontend is a full React + Redux application with a real-time dashboard, complaint register, and AI assistant panel. The backend is a FastAPI service with 8 endpoints, Pydantic validation, and SQLAlchemy ORM.
>
> I came into this without prior pharmaceutical domain expertise — but I researched the regulatory framework, understood why each field matters in a complaint record, and built a system that reflects how QA professionals actually work.
>
> That's the approach I bring to every problem — curiosity, research, and building something that genuinely solves the real problem, not just the surface requirement.
>
> Thank you for the opportunity. I look forward to contributing to AIVOA's mission."

---

---

## 💡 TIPS FOR RECORDING

### Before you start
- [ ] Backend running at `localhost:8000` — check `/health` endpoint
- [ ] Frontend running at `localhost:5173`
- [ ] Browser tab on Dashboard
- [ ] Code editor open to `ai_pipeline.py` (for segment 5)
- [ ] Screen recording started, audio levels tested
- [ ] Groq API key set in `.env`

### During recording
- Speak at a steady pace — not too fast
- Click and PAUSE — let the UI animate before you talk about it
- When showing code — scroll slowly, point at function names
- Don't apologise for anything — speak confidently
- If something loads slowly — "This is making a live API call to Groq, which takes 3–5 seconds"

### Demo flow (quick cheat sheet)
```
1. Open browser at localhost:5173
2. Dashboard → explain stats
3. Click "New Complaint"
4. Click "Cross-Contamination" quick prompt card
5. Click "Analyse with AI Copilot" → wait for result
6. Walk through populated form fields
7. Click "Save Complaint"
8. Switch to code editor → ai_pipeline.py
9. Show: _node_extract, _find_duplicate, ROOT_CAUSE_PROMPT, _build_graph
10. Switch back to browser → Complaint Register
11. Click a saved complaint → Detail view
12. Wrap up
```

---

## ❓ LIKELY INTERVIEW FOLLOW-UP QUESTIONS

**Q: Why LangGraph instead of a simple function chain?**  
A: LangGraph gives me named, stateful, inspectable nodes. I can extend the graph later — adding a regulatory database lookup node, a human-in-the-loop approval step, or a parallel branch for high-severity complaints — without rewriting the existing nodes.

**Q: What happens if the Groq API is down?**  
A: Every LLM node has a deterministic heuristic fallback. The system always returns a structured result. For extraction, it uses regex + keyword rules. For root cause and CAPA, it uses lookup tables by complaint type.

**Q: How does duplicate detection work?**  
A: I compute Jaccard similarity between the new complaint text and the last 30 saved complaints. Jaccard measures word-set overlap — simple but effective for catching the same batch being reported twice by different customers. Threshold is 18%.

**Q: How would you scale this for a real pharma company?**  
A: Replace SQLite with a proper Postgres cluster. Add authentication (JWT). Add audit logging — every field change tracked with timestamp and user. Add email notifications when high-risk complaints arrive. Add a batch analytics view. Potentially add a retrieval-augmented generation layer that queries the company's own SOPs and product specifications.

**Q: What did you find most challenging?**  
A: Making the system reliable. Pharma QMS software cannot crash or return partial data. I spent significant time on the fallback logic — ensuring every node degrades gracefully, that the Neon database reconnects after sleep, and that the frontend always shows a meaningful state to the user regardless of what happens in the backend.
