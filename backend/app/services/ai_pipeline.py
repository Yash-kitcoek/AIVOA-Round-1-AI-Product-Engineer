import os
import re
from typing import Any, Dict, List

try:
    from langchain_groq import ChatGroq
except ImportError:  # pragma: no cover
    ChatGroq = None

try:
    from langgraph.graph import END, START, StateGraph
except ImportError:  # pragma: no cover
    StateGraph = None
    END = "__end__"
    START = "__start__"


class ComplaintState(dict):
    pass


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _heuristic_extract(text: str) -> Dict[str, Any]:
    normalized = _normalize_text(text.lower())
    product = None
    for candidate in ["tablet", "capsule", "api", "fdf", "injectable", "cream", "solution", "raw material"]:
        if candidate in normalized:
            product = candidate.title()
            break

    batch = None
    m = re.search(r"batch(?:\s*no\.?|\s*#)?\s*([a-z0-9\-/]+)", text, re.I)
    if m:
        batch = m.group(1).strip()

    customer = None
    for marker in ["customer", "distributor", "hospital", "pharmacy", "retailer"]:
        if marker in normalized:
            customer = marker.title()
            break

    complaint_type = "Quality concern"
    if any(word in normalized for word in ["contamination", "cross", "mix", "label", "packaging", "missing", "defect", "temperature", "stability"]):
        complaint_type = "Product quality issue"
    if "adverse" in normalized or "serious" in normalized:
        complaint_type = "Patient safety concern"

    severity = "Medium"
    if any(word in normalized for word in ["critical", "serious", "adverse", "hospitalization", "patient"]):
        severity = "High"
    elif any(word in normalized for word in ["minor", "delay"]):
        severity = "Low"

    complaint_date = None
    m_date = re.search(r"(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})", text)
    if m_date:
        complaint_date = m_date.group(1)

    description = text[:600].strip()
    return {
        "product": product,
        "batch": batch,
        "customer": customer,
        "complaint_type": complaint_type,
        "severity": severity,
        "complaint_date": complaint_date,
        "description": description,
    }


def _call_llm_if_available(text: str) -> str | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or ChatGroq is None:
        return None
    try:
        llm = ChatGroq(model="gemma2-9b-it", groq_api_key=api_key)
        response = llm.invoke([f"Summarize this pharmaceutical complaint for a QMS workflow:\n{text}"])
        return getattr(response, "content", str(response))
    except Exception:
        return None


def _build_completeness(extracted: Dict[str, Any]) -> Dict[str, Any]:
    required_fields = ["product", "batch", "customer", "complaint_type", "complaint_date", "description"]
    present = sum(1 for field in required_fields if extracted.get(field))
    score = int((present / len(required_fields)) * 100)
    missing = [field for field in required_fields if not extracted.get(field)]
    return {"score": score, "missing": missing}


