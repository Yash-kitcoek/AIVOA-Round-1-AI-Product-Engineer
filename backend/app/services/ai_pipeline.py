"""
AI Pipeline for AIVOA Complaint Copilot
----------------------------------------
LangGraph workflow with 7 nodes:
  START → extract → completeness → duplicate → root_cause → risk → recommendation → final → END

When GROQ_API_KEY is set, nodes use `gemma2-9b-it` (primary) or `llama-3.3-70b-versatile`
(for larger context). Falls back to deterministic heuristics when no key is present.
"""

import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None

try:
    from langgraph.graph import END, START, StateGraph
except ImportError:
    StateGraph = None
    END = "__end__"
    START = "__start__"


# ──────────────────────────────────────────────────────────────────────────────
# State
# ──────────────────────────────────────────────────────────────────────────────

class ComplaintState(dict):
    """Typed dict-like state flowing through the LangGraph nodes."""
    pass


# ──────────────────────────────────────────────────────────────────────────────
# LLM helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_llm(model: str = "gemma2-9b-it") -> Optional[Any]:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or ChatGroq is None:
        return None
    try:
        return ChatGroq(model=model, groq_api_key=api_key, temperature=0.1, max_tokens=2048)
    except Exception:
        return None


def _invoke_llm(llm: Any, prompt: str) -> Optional[str]:
    """Call the LLM and return the text response, or None on failure."""
    try:
        response = llm.invoke(prompt)
        return getattr(response, "content", str(response)).strip()
    except Exception:
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Heuristic helpers (deterministic fallback)
# ──────────────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _heuristic_extract(text: str) -> Dict[str, Any]:
    """Rule-based extraction — used when no API key is available or LLM fails."""
    normalized = _normalize(text).lower()

    # Product
    product = None
    for candidate in ["amoxicillin", "metformin", "lisinopril", "atorvastatin",
                       "tablet", "capsule", "injection", "injectable", "syrup",
                       "cream", "ointment", "solution", "suspension", "api",
                       "fdf", "raw material", "bulk drug"]:
        if candidate in normalized:
            product = candidate.title()
            break

    # Batch number
    batch = None
    m = re.search(r"batch(?:\s*no\.?|\s*number|\s*#)?\s*[:\-]?\s*([A-Z0-9\-/]+)", text, re.I)
    if m:
        batch = m.group(1).strip()
    else:
        m2 = re.search(r"\b([A-Z]{2,4}[-/]?\d{3,8})\b", text)
        if m2:
            batch = m2.group(1)

    # Customer / reporter
    customer = None
    for marker in ["distributor", "hospital", "pharmacy", "retailer", "wholesaler", "clinic", "customer"]:
        if marker in normalized:
            idx = normalized.find(marker)
            surrounding = text[max(0, idx - 20): idx + 60]
            customer = surrounding.strip()[:80]
            break

    # Complaint type
    complaint_type = "Quality Concern"
    if any(w in normalized for w in ["contamination", "cross-contaminat", "foreign"]):
        complaint_type = "Contamination"
    elif any(w in normalized for w in ["dissolution", "disintegration", "hardness"]):
        complaint_type = "Physical/Chemical Quality Defect"
    elif any(w in normalized for w in ["label", "labeling", "mislabel", "wrong label"]):
        complaint_type = "Labeling/Packaging Error"
    elif any(w in normalized for w in ["adverse", "side effect", "reaction", "death", "hospitali"]):
        complaint_type = "Adverse Event / Patient Safety"
    elif any(w in normalized for w in ["stability", "expire", "degradation", "potency"]):
        complaint_type = "Stability / Shelf-life Concern"
    elif any(w in normalized for w in ["seal", "tamper", "broken", "damaged", "crack", "defect"]):
        complaint_type = "Packaging Defect"

    # Severity
    severity = "Medium"
    if any(w in normalized for w in ["critical", "serious", "adverse event", "death",
                                      "hospitali", "patient harm", "recall", "contamination"]):
        severity = "High"
    elif any(w in normalized for w in ["minor", "cosmetic", "slight", "small delay"]):
        severity = "Low"

    # Date
    complaint_date = None
    m_date = re.search(r"(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})", text, re.I)
    if m_date:
        complaint_date = m_date.group(1)

    return {
        "product": product,
        "batch": batch,
        "customer": customer,
        "complaint_type": complaint_type,
        "severity": severity,
        "complaint_date": complaint_date,
        "description": text[:700].strip(),
        "extraction_method": "heuristic",
    }


