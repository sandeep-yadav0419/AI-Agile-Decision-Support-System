"""
Application configuration.

Settings are loaded from environment variables / a local .env file via
pydantic-settings.
"""
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "AI-Driven Autonomous Decision Support System"
    APP_VERSION: str = "0.3.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # "development", "staging", "production"
    DATABASE_URL: str = "sqlite:///./app.db"

    # JWT Authentication & Session Secrets
    SECRET_KEY: str = "replace-with-a-secure-random-secret-key-in-production"
    JWT_SECRET_KEY: Optional[str] = None
    CSRF_SECRET: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h
    MFA_TICKET_EXPIRE_MINUTES: int = 5  # 5 min for MFA challenge
    PASSWORD_RESET_EXPIRE_MINUTES: int = 15

    # Cookie Configuration
    SESSION_COOKIE_NAME: str = "aidss_session"
    CSRF_COOKIE_NAME: str = "aidss_csrf"
    COOKIE_SECURE: Optional[bool] = None  # None = auto-detect based on ENVIRONMENT
    COOKIE_SAMESITE: str = "lax"

    # Security Policies
    ENABLE_RATE_LIMITING: bool = True
    ENABLE_SECURITY_HEADERS: bool = True
    ENABLE_HSTS: Optional[bool] = None  # None = enabled only on production/HTTPS
    ENABLE_DEMO_SEED: bool = True

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ai-agile-decision-support-system.vercel.app",
        "https://ai-agile-decision-support-system.onrender.com",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.strip():
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return list(v)
        return v

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173"

    # GitHub OAuth 2.0
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:5173"

    # The mail provider is intentionally external to the core application. In
    # production, the reset endpoint never returns the token to the caller.
    PASSWORD_RESET_URL: str = "http://localhost:5173/reset-password"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def effective_jwt_secret(self) -> str:
        return self.JWT_SECRET_KEY or self.SECRET_KEY

    @property
    def effective_csrf_secret(self) -> str:
        return self.CSRF_SECRET or self.effective_jwt_secret

    @property
    def effective_cookie_secure(self) -> bool:
        if self.COOKIE_SECURE is not None:
            return self.COOKIE_SECURE
        return self.is_production

    @property
    def effective_hsts(self) -> bool:
        if self.ENABLE_HSTS is not None:
            return self.ENABLE_HSTS
        return self.is_production

    @model_validator(mode="after")
    def validate_production_security(self):
        """Refuse to boot production with development-grade secrets or unsafe demo data."""
        if not self.is_production:
            return self

        insecure_values = {
            "replace-with-a-secure-random-secret-key-in-production",
            "replace-with-a-distinct-jwt-secret-key-in-production",
            "replace-with-a-secure-csrf-secret-key-in-production",
            "",
        }
        configured = {
            "JWT_SECRET_KEY": self.effective_jwt_secret,
            "CSRF_SECRET": self.effective_csrf_secret,
        }
        invalid = [name for name, value in configured.items() if value in insecure_values or len(value) < 32]
        if invalid:
            raise ValueError(
                "Production security configuration is invalid: set random values of at least "
                f"32 characters for {', '.join(invalid)}."
            )
        if self.ENABLE_DEMO_SEED:
            raise ValueError("ENABLE_DEMO_SEED must be False in production.")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Matches any port on localhost/127.0.0.1 rather than hardcoding one exact port
CORS_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1):\d+$"
