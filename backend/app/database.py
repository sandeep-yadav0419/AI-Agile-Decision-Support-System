"""
SQLAlchemy engine, session factory, declarative base, and safe schema migration helpers.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# check_same_thread=False is required for SQLite when it's accessed from
# more than one thread, which FastAPI's threadpool will do.
connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_compatibility(db_engine):
    """
    Safely checks and adds any missing columns to existing SQLite tables without data loss.
    """
    if not str(db_engine.url).startswith("sqlite"):
        return

    with db_engine.connect() as conn:
        try:
            # Check users columns
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            existing_cols = [row[1] for row in res]
            if existing_cols:
                if "auth_provider" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'local'"))
                if "google_sub" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR"))
                if "github_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN github_id VARCHAR"))
                if "avatar_url" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
                if "is_mfa_enabled" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_mfa_enabled BOOLEAN DEFAULT 0"))
                if "mfa_secret" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN mfa_secret VARCHAR"))
                if "mfa_recovery_codes" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN mfa_recovery_codes TEXT"))
                if "failed_login_attempts" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
                if "lockout_until" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN lockout_until DATETIME"))
                if "password_changed_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN password_changed_at DATETIME"))

            # Check projects columns
            res_p = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
            existing_p_cols = [row[1] for row in res_p]
            if existing_p_cols:
                if "goal" not in existing_p_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN goal TEXT"))
                if "sprint_duration_weeks" not in existing_p_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN sprint_duration_weeks INTEGER DEFAULT 2"))
                if "working_days" not in existing_p_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN working_days VARCHAR DEFAULT 'Mon-Fri'"))

            conn.commit()
        except Exception as e:
            print(f"[Schema compatibility note] {e}")


def get_db():
    """FastAPI dependency: yields a DB session and guarantees it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