# ──────────────────────────────────────────────────────────────────────────────
# LLM-powered extraction
# ──────────────────────────────────────────────────────────────────────────────

EXTRACT_PROMPT = """You are a pharmaceutical QMS expert. Extract structured data from the complaint text below and respond ONLY with valid JSON — no markdown, no extra text.

Complaint text:
\"\"\"
{text}
\"\"\"

Return JSON with these exact keys:
{{
  "product": "product name or null",
  "batch": "batch number or null",
  "customer": "customer/reporter name or null",
  "complaint_type": "one of: Quality Concern | Contamination | Labeling/Packaging Error | Adverse Event / Patient Safety | Stability / Shelf-life Concern | Packaging Defect | Physical/Chemical Quality Defect",
  "severity": "one of: Low | Medium | High",
  "complaint_date": "date string or null",
  "description": "concise 1-2 sentence summary of the complaint",
  "regulatory_reportable": true or false,
  "extraction_method": "llm"
}}"""

SUMMARY_PROMPT = """You are a pharmaceutical QMS expert writing an executive summary for a customer complaint.

Complaint text:
\"\"\"
{text}
\"\"\"

Write a concise, professional 2-3 sentence AI summary that captures: the nature of the complaint, the product/batch affected, the potential patient safety or quality impact, and the urgency. Do not use markdown. Return plain text only."""

ROOT_CAUSE_PROMPT = """You are a pharmaceutical quality expert. Based on the extracted complaint data below, suggest the most likely root cause(s) for a pharmaceutical manufacturer's investigation.

Complaint type: {complaint_type}
Product: {product}
Batch: {batch}
Severity: {severity}
Description: {description}

List 2-3 probable root cause hypotheses in plain text, each on a new line starting with "•". Focus on manufacturing, analytical, or supply chain factors. Be specific to pharma QMS."""

CAPA_PROMPT = """You are a pharmaceutical CAPA (Corrective and Preventive Action) expert. Based on the complaint below, recommend concrete CAPA actions.

Complaint type: {complaint_type}
Severity: {severity}
Risk level: {risk}
Root cause hypothesis: {root_cause}
Missing fields: {missing_fields}

Provide 3-5 specific CAPA actions in plain text, each on a new line starting with "→". Include both corrective actions (immediate) and preventive actions (long-term). Be specific to pharmaceutical GMP."""


def _llm_extract(text: str) -> Optional[Dict[str, Any]]:
    llm = _get_llm("gemma2-9b-it")
    if llm is None:
        return None
    prompt = EXTRACT_PROMPT.format(text=text[:3000])
    raw = _invoke_llm(llm, prompt)
    if not raw:
        return None
    # Strip any markdown code fences
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()
    try:
        data = json.loads(raw)
        data["extraction_method"] = "llm"
        return data
    except Exception:
        # Try extracting JSON from within the response
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group())
                data["extraction_method"] = "llm"
                return data
            except Exception:
                pass
    return None


def _llm_summary(text: str) -> Optional[str]:
    llm = _get_llm("gemma2-9b-it")
    if llm is None:
        return None
    prompt = SUMMARY_PROMPT.format(text=text[:3000])
    return _invoke_llm(llm, prompt)


