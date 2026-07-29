from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    complaint_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="Draft")
    product_name: Mapped[str] = mapped_column(String(255), default="")
    batch_number: Mapped[str] = mapped_column(String(100), default="")
    complaint_type: Mapped[str] = mapped_column(String(100), default="")
    country: Mapped[str] = mapped_column(String(100), default="")
    customer_name: Mapped[str] = mapped_column(String(255), default="")
    received_date: Mapped[str] = mapped_column(String(20), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    source_text: Mapped[str] = mapped_column(Text, default="")
    risk_level: Mapped[str] = mapped_column(String(30), default="Pending")
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    ai_assessment: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
