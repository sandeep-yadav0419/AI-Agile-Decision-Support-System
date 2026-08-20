"""
FastAPI application entrypoint.

AI-Driven Autonomous Decision Support System for Agile Software Project Management (AI-DSS).
Includes Production Security Hardening (CSP, HSTS, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy, Cache-Control, and Secure Error Handling).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app import models  # noqa: F401
from app.config import CORS_ORIGIN_REGEX, settings
from app.database import Base, engine, ensure_schema_compatibility, get_db
from app.routers import (
    activities,
    ai,
    auth,
    checkins,
    notifications,
    projects,
    recommendations,
    reports,
    risks,
    search,
    security_audit,
    sprints,
    tasks,
    team,
    users,
)
from app.schemas.user import GoogleAuthRequest, Token
from app.services.seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aidss.security")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safely migrate existing tables if new columns added
    ensure_schema_compatibility(engine)
    # Creates all tables registered on Base
    Base.metadata.create_all(bind=engine)

    # Auto-seed initial demo agile project data if database is fresh
    db = next(get_db())
    try:
        seed_demo_data(db)
    except Exception as e:
        logger.info(f"[AI-DSS Startup] Seed check info: {e}")
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)


# ==========================================
# PRODUCTION SECURITY HEADERS MIDDLEWARE
# ==========================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        if settings.ENABLE_SECURITY_HEADERS:
            # 1. Content Security Policy (Explicit allowed origins for scripts, styles, fonts, Google/GitHub OAuth)
            csp = (
                "default-src 'self'; "
                "script-src 'self' https://accounts.google.com https://apis.google.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com data:; "
                "img-src 'self' data: https: blob:; "
                "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.github.com http://localhost:* http://127.0.0.1:* https://localhost:*; "
                "frame-src 'self' https://accounts.google.com; "
                "frame-ancestors 'none'; "
                "object-src 'none'; "
                "base-uri 'self';"
            )
            response.headers["Content-Security-Policy"] = csp

            # 2. Frame & MIME Sniffing Protections
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"

            # 3. Referrer Policy & Permissions Policy
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"

            # 4. HSTS (HTTP Strict Transport Security) - Enabled only on HTTPS / Production
            if settings.effective_hsts or request.url.scheme == "https":
                response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

            # 5. Sensitive Cache Control on Authenticated Endpoints
            if request.url.path.startswith("/api/auth") or request.url.path.startswith("/api/reports"):
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
                response.headers["Pragma"] = "no-cache"

        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token", "Content-Disposition"],
)


# ==========================================
# SECURE ERROR HANDLING (NO STACK TRACE LEAKS)
# ==========================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Returns safe structured validation error without leaking sensitive internals."""
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        errors.append(f"{loc}: {err.get('msg', 'Invalid input')}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Input validation error: " + "; ".join(errors)},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catches all unexpected internal server errors (500).
    Logs the full traceback securely to server logs, but returns a generic safe message to users.
    """
    logger.error(f"[Unhandled Exception] {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected internal server error occurred. Please try again later."},
    )


# Register routers
app.include_router(auth.router)


# Alias /auth/google to /api/auth/google for broad client compatibility
@app.post("/auth/google", response_model=Token, tags=["auth"], include_in_schema=False)
async def auth_google_alias(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    return await auth.google_auth(payload, request, response, db)


app.include_router(security_audit.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(sprints.router)
app.include_router(tasks.router)
app.include_router(team.router)
app.include_router(ai.router)
app.include_router(recommendations.router)
app.include_router(risks.router)
app.include_router(reports.router)
app.include_router(activities.router)
app.include_router(checkins.router)
app.include_router(notifications.router)
app.include_router(search.router)


@app.get("/")
def root():
    return {
        "message": f"{settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if not settings.is_production else "Disabled in production",
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception:
        database_status = "disconnected"

    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": database_status,
    }


@app.post("/api/seed")
def trigger_seed(db: Session = Depends(get_db)):
    seed_demo_data(db)
    return {"message": "Demo agile data initialized successfully"}