def _find_duplicate(text: str, existing_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not existing_records:
        return {"flag": False, "reference": None}
    normalized = _normalize_text(text).lower()
    best_match = None
    best_score = 0.0
    for record in existing_records:
        record_text = f"{record.get('description', '')} {record.get('product', '')} {record.get('batch', '')}".lower()
        common = len(set(normalized.split()) & set(record_text.split()))
        score = common / max(1, len(set(normalized.split()) | set(record_text.split())))
        if score > best_score:
            best_score = score
            best_match = record
    if best_match and best_score >= 0.18:
        return {"flag": True, "reference": best_match.get("complaint_number")}
    return {"flag": False, "reference": None}


def _recommend_actions(extracted: Dict[str, Any], completeness: Dict[str, Any], duplicate: Dict[str, Any]) -> str:
    actions = [
        "Preserve the complaint sample and log the event in the quality register.",
        "Review batch records, packaging controls, and release documentation.",
        "Initiate a focused investigation with QA and manufacturing stakeholders.",
    ]
    if duplicate["flag"]:
        actions.append("Compare against the probable duplicate complaint and document the relationship.")
    if completeness["score"] < 70:
        actions.append("Request missing details such as batch, customer, and complaint date before closure.")
    if extracted.get("severity") == "High":
        actions.append("Escalate to the product quality review board for immediate assessment.")
    return " | ".join(actions)


def _build_risk(extracted: Dict[str, Any], completeness: Dict[str, Any], duplicate: Dict[str, Any]) -> str:
    if extracted.get("severity") == "High" or duplicate["flag"]:
        return "High"
    if completeness["score"] < 60:
        return "Medium"
    return "Low"


def _build_quality_impact(extracted: Dict[str, Any]) -> str:
    if "patient" in (extracted.get("complaint_type") or "").lower() or extracted.get("severity") == "High":
        return "Potential patient impact; assess product disposition and complaint escalation."
    return "No immediate patient safety signal; maintain standard quality review."


def _build_graph():
    if StateGraph is None:
        return None

    def extract_node(state: ComplaintState) -> Dict[str, Any]:
        llm_summary = _call_llm_if_available(state.get("text", ""))
        extracted = _heuristic_extract(state.get("text", ""))
        if llm_summary:
            extracted["llm_summary"] = llm_summary
        return {"extracted": extracted}

    def completeness_node(state: ComplaintState) -> Dict[str, Any]:
        completeness = _build_completeness(state.get("extracted", {}))
        return {"completeness": completeness}

    def duplicate_node(state: ComplaintState) -> Dict[str, Any]:
        duplicate = _find_duplicate(state.get("text", ""), state.get("existing_records", []))
        return {"duplicate": duplicate}

    def risk_node(state: ComplaintState) -> Dict[str, Any]:
        risk = _build_risk(state.get("extracted", {}), state.get("completeness", {}), state.get("duplicate", {}))
        return {"risk": risk}

    def recommendation_node(state: ComplaintState) -> Dict[str, Any]:
        recommendations = _recommend_actions(state.get("extracted", {}), state.get("completeness", {}), state.get("duplicate", {}))
        quality_impact = _build_quality_impact(state.get("extracted", {}))
        return {"recommendations": recommendations, "quality_impact": quality_impact}

    def final_node(state: ComplaintState) -> Dict[str, Any]:
        extracted = state.get("extracted", {})
        completeness = state.get("completeness", {})
        duplicate = state.get("duplicate", {})
        complaint_number = f"CMP-{len(str(state.get('existing_records', []))) + 1:03d}"
        final = {
            "complaint_number": complaint_number,
            "product": extracted.get("product") or "Not identified",
            "batch": extracted.get("batch") or "Not identified",
            "customer": extracted.get("customer") or "Not identified",
            "complaint_type": extracted.get("complaint_type") or "Quality concern",
            "complaint_date": extracted.get("complaint_date") or "Not identified",
            "description": extracted.get("description") or state.get("text", ""),
            "severity": extracted.get("severity") or "Medium",
            "risk_level": state.get("risk", "Medium"),
            "quality_impact": state.get("quality_impact", "Standard review"),
            "root_cause": "Investigate manufacturing, packaging, and storage handling records.",
            "recommendations": state.get("recommendations", "Document next actions"),
            "completeness_score": completeness.get("score", 0),
            "duplicate_flag": duplicate.get("flag", False),
            "duplicate_reference": duplicate.get("reference"),
            "evidence": {
                "missing_fields": completeness.get("missing", []),
                "llm_summary": extracted.get("llm_summary"),
            },
        }
        return {"final": final}

    builder = StateGraph(ComplaintState)
    builder.add_node("extract", extract_node)
    builder.add_node("completeness", completeness_node)
    builder.add_node("duplicate", duplicate_node)
    builder.add_node("risk", risk_node)
    builder.add_node("recommendation", recommendation_node)
    builder.add_node("final", final_node)
    builder.add_edge(START, "extract")
    builder.add_edge("extract", "completeness")
    builder.add_edge("completeness", "duplicate")
    builder.add_edge("duplicate", "risk")
    builder.add_edge("risk", "recommendation")
    builder.add_edge("recommendation", "final")
    builder.add_edge("final", END)
    return builder.compile()


def analyze_complaint(text: str, existing_records: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    existing_records = existing_records or []
    graph = _build_graph()
    initial_state = ComplaintState(text=text, existing_records=existing_records)
    if graph is None:
        extracted = _heuristic_extract(text)
        completeness = _build_completeness(extracted)
        duplicate = _find_duplicate(text, existing_records)
        risk = _build_risk(extracted, completeness, duplicate)
        quality_impact = _build_quality_impact(extracted)
        recommendations = _recommend_actions(extracted, completeness, duplicate)
        return {
            "complaint_number": "CMP-001",
            "product": extracted.get("product") or "Not identified",
            "batch": extracted.get("batch") or "Not identified",
            "customer": extracted.get("customer") or "Not identified",
            "complaint_type": extracted.get("complaint_type") or "Quality concern",
            "complaint_date": extracted.get("complaint_date") or "Not identified",
            "description": extracted.get("description") or text,
            "severity": extracted.get("severity") or "Medium",
            "risk_level": risk,
            "quality_impact": quality_impact,
            "root_cause": "Investigate manufacturing, packaging, and storage handling records.",
            "recommendations": recommendations,
            "completeness_score": completeness.get("score", 0),
            "duplicate_flag": duplicate.get("flag", False),
            "duplicate_reference": duplicate.get("reference"),
            "evidence": {"missing_fields": completeness.get("missing", []), "llm_summary": None},
        }

    result = graph.invoke(initial_state)
    return result.get("final", {})