def _llm_root_cause(extracted: Dict[str, Any]) -> Optional[str]:
    llm = _get_llm("gemma2-9b-it")
    if llm is None:
        return None
    prompt = ROOT_CAUSE_PROMPT.format(
        complaint_type=extracted.get("complaint_type", "Quality Concern"),
        product=extracted.get("product", "Unknown"),
        batch=extracted.get("batch", "Unknown"),
        severity=extracted.get("severity", "Medium"),
        description=extracted.get("description", "")[:500],
    )
    return _invoke_llm(llm, prompt)


def _llm_capa(extracted: Dict[str, Any], risk: str, root_cause: str, missing_fields: List[str]) -> Optional[str]:
    llm = _get_llm("gemma2-9b-it")
    if llm is None:
        return None
    prompt = CAPA_PROMPT.format(
        complaint_type=extracted.get("complaint_type", "Quality Concern"),
        severity=extracted.get("severity", "Medium"),
        risk=risk,
        root_cause=root_cause[:400],
        missing_fields=", ".join(missing_fields) if missing_fields else "None",
    )
    return _invoke_llm(llm, prompt)


# ──────────────────────────────────────────────────────────────────────────────
# Heuristic helpers for completeness, duplicate, risk
# ──────────────────────────────────────────────────────────────────────────────

REQUIRED_FIELDS = ["product", "batch", "customer", "complaint_type", "complaint_date", "description"]


def _build_completeness(extracted: Dict[str, Any]) -> Dict[str, Any]:
    present = sum(1 for f in REQUIRED_FIELDS if extracted.get(f))
    score = int((present / len(REQUIRED_FIELDS)) * 100)
    missing = [f for f in REQUIRED_FIELDS if not extracted.get(f)]
    return {"score": score, "missing": missing}


def _jaccard(a: str, b: str) -> float:
    sa, sb = set(a.lower().split()), set(b.lower().split())
    return len(sa & sb) / max(1, len(sa | sb))


