"""
Application configuration.

Settings are loaded from environment variables / a local .env file via
pydantic-settings.
"""
from typing import Optional
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

    # Cookie Configuration
    SESSION_COOKIE_NAME: str = "aidss_session"
    CSRF_COOKIE_NAME: str = "aidss_csrf"
    COOKIE_SECURE: Optional[bool] = None  # None = auto-detect based on ENVIRONMENT
    COOKIE_SAMESITE: str = "lax"

    # Security Policies
    ENABLE_RATE_LIMITING: bool = True
    ENABLE_SECURITY_HEADERS: bool = True
    ENABLE_HSTS: Optional[bool] = None  # None = enabled only on production/HTTPS

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173"

    # GitHub OAuth 2.0
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:5173"

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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Matches any port on localhost/127.0.0.1 rather than hardcoding one exact port
CORS_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1):\d+$"
