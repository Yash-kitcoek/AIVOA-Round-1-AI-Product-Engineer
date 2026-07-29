from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


# ── Complaint creation payload ────────────────────────────────────────────────
# Field names match what App.jsx sends in the `draft` object.

class ComplaintCreate(BaseModel):
    # Origin & Customer
    complaint_source: str = ""
    customer_name: str = ""

    # Product & Batch
    product_name: str = ""
    product_strength: str = ""
    batch_number: str = ""
    manufacturing_date: str = ""
    expiry_date: str = ""
    affected_quantity: str = ""
    originating_site: str = ""
    impacted_materials: str = ""
    country: str = ""

    # Complaint Details
    complaint_type: str = ""
    complaint_date: str = ""
    received_date: str = ""
    description: str = ""
    source_text: str = ""

    # Assessment
    severity: str = ""
    priority: str = ""
    status: str = "Open"
    risk_level: str = "Pending"
    risk_score: int = 0

    # AI outputs
    quality_impact: str = ""
    root_cause: str = ""
    recommendations: str = ""
    capa_actions: str = ""
    ai_summary: str = ""
    completeness_score: int = 0
    duplicate_flag: bool = False
    duplicate_reference: str = ""
    regulatory_reportable: bool = False

    # Raw AI blob
    ai_assessment: Dict[str, Any] = {}


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    investigation_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    severity: Optional[str] = None
    risk_level: Optional[str] = None


class ComplaintOut(ComplaintCreate):
    id: int
    complaint_number: str
    investigation_notes: str = ""
    assigned_to: str = ""
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=10, max_length=30000)
    current_draft: Optional[Dict[str, Any]] = None


class StatsOut(BaseModel):
    total: int = 0
    open: int = 0
    under_investigation: int = 0
    closed: int = 0
    high_risk: int = 0
    regulatory_reportable: int = 0
    avg_completeness: int = 0
