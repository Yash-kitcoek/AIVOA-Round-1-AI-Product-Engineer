import json
import os
from typing import Any, TypedDict

from dotenv import load_dotenv
from groq import BadRequestError, Groq
from langgraph.graph import END, StateGraph

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError(
        "GROQ_API_KEY is missing. Add it to backend/.env, then restart Uvicorn."
    )

client = Groq(api_key=api_key)
# Groq has decommissioned gemma2-9b-it. The assignment explicitly permits
# Llama 3.3 70B as the context-capable production fallback.
MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODEL = "llama-3.3-70b-versatile"

COMPLAINT_FIELDS = [
    "complaint_source",
    "customer_name",
    "product_name",
    "product_strength",
    "batch_number",
    "affected_quantity",
    "manufacturing_date",
    "expiry_date",
    "originating_site",
    "impacted_materials",
    "complaint_type",
    "country",
    "received_date",
    "description",
    "source_text",
]

SYSTEM_PROMPT = """
You are AIVOA Copilot, an AI assistant for pharmaceutical customer complaint intake.

Read the customer's latest message and update the complaint record.
Use current_form_values to preserve existing values. Change only fields explicitly
corrected or provided in the latest input.

Never invent facts. Use an empty string for unavailable data.
For contamination, foreign matter, serious adverse event, or patient-safety risk,
use Critical severity. For product defects such as discoloration, cracks, leaks,
or broken blisters, use Major unless evidence indicates Critical.

Return valid JSON only with exactly this shape:

{
  "complaint": {
    "complaint_source": "",
    "customer_name": "",
    "product_name": "",
    "product_strength": "",
    "batch_number": "",
    "affected_quantity": "",
    "manufacturing_date": "",
    "expiry_date": "",
    "originating_site": "",
    "impacted_materials": "",
    "complaint_type": "",
    "country": "",
    "received_date": "",
    "description": "",
    "source_text": ""
  },
  "assessment": {
    "risk_level": "Minor",
    "risk_score": 0,
    "rationale": "",
    "missing_information": [],
    "duplicate_explanation": "",
    "root_cause_hypotheses": [],
    "capa_recommendation": "",
    "human_review_required": true
  }
}
"""


class AgentState(TypedDict, total=False):
    text: str
    current_draft: dict[str, Any]
    existing: list[dict[str, Any]]
    complaint: dict[str, Any]
    assessment: dict[str, Any]


def create_completion(model: str, state: AgentState):
    return client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "current_form_values": state.get("current_draft", {}),
                        "duplicate_candidates": state.get("existing", []),
                        "new_input": state["text"],
                    }
                ),
            },
        ],
    )


def groq_intake(state: AgentState) -> dict[str, Any]:
    try:
        response = create_completion(MODEL_NAME, state)
    except BadRequestError as error:
        # A configured legacy Gemma name should not make the application fail.
        if "decommissioned" not in str(error).lower() or MODEL_NAME == FALLBACK_MODEL:
            raise
        response = create_completion(FALLBACK_MODEL, state)

    result = json.loads(response.choices[0].message.content)

    return {
        "complaint": result.get("complaint", {}),
        "assessment": result.get("assessment", {}),
    }


def normalize_result(state: AgentState) -> dict[str, Any]:
    current = state.get("current_draft", {})
    raw_complaint = state.get("complaint", {})
    raw_assessment = state.get("assessment", {})

    # Preserve earlier form values when the Copilot returns blanks.
    complaint = {
        field: raw_complaint.get(field) or current.get(field, "")
        for field in COMPLAINT_FIELDS
    }

    assessment = {
        "risk_level": raw_assessment.get("risk_level", "Minor"),
        "risk_score": int(raw_assessment.get("risk_score", 0) or 0),
        "rationale": raw_assessment.get("rationale", ""),
        "missing_information": raw_assessment.get("missing_information", []),
        "duplicate_explanation": raw_assessment.get(
            "duplicate_explanation", "No likely duplicate identified."
        ),
        "root_cause_hypotheses": raw_assessment.get(
            "root_cause_hypotheses", []
        ),
        "capa_recommendation": raw_assessment.get(
            "capa_recommendation",
            "Route to Quality Assurance for review and investigation.",
        ),
        "human_review_required": True,
    }

    return {"complaint": complaint, "assessment": assessment}


workflow = StateGraph(AgentState)
workflow.add_node("groq_intake", groq_intake)
workflow.add_node("normalize_result", normalize_result)

workflow.set_entry_point("groq_intake")
workflow.add_edge("groq_intake", "normalize_result")
workflow.add_edge("normalize_result", END)

complaint_graph = workflow.compile()
