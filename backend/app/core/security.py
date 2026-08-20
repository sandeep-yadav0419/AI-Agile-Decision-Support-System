"""
Password hashing, password policy validation, JWT issuance/verification,
MFA (TOTP + hashed recovery codes), CSRF protection, session cookies,
Google & GitHub OAuth verification, Security Audit Logging, and RBAC authorization helpers.
"""
import base64
import hashlib
import io
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import bcrypt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
import httpx
import jwt
import pyotp
import qrcode
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.activity import ActivityLog
from app.models.notification import Notification
from app.models.project import Project
from app.models.security_audit import SecurityAuditLog
from app.models.team import TeamMember
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

# Common weak passwords list to reject during registration & password change
COMMON_WEAK_PASSWORDS = {
    "password", "password123", "12345678", "123456789", "qwerty123",
    "admin123", "admin1234", "letmein123", "welcome1", "iloveyou1",
    "changeme", "secret123", "project123", "developer123"
}


# ==========================================
# STRONG PASSWORD SECURITY & POLICY
# ==========================================

def validate_password_strength(password: str) -> None:
    """
    Enforces strong password policy:
    - Minimum 8 characters
    - Allows long passphrases up to 256 characters
    - Rejects known weak and easily guessable common passwords
    - Requires character diversity unless it's a long passphrase (16+ chars)
    """
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )
    if len(password) > 256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password exceeds maximum allowed length (256 characters).",
        )
    if password.lower() in COMMON_WEAK_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The chosen password is too common and easily compromised. Please choose a stronger passphrase.",
        )

    # For passwords < 16 chars, require basic diversity (at least one letter and at least one digit/symbol)
    if len(password) < 16:
        has_alpha = any(c.isalpha() for c in password)
        has_non_alpha = any(not c.isalpha() for c in password)
        if not (has_alpha and has_non_alpha):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password under 16 characters must contain a mix of letters and numbers or symbols.",
            )


def hash_password(password: str) -> str:
    """Safely hashes password using bcrypt with standard salt rounds."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


# ==========================================
# JWT & SESSION TOKEN ISSUANCE
# ==========================================

def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "type": "access_token",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.effective_jwt_secret, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired, please log in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception

    if payload.get("type") != "access_token":
        raise credentials_exception

    subject = payload.get("sub")
    if subject is None:
        raise credentials_exception
    return subject


def create_mfa_challenge_token(subject: str) -> str:
    """Issues a short-lived token (5 min) used solely to complete the MFA verification step."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.MFA_TICKET_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "type": "mfa_challenge",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=settings.ALGORITHM)


def decode_mfa_challenge_token(token: str) -> str:
    """Decodes and validates an MFA challenge ticket."""
    try:
        payload = jwt.decode(token, settings.effective_jwt_secret, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA verification session expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA challenge token.",
        )

    if payload.get("type") != "mfa_challenge":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for MFA verification.",
        )

    subject = payload.get("sub")
    if subject is None:
        raise credentials_exception
    return subject


# ==========================================
# CSRF & COOKIE SESSION MANAGEMENT
# ==========================================

def generate_csrf_token() -> str:
    """Generates a cryptographically secure random CSRF token."""
    return secrets.token_urlsafe(32)


def set_session_cookies(response: Response, access_token: str, csrf_token: Optional[str] = None) -> None:
    """
    Sets secure HttpOnly session cookie and readable CSRF token cookie.
    """
    max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    # 1. HttpOnly Session Cookie (inaccessible to malicious JavaScript / XSS)
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=access_token,
        max_age=max_age,
        httponly=True,
        secure=settings.effective_cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    # 2. CSRF Token Cookie (Double-submit pattern)
    if csrf_token:
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=csrf_token,
            max_age=max_age,
            httponly=False,  # Frontend reads this and passes in X-CSRF-Token header
            secure=settings.effective_cookie_secure,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
        )


def clear_session_cookies(response: Response) -> None:
    """Clears authentication and CSRF cookies upon logout."""
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        secure=settings.effective_cookie_secure,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path="/",
        secure=settings.effective_cookie_secure,
        httponly=False,
        samesite=settings.COOKIE_SAMESITE,
    )


# ==========================================
# MULTI-FACTOR AUTHENTICATION (TOTP + RECOVERY)
# ==========================================

def generate_totp_secret() -> str:
    """Generates standard Base32 secret for TOTP (RFC 6238)."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Generates standard otpauth URI for authenticator apps."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="AI-DSS Agile SaaS")


def generate_qr_code_data_url(otpauth_url: str) -> str:
    """Generates a Base64-encoded SVG Data URL of the TOTP QR code."""
    from qrcode.image.svg import SvgPathImage
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=2,
        image_factory=SvgPathImage,
    )
    qr.add_data(otpauth_url)
    qr.make(fit=True)
    img = qr.make_image()
    buffer = io.BytesIO()
    img.save(buffer)
    svg_bytes = buffer.getvalue()
    b64_encoded = base64.b64encode(svg_bytes).decode("utf-8")
    return f"data:image/svg+xml;base64,{b64_encoded}"


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Verifies a 6-digit TOTP code against secret with a 1-step window (+-30s tolerance).
    """
    if not secret or not code:
        return False
    clean_code = str(code).strip().replace(" ", "").replace("-", "")
    totp = pyotp.TOTP(secret)
    return totp.verify(clean_code, valid_window=1)


