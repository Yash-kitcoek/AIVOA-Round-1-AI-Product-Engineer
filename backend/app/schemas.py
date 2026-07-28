from datetime import datetime
from typing import Optional

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


class ComplaintCreate(ComplaintBase):
    pass


class Complaint(ComplaintBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


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
    completeness_score: int
    duplicate_flag: bool
    duplicate_reference: Optional[str] = None
    evidence: dict
