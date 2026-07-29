import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aivoa.db")

# Neon commonly provides a postgresql:// URI.
# Use psycopg 3 explicitly because this project installs psycopg[binary],
# not the legacy psycopg2 driver.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.removeprefix("postgresql://")

_is_sqlite = DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    # SQLite — minimal config, no pool management needed
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
    )
else:
    # PostgreSQL / Neon — use pool_pre_ping so SQLAlchemy tests the
    # connection before handing it to a request. This prevents the
    # "could not receive data from server" error that occurs when Neon's
    # serverless instances go to sleep between requests.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,          # re-connect if the connection dropped
        pool_size=5,                 # keep up to 5 connections warm
        max_overflow=10,             # allow up to 10 extra during bursts
        pool_recycle=300,            # recycle connections every 5 minutes
        pool_timeout=30,             # wait up to 30 s for a connection slot
        connect_args={
            "connect_timeout": 10,   # TCP handshake timeout in seconds
            "sslmode": "require",    # Neon always needs SSL
        },
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