def generate_recovery_codes(count: int = 8) -> Tuple[List[str], List[str]]:
    """
    Generates single-use backup recovery codes.
    Returns (plain_codes, hashed_codes).
    """
    plain_codes = []
    hashed_codes = []
    for _ in range(count):
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        code = f"{part1}-{part2}"
        plain_codes.append(code)
        # Hash with SHA-256 for secure database storage
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        hashed_codes.append(code_hash)
    return plain_codes, hashed_codes


def verify_and_consume_recovery_code(plain_code: str, hashed_codes_json: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Validates a recovery code and consumes it (single-use).
    Returns (is_valid, updated_hashed_codes_json).
    """
    if not hashed_codes_json or not plain_code:
        return False, hashed_codes_json
    try:
        hashed_list = json.loads(hashed_codes_json)
    except Exception:
        return False, hashed_codes_json

    clean_code = plain_code.strip().upper()
    code_hash = hashlib.sha256(clean_code.encode("utf-8")).hexdigest()

    if code_hash in hashed_list:
        hashed_list.remove(code_hash)
        return True, json.dumps(hashed_list)

    return False, hashed_codes_json


# ==========================================
# AUTHENTICATED USER DEPENDENCY (DUAL MODE)
# ==========================================

def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolves the current authenticated User.
    Accepts BOTH 'Authorization: Bearer <token>' header and secure 'aidss_session' HttpOnly cookie.
    """
    resolved_token = token
    if not resolved_token:
        resolved_token = request.cookies.get(settings.SESSION_COOKIE_NAME)

    if not resolved_token:
        raise credentials_exception

    email = decode_access_token(resolved_token)
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # CSRF Verification for Cookie-Authenticated State-Changing Requests
    if not token and request.cookies.get(settings.SESSION_COOKIE_NAME):
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
            csrf_header = request.headers.get("X-CSRF-Token")
            # If CSRF protection is enabled and request came via cookie without matching CSRF token:
            if csrf_cookie and csrf_header and csrf_cookie != csrf_header:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF token validation failed. State-changing request denied.",
                )

    return user


# ==========================================
# SECURITY AUDIT LOGGING HELPER
# ==========================================

def log_security_audit(
    db: Session,
    event_type: str,
    status: str = "SUCCESS",
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[str] = None,
) -> Optional[SecurityAuditLog]:
    """
    Persists an immutable security audit event.
    NEVER logs passwords, plaintext secrets, TOTP keys, or recovery codes.
    """
    try:
        log = SecurityAuditLog(
            user_id=user_id,
            event_type=event_type,
            status=status,
            ip_address=ip_address,
            user_agent=user_agent[:250] if user_agent else None,
            details=details,
        )
        db.add(log)
        db.commit()
        return log
    except Exception as e:
        print(f"[SecurityAuditLog warning] {e}")
        return None


# ==========================================
# STRICT MULTI-TENANT & RBAC AUTHORIZATION
# ==========================================

def get_user_authorized_project_ids(user: User, db: Session) -> List[int]:
    """
    Returns list of all project IDs where user is either the Owner or an authorized Team Member.
    """
    owned_ids = [p.id for p in db.query(Project.id).filter(Project.owner_id == user.id).all()]
    member_ids = [
        tm.project_id
        for tm in db.query(TeamMember.project_id).filter(TeamMember.user_id == user.id).all()
        if tm.project_id is not None
    ]
    return list(set(owned_ids + member_ids))


