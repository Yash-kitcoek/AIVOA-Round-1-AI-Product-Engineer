from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Complaint(Base):
    __tablename__ = "complaints"

    # ── Primary key ──────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    complaint_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="Open")

    # ── Origin & Customer ─────────────────────────────────────────────────────
    complaint_source: Mapped[str] = mapped_column(String(100), default="")
    customer_name: Mapped[str] = mapped_column(String(255), default="")

    # ── Product & Batch ───────────────────────────────────────────────────────
    product_name: Mapped[str] = mapped_column(String(255), default="")
    product_strength: Mapped[str] = mapped_column(String(100), default="")
    batch_number: Mapped[str] = mapped_column(String(100), default="")
    manufacturing_date: Mapped[str] = mapped_column(String(50), default="")
    expiry_date: Mapped[str] = mapped_column(String(50), default="")
    affected_quantity: Mapped[str] = mapped_column(String(100), default="")
    originating_site: Mapped[str] = mapped_column(String(255), default="")
    impacted_materials: Mapped[str] = mapped_column(String(255), default="")
    country: Mapped[str] = mapped_column(String(100), default="")

    # ── Complaint Details ─────────────────────────────────────────────────────
    complaint_type: Mapped[str] = mapped_column(String(100), default="")
    complaint_date: Mapped[str] = mapped_column(String(30), default="")
    received_date: Mapped[str] = mapped_column(String(30), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    source_text: Mapped[str] = mapped_column(Text, default="")

    # ── Assessment ────────────────────────────────────────────────────────────
    severity: Mapped[str] = mapped_column(String(30), default="")
    priority: Mapped[str] = mapped_column(String(30), default="")
    risk_level: Mapped[str] = mapped_column(String(30), default="Pending")
    risk_score: Mapped[int] = mapped_column(Integer, default=0)

    # ── AI outputs ────────────────────────────────────────────────────────────
    quality_impact: Mapped[str] = mapped_column(Text, default="")
    root_cause: Mapped[str] = mapped_column(Text, default="")
    recommendations: Mapped[str] = mapped_column(Text, default="")
    capa_actions: Mapped[str] = mapped_column(Text, default="")
    ai_summary: Mapped[str] = mapped_column(Text, default="")
    completeness_score: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    duplicate_reference: Mapped[str] = mapped_column(String(50), default="")
    regulatory_reportable: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Investigation ─────────────────────────────────────────────────────────
    investigation_notes: Mapped[str] = mapped_column(Text, default="")
    assigned_to: Mapped[str] = mapped_column(String(255), default="")

    # ── Raw AI assessment JSON blob (legacy / bonus) ───────────────────────
    ai_assessment: Mapped[str] = mapped_column(Text, default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
