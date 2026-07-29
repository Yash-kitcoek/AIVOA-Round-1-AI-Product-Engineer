from datetime import datetime
from pydantic import BaseModel, Field


class ComplaintDraft(BaseModel):
    product_name: str = ""
    batch_number: str = ""
    complaint_type: str = ""
    country: str = ""
    customer_name: str = ""
    received_date: str = ""
    description: str = ""
    source_text: str = ""


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=10, max_length=30000)


class ComplaintCreate(ComplaintDraft):
    status: str = "Open"
    risk_level: str = "Pending"
    risk_score: int = 0
    ai_assessment: dict = {}


class ComplaintOut(ComplaintCreate):
    id: int
    complaint_number: str
    created_at: datetime
    class Config:
        from_attributes = True