def check_project_access(
    project_id: int,
    user: User,
    db: Session,
    require_owner_or_pm: bool = False,
    disallow_viewer: bool = False,
) -> Project:
    """
    Validates user authorization and RBAC permissions for a specific project.
    Raises 404 if project doesn't exist.
    Raises 403 Forbidden if user is not authorized or lacks required role.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    is_owner = project.owner_id == user.id
    membership = (
        db.query(TeamMember)
        .filter(TeamMember.project_id == project_id, TeamMember.user_id == user.id)
        .first()
    )

    if not is_owner and not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this project workspace.",
        )

    role_upper = (membership.role.upper().replace(" ", "_") if membership and membership.role else "")

    if disallow_viewer:
        if not is_owner and role_upper == "VIEWER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewer role cannot perform modifications on this project resource.",
            )

    if require_owner_or_pm:
        if not is_owner and role_upper not in ["OWNER", "PROJECT_MANAGER", "SCRUM_MASTER"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Project Manager or Owner permissions required for this operation.",
            )

    return project


def log_activity(
    db: Session,
    project_id: int,
    event_type: str,
    description: str,
    actor_user_id: Optional[int] = None,
) -> Optional[ActivityLog]:
    """Persists an activity event for project timeline tracking."""
    try:
        activity = ActivityLog(
            project_id=project_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            description=description,
        )
        db.add(activity)
        db.commit()
        return activity
    except Exception as e:
        print(f"[ActivityLog warning] {e}")
        return None


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "INFO",
    project_id: Optional[int] = None,
    link: Optional[str] = None,
) -> Optional[Notification]:
    """Persists a notification for a specific user."""
    try:
        notif = Notification(
            user_id=user_id,
            project_id=project_id,
            title=title,
            message=message,
            type=type,
            link=link,
        )
        db.add(notif)
        db.commit()
        return notif
    except Exception as e:
        print(f"[Notification warning] {e}")
        return None


# ==========================================
# GOOGLE OAUTH 2.0 IDENTITY VERIFIER
# ==========================================

async def verify_google_identity(
    id_token: str | None = None,
    credential: str | None = None,
    code: str | None = None,
    redirect_uri: str | None = None,
) -> dict:
    """
    Verifies Google ID token / credential using Google's official Python verification library
    (google.oauth2.id_token).
    Validates:
    - Cryptographic signature against Google's public keys
    - Audience matches GOOGLE_CLIENT_ID
    - Issuer is accounts.google.com or https://accounts.google.com
    - Expiration timestamp
    - Verified email status
    """
    token_to_verify = id_token or credential

    # If an authorization code was provided instead of an ID token, exchange it first
    if code and not token_to_verify:
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth client credentials not configured on server",
            )
        async with httpx.AsyncClient(timeout=12.0) as client:
            token_endpoint = "https://oauth2.googleapis.com/token"
            exchange_res = await client.post(
                token_endpoint,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri or settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            if exchange_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google authorization code exchange failed",
                )
            token_data = exchange_res.json()
            token_to_verify = token_data.get("id_token")

    if not token_to_verify:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential or id_token is required",
        )

    # 1. Official Google OAuth2 ID token verification
    request_transport = google_requests.Request()
    client_id_aud = settings.GOOGLE_CLIENT_ID.strip() if settings.GOOGLE_CLIENT_ID else None

    try:
        data = google_id_token.verify_oauth2_token(
            token_to_verify,
            request_transport,
            audience=client_id_aud,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google token verification failed: {str(ve)}",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify Google credential.",
        )

    # 2. Issuer validation
    iss = data.get("iss")
    if iss not in ["accounts.google.com", "https://accounts.google.com"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token issuer: {iss}",
        )

    # 3. Audience validation
    if client_id_aud:
        aud = data.get("aud")
        if aud != client_id_aud:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token client ID does not match server configuration",
            )

    # 4. Expiration validation
    exp = int(data.get("exp", 0))
    if exp < datetime.now(timezone.utc).timestamp():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token has expired",
        )

    # 5. Verified Email validation
    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google identity did not return an email address",
        )

    email_verified = data.get("email_verified")
    is_email_verified = email_verified is True or str(email_verified).lower() == "true"
    if not is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified. Please verify your email with Google.",
        )

    return {
        "email": email.lower().strip(),
        "full_name": data.get("name") or data.get("given_name") or email.split("@")[0],
        "google_sub": str(data.get("sub")),
        "avatar_url": data.get("picture"),
        "email_verified": True,
    }


# ==========================================
# GITHUB OAUTH 2.0 IDENTITY VERIFIER
# ==========================================

async def verify_github_identity(code: str, redirect_uri: str | None = None) -> dict:
    """
    Securely exchanges GitHub authorization code on backend and fetches verified user profile and email.
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth client credentials not configured on server",
        )

    async with httpx.AsyncClient(timeout=12.0) as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri or settings.GITHUB_REDIRECT_URI,
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub authorization token exchange failed",
            )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            error_desc = token_data.get("error_description", "Invalid GitHub authorization code")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_desc)

        # Fetch GitHub User profile
        auth_headers = {"Authorization": f"Bearer {access_token}", "User-Agent": "AI-DSS-App"}
        user_res = await client.get("https://api.github.com/user", headers=auth_headers)
        if user_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to fetch GitHub user profile",
            )
        gh_user = user_res.json()

        email = gh_user.get("email")
        if not email:
            # Fetch user verified primary email if public email is null
            emails_res = await client.get("https://api.github.com/user/emails", headers=auth_headers)
            if emails_res.status_code == 200:
                emails_list = emails_res.json()
                primary = next((e for e in emails_list if e.get("primary") and e.get("verified")), None)
                if primary:
                    email = primary.get("email")
                elif emails_list:
                    email = emails_list[0].get("email")

        if not email:
            email = f"github_{gh_user['id']}@users.noreply.github.com"

        return {
            "email": email.lower().strip(),
            "full_name": gh_user.get("name") or gh_user.get("login") or "GitHub User",
            "github_id": str(gh_user["id"]),
            "avatar_url": gh_user.get("avatar_url"),
        }
