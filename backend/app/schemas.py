from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ComplaintBase(BaseModel):
    complaint_number: str = Field(..., min_length=1)
    product: Optional[str] = None
    batch: Optional[str] = None
    customer: Optional[str] = None
    complaint_type: Optional[str] = None
    complaint_date: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = "Open"
    quality_impact: Optional[str] = None
    root_cause: Optional[str] = None
    recommendations: Optional[str] = None
    completeness_score: Optional[int] = None
    duplicate_flag: bool = False
    duplicate_reference: Optional[str] = None
    capa_actions: Optional[str] = None
    investigation_notes: Optional[str] = None
    ai_summary: Optional[str] = None
    regulatory_reportable: bool = False
    assigned_to: Optional[str] = None


class ComplaintCreate(ComplaintBase):
    pass


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    risk_level: Optional[str] = None
    severity: Optional[str] = None
    root_cause: Optional[str] = None
    recommendations: Optional[str] = None
    capa_actions: Optional[str] = None
    investigation_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    quality_impact: Optional[str] = None
    regulatory_reportable: Optional[bool] = None


class Complaint(ComplaintBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AnalysisEvidence(BaseModel):
    missing_fields: List[str] = []
    llm_summary: Optional[str] = None
    extraction_method: str = "heuristic"
    confidence_scores: Optional[dict] = None


class AnalysisResponse(BaseModel):
    complaint_number: str
    product: Optional[str]
    batch: Optional[str]
    customer: Optional[str]
    complaint_type: Optional[str]
    complaint_date: Optional[str]
    description: str
    severity: Optional[str]
    risk_level: Optional[str]
    quality_impact: Optional[str]
    root_cause: Optional[str]
    recommendations: Optional[str]
    capa_actions: Optional[str] = None
    ai_summary: Optional[str] = None
    regulatory_reportable: bool = False
    completeness_score: int
    duplicate_flag: bool
    duplicate_reference: Optional[str] = None
    evidence: AnalysisEvidence


class StatsResponse(BaseModel):
    total: int
    open: int
    under_investigation: int
    closed: int
    high_risk: int
    medium_risk: int
    low_risk: int
    avg_completeness: float
    regulatory_reportable: int