def _find_duplicate(text: str, existing_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not existing_records:
        return {"flag": False, "reference": None, "similarity": 0.0}
    norm = _normalize(text).lower()
    best_match, best_score = None, 0.0
    for record in existing_records:
        record_text = f"{record.get('description', '')} {record.get('product', '')} {record.get('batch', '')}".lower()
        score = _jaccard(norm, record_text)
        if score > best_score:
            best_score = score
            best_match = record
    threshold = 0.18
    if best_match and best_score >= threshold:
        return {"flag": True, "reference": best_match.get("complaint_number"), "similarity": round(best_score, 3)}
    return {"flag": False, "reference": None, "similarity": round(best_score, 3)}


def _build_risk(extracted: Dict[str, Any], completeness: Dict[str, Any], duplicate: Dict[str, Any]) -> str:
    if extracted.get("severity") == "High":
        return "High"
    if extracted.get("regulatory_reportable"):
        return "High"
    if duplicate.get("flag"):
        return "High"
    if completeness.get("score", 100) < 50:
        return "Medium"
    if extracted.get("severity") == "Low" and completeness.get("score", 0) >= 70:
        return "Low"
    return "Medium"


def _heuristic_root_cause(extracted: Dict[str, Any]) -> str:
    ct = (extracted.get("complaint_type") or "").lower()
    lines = []
    if "contamination" in ct:
        lines = [
            "• Potential cross-contamination during bulk manufacturing or equipment cleaning failure.",
            "• Breakdown in in-process controls or environmental monitoring.",
            "• Supplier-side raw material contamination — review COAs and incoming QC records.",
        ]
    elif "labeling" in ct or "packaging" in ct:
        lines = [
            "• Line clearance failure or mix-up during changeover between product runs.",
            "• Print or artwork control deviation; verify artwork approval workflow.",
            "• Operator error during manual labeling — review batch record entries.",
        ]
    elif "stability" in ct or "shelf" in ct:
        lines = [
            "• Inadequate storage conditions (temperature/humidity excursion) during distribution.",
            "• API degradation linked to formulation incompatibility — review stability data.",
            "• Packaging barrier failure affecting moisture ingress.",
        ]
    elif "dissolution" in ct or "quality" in ct or "physical" in ct:
        lines = [
            "• Variation in granulation or compression parameters — review in-process controls.",
            "• Raw material quality variability from supplier — compare COAs across batches.",
            "• Equipment calibration drift in dissolution or hardness tester.",
        ]
    elif "adverse" in ct or "patient" in ct:
        lines = [
            "• Potential product quality defect causing adverse reaction — retain samples immediately.",
            "• Evaluate formulation excipients and API purity against specification.",
            "• Initiate pharmacovigilance reporting — assess medical causality.",
        ]
    else:
        lines = [
            "• Review batch manufacturing records, in-process controls, and deviation logs.",
            "• Evaluate raw material and packaging component test reports.",
            "• Assess storage and distribution chain for temperature or handling deviations.",
        ]
    return "\n".join(lines)


def _heuristic_capa(extracted: Dict[str, Any], risk: str, completeness: Dict[str, Any]) -> str:
    actions = [
        "→ [Corrective] Quarantine the affected batch and initiate a hold pending investigation outcome.",
        "→ [Corrective] Collect and retain complaint sample; forward to QC for testing against specification.",
        "→ [Preventive] Conduct root cause analysis with cross-functional team (QA, Manufacturing, Regulatory).",
    ]
    if risk == "High":
        actions.append("→ [Corrective] Escalate to Quality Director and initiate regulatory risk assessment within 24 hrs.")
    if extracted.get("regulatory_reportable"):
        actions.append("→ [Regulatory] File MedWatch / PSUR report as applicable within regulatory deadline.")
    if completeness.get("score", 100) < 70:
        actions.append("→ [Administrative] Contact the customer to obtain missing complaint details (batch, date, sample).")
    actions.append("→ [Preventive] Update complaint trend analysis and include findings in next Product Quality Review (PQR).")
    return "\n".join(actions)


def _heuristic_quality_impact(extracted: Dict[str, Any]) -> str:
    ct = (extracted.get("complaint_type") or "").lower()
    sev = extracted.get("severity", "Medium")
    if sev == "High" or "adverse" in ct or "patient" in ct:
        return "Potential patient safety impact. Immediate product disposition assessment required. Pharmacovigilance evaluation mandatory."
    if "contamination" in ct:
        return "Significant quality impact — potential cross-contamination may affect multiple batches. Scope assessment required."
    if "labeling" in ct:
        return "Labeling error may cause medication errors. Assess market impact and evaluate need for field alert."
    return "Quality concern requiring systematic investigation. No immediate patient safety signal identified."


# ──────────────────────────────────────────────────────────────────────────────
# Complaint number generator
# ──────────────────────────────────────────────────────────────────────────────

def _generate_complaint_number(existing_count: int) -> str:
    from datetime import datetime
    year = datetime.utcnow().strftime("%Y")
    seq = str(existing_count + 1).zfill(4)
    return f"CMP-{year}-{seq}"


# ──────────────────────────────────────────────────────────────────────────────
# LangGraph nodes
# ──────────────────────────────────────────────────────────────────────────────

def _node_extract(state: ComplaintState) -> Dict[str, Any]:
    """Node 1 — Extract structured fields from raw complaint text."""
    text = state.get("text", "")
    extracted = _llm_extract(text) or _heuristic_extract(text)
    # Ensure description always has content
    if not extracted.get("description"):
        extracted["description"] = text[:700].strip()
    return {"extracted": extracted}


def _node_summarize(state: ComplaintState) -> Dict[str, Any]:
    """Node 2 — Generate executive AI summary."""
    text = state.get("text", "")
    extracted = state.get("extracted", {})
    ai_summary = _llm_summary(text)
    if not ai_summary:
        ct = extracted.get("complaint_type", "quality concern")
        product = extracted.get("product") or "the product"
        sev = extracted.get("severity", "medium").lower()
        ai_summary = (
            f"A {sev}-severity {ct.lower()} complaint has been received regarding {product}. "
            f"The reported issue requires investigation of manufacturing, handling, and distribution records. "
            f"Quality review and appropriate CAPA actions are recommended based on findings."
        )
    return {"ai_summary": ai_summary}


def _node_completeness(state: ComplaintState) -> Dict[str, Any]:
    """Node 3 — Calculate completeness score and identify missing fields."""
    completeness = _build_completeness(state.get("extracted", {}))
    return {"completeness": completeness}


def _node_duplicate(state: ComplaintState) -> Dict[str, Any]:
    """Node 4 — Detect potential duplicate complaints."""
    duplicate = _find_duplicate(state.get("text", ""), state.get("existing_records", []))
    return {"duplicate": duplicate}


def _node_root_cause(state: ComplaintState) -> Dict[str, Any]:
    """Node 5 — Recommend root cause hypotheses."""
    extracted = state.get("extracted", {})
    root_cause = _llm_root_cause(extracted) or _heuristic_root_cause(extracted)
    return {"root_cause": root_cause}


def _node_risk(state: ComplaintState) -> Dict[str, Any]:
    """Node 6 — Assign risk level."""
    risk = _build_risk(
        state.get("extracted", {}),
        state.get("completeness", {}),
        state.get("duplicate", {}),
    )
    return {"risk": risk}


def _node_recommendation(state: ComplaintState) -> Dict[str, Any]:
    """Node 7 — Produce CAPA actions and quality impact statement."""
    extracted = state.get("extracted", {})
    risk = state.get("risk", "Medium")
    root_cause = state.get("root_cause", "")
    completeness = state.get("completeness", {})
    capa = _llm_capa(extracted, risk, root_cause, completeness.get("missing", [])) or _heuristic_capa(extracted, risk, completeness)
    quality_impact = _heuristic_quality_impact(extracted)
    # Build the summary recommendations string (shorter form for the main recommendations field)
    short_recs = []
    if extracted.get("severity") == "High":
        short_recs.append("Escalate immediately to Quality Director.")
    short_recs.append("Preserve complaint sample and log in QMS.")
    short_recs.append("Review BMR and in-process control records.")
    if state.get("duplicate", {}).get("flag"):
        short_recs.append(f"Investigate relationship with duplicate {state['duplicate']['reference']}.")
    if completeness.get("score", 100) < 70:
        short_recs.append("Obtain missing complaint details from customer.")
    return {
        "capa_actions": capa,
        "recommendations": " | ".join(short_recs),
        "quality_impact": quality_impact,
    }


def _node_final(state: ComplaintState) -> Dict[str, Any]:
    """Node 8 — Assemble the final AnalysisResponse payload."""
    extracted = state.get("extracted", {})
    completeness = state.get("completeness", {})
    duplicate = state.get("duplicate", {})
    existing_count = len(state.get("existing_records", []))

    final = {
        "complaint_number": _generate_complaint_number(existing_count),
        "product": extracted.get("product") or "Not identified",
        "batch": extracted.get("batch") or "Not identified",
        "customer": extracted.get("customer") or "Not identified",
        "complaint_type": extracted.get("complaint_type") or "Quality Concern",
        "complaint_date": extracted.get("complaint_date") or "Not identified",
        "description": extracted.get("description") or state.get("text", "")[:700],
        "severity": extracted.get("severity") or "Medium",
        "risk_level": state.get("risk", "Medium"),
        "quality_impact": state.get("quality_impact", "Standard quality review required."),
        "root_cause": state.get("root_cause", "Investigation required."),
        "recommendations": state.get("recommendations", "Log and investigate."),
        "capa_actions": state.get("capa_actions"),
        "ai_summary": state.get("ai_summary"),
        "regulatory_reportable": bool(extracted.get("regulatory_reportable", False)),
        "completeness_score": completeness.get("score", 0),
        "duplicate_flag": duplicate.get("flag", False),
        "duplicate_reference": duplicate.get("reference"),
        "evidence": {
            "missing_fields": completeness.get("missing", []),
            "llm_summary": state.get("ai_summary"),
            "extraction_method": extracted.get("extraction_method", "heuristic"),
            "confidence_scores": {"duplicate_similarity": duplicate.get("similarity", 0.0)},
        },
    }
    return {"final": final}


# ──────────────────────────────────────────────────────────────────────────────
# Graph builder
# ──────────────────────────────────────────────────────────────────────────────

def _build_graph():
    if StateGraph is None:
        return None
    builder = StateGraph(ComplaintState)
    builder.add_node("extract", _node_extract)
    builder.add_node("summarize", _node_summarize)
    builder.add_node("completeness", _node_completeness)
    builder.add_node("duplicate", _node_duplicate)
    builder.add_node("root_cause", _node_root_cause)
    builder.add_node("risk", _node_risk)
    builder.add_node("recommendation", _node_recommendation)
    builder.add_node("final", _node_final)
    builder.add_edge(START, "extract")
    builder.add_edge("extract", "summarize")
    builder.add_edge("summarize", "completeness")
    builder.add_edge("completeness", "duplicate")
    builder.add_edge("duplicate", "root_cause")
    builder.add_edge("root_cause", "risk")
    builder.add_edge("risk", "recommendation")
    builder.add_edge("recommendation", "final")
    builder.add_edge("final", END)
    return builder.compile()


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def analyze_complaint(text: str, existing_records: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Run the full LangGraph complaint analysis pipeline.
    Returns a dict that maps directly to AnalysisResponse schema.
    """
    existing_records = existing_records or []
    graph = _build_graph()
    initial_state = ComplaintState(text=text, existing_records=existing_records)

    if graph is not None:
        try:
            result = graph.invoke(initial_state)
            return result.get("final", {})
        except Exception:
            pass  # Fall through to heuristic path

    # Pure heuristic fallback (no LangGraph or error)
    extracted = _heuristic_extract(text)
    completeness = _build_completeness(extracted)
    duplicate = _find_duplicate(text, existing_records)
    risk = _build_risk(extracted, completeness, duplicate)
    root_cause = _heuristic_root_cause(extracted)
    capa = _heuristic_capa(extracted, risk, completeness)
    quality_impact = _heuristic_quality_impact(extracted)
    short_recs = ["Preserve complaint sample and log in QMS.", "Review BMR and in-process control records."]
    if duplicate.get("flag"):
        short_recs.append(f"Investigate relationship with duplicate {duplicate['reference']}.")
    existing_count = len(existing_records)
    ct = extracted.get("complaint_type", "Quality Concern")
    product = extracted.get("product") or "the product"
    sev = (extracted.get("severity") or "medium").lower()
    ai_summary = (
        f"A {sev}-severity {ct.lower()} complaint has been received regarding {product}. "
        f"The reported issue requires investigation of manufacturing, handling, and distribution records. "
        f"Quality review and appropriate CAPA actions are recommended based on findings."
    )
    return {
        "complaint_number": _generate_complaint_number(existing_count),
        "product": extracted.get("product") or "Not identified",
        "batch": extracted.get("batch") or "Not identified",
        "customer": extracted.get("customer") or "Not identified",
        "complaint_type": extracted.get("complaint_type") or "Quality Concern",
        "complaint_date": extracted.get("complaint_date") or "Not identified",
        "description": extracted.get("description") or text,
        "severity": extracted.get("severity") or "Medium",
        "risk_level": risk,
        "quality_impact": quality_impact,
        "root_cause": root_cause,
        "recommendations": " | ".join(short_recs),
        "capa_actions": capa,
        "ai_summary": ai_summary,
        "regulatory_reportable": bool(extracted.get("regulatory_reportable", False)),
        "completeness_score": completeness.get("score", 0),
        "duplicate_flag": duplicate.get("flag", False),
        "duplicate_reference": duplicate.get("reference"),
        "evidence": {
            "missing_fields": completeness.get("missing", []),
            "llm_summary": ai_summary,
            "extraction_method": extracted.get("extraction_method", "heuristic"),
            "confidence_scores": {"duplicate_similarity": duplicate.get("similarity", 0.0)},
        },
    }
