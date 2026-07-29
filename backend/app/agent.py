import os
import re
from typing import TypedDict
from langgraph.graph import END, StateGraph


class AgentState(TypedDict, total=False):
    text: str
    complaint: dict
    assessment: dict
    existing: list[dict]


def extract(state: AgentState):
    text = state["text"]
    lower = text.lower()
    def match(pattern):
        found = re.search(pattern, text, re.I)
        return found.group(1).strip(" .,:;") if found else ""
    product = match(r"(?:product|medicine|tablet|capsule)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9 -]{2,40})")
    batch = match(r"(?:batch|lot)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Za-z0-9-]{3,30})")
    categories = {"Packaging": ["pack", "blister", "seal", "carton"], "Quality defect": ["broken", "discolor", "particle", "contamin", "crack"], "Adverse event": ["hospital", "adverse", "injury", "reaction"], "Labelling": ["label", "leaflet", "expiry", "misprint"], "Delivery": ["delivery", "shipment", "transport"]}
    complaint_type = next((name for name, words in categories.items() if any(w in lower for w in words)), "Product quality")
    return {"complaint": {"product_name": product, "batch_number": batch, "complaint_type": complaint_type, "country": match(r"(?:country|market)\s*[:#-]?\s*([A-Za-z ]{3,30})"), "customer_name": match(r"(?:from|customer|distributor)\s*[:#-]?\s*([A-Za-z][A-Za-z .&-]{2,40})"), "received_date": "", "description": text[:1200], "source_text": text}}


def assess(state: AgentState):
    text = state["text"].lower()
    high_terms = ["hospital", "death", "serious", "contamin", "foreign particle", "adverse reaction", "recall"]
    medium_terms = ["broken", "crack", "leak", "missing", "wrong label", "discolor"]
    hits = [w for w in high_terms if w in text]
    score = 80 if hits else (55 if any(w in text for w in medium_terms) else 25)
    level = "Critical" if score >= 80 else "Major" if score >= 50 else "Minor"
    c = state["complaint"]
    missing = [label for key, label in [("product_name", "product name"), ("batch_number", "batch / lot number"), ("customer_name", "customer / reporter"), ("country", "country / market")] if not c.get(key)]
    rationale = "Potential patient-safety signal requires expedited Quality review." if hits else "Risk based on reported product defect and available complaint details."
    return {"assessment": {"risk_level": level, "risk_score": score, "rationale": rationale, "safety_signals": hits or ["No explicit patient harm reported"], "missing_information": missing, "duplicate_candidates": state.get("existing", [])[:3], "root_cause_hypotheses": ["Review batch manufacturing and in-process controls", "Inspect packaging-line parameters and retain samples"], "capa_recommendation": "Quarantine related retain samples, open an investigation, assess distribution impact, and document effectiveness checks.", "human_review_required": True, "model": "langgraph-rule-based-demo"}}


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("extract", extract)
    graph.add_node("assess", assess)
    graph.set_entry_point("extract")
    graph.add_edge("extract", "assess")
    graph.add_edge("assess", END)
    return graph.compile()


complaint_graph = build_graph()
