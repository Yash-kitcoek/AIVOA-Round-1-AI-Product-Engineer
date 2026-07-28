from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from .database import Base


class ComplaintRecord(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    complaint_number = Column(String(80), nullable=False, unique=True, index=True)
    product = Column(String(200), nullable=True)
    batch = Column(String(120), nullable=True)
    customer = Column(String(200), nullable=True)
    complaint_type = Column(String(120), nullable=True)
    complaint_date = Column(String(80), nullable=True)
    description = Column(Text, nullable=True)
    severity = Column(String(60), nullable=True)
    risk_level = Column(String(60), nullable=True)
    status = Column(String(80), nullable=True, default="Open")
    quality_impact = Column(String(200), nullable=True)
    root_cause = Column(String(300), nullable=True)
    recommendations = Column(Text, nullable=True)
    completeness_score = Column(Integer, nullable=True)
    duplicate_flag = Column(Boolean, default=False)
    duplicate_reference = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
