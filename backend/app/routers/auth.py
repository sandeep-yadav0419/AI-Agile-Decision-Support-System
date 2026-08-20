"""
Authentication router: register, login, MFA (TOTP + recovery codes),
password change, Google & GitHub OAuth 2.0, logout, and session revalidation.
"""
from datetime import datetime, timedelta, timezone
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.rate_limit import check_login_lockout, enforce_rate_limit
from app.core.security import (
    clear_session_cookies,
    create_access_token,
    create_mfa_challenge_token,
    decode_mfa_challenge_token,
    generate_csrf_token,
    generate_qr_code_data_url,
    generate_recovery_codes,
    generate_totp_secret,
    get_current_user,
    get_totp_uri,
    hash_password,
    log_security_audit,
    set_session_cookies,
    validate_password_strength,
    verify_and_consume_recovery_code,
    verify_github_identity,
    verify_google_identity,
    verify_password,
    verify_totp_code,
)
from app.database import get_db
from app.models.oauth import OAuthAccount
from app.models.user import User
from app.schemas.user import (
    GitHubAuthRequest,
    GoogleAuthRequest,
    LoginResult,
    MFADisableRequest,
    MFAEnableRequest,
    MFAEnableResponse,
    MFALoginRequest,
    MFASetupResponse,
    PasswordChange,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, max_requests=10, window_seconds=60, prefix="register")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    # Password policy & confirmation verification
    validate_password_strength(payload.password)
    if payload.confirm_password and payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password confirmation does not match the chosen password.",
        )

    clean_email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        log_security_audit(
            db, event_type="REGISTER_FAILED_DUPLICATE", status="FAILURE",
            ip_address=client_ip, user_agent=user_agent, details=f"Attempted email: {clean_email}"
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(
        email=clean_email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role or "Developer",
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    db.refresh(user)

    token = create_access_token(subject=user.email)
    csrf = generate_csrf_token()
    set_session_cookies(response, token, csrf)

    log_security_audit(
        db, event_type="REGISTER_SUCCESS", status="SUCCESS", user_id=user.id,
        ip_address=client_ip, user_agent=user_agent
    )

    return Token(access_token=token, csrf_token=csrf, user=UserResponse.model_validate(user))


@router.post("/login", response_model=LoginResult)
def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, max_requests=15, window_seconds=60, prefix="login")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    clean_email = payload.email.lower().strip()

    user = db.query(User).filter(User.email == clean_email).first()

    # Lockout check
    if user:
        is_locked, remaining_secs = check_login_lockout(user)
        if is_locked:
            log_security_audit(
                db, event_type="LOGIN_BLOCKED_LOCKOUT", status="BLOCKED", user_id=user.id,
                ip_address=client_ip, user_agent=user_agent, details=f"Locked for {remaining_secs}s"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked due to multiple failed login attempts. Try again in {remaining_secs} seconds.",
            )

    # Verify password credentials
    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                # 5-minute progressive temporary lockout
                user.lockout_until = datetime.now(timezone.utc) + timedelta(minutes=5)
            db.commit()

        log_security_audit(
            db, event_type="LOGIN_FAILED", status="FAILURE",
            user_id=user.id if user else None,
            ip_address=client_ip, user_agent=user_agent, details=f"Attempted email: {clean_email}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # Reset failed login count
    user.failed_login_attempts = 0
    user.lockout_until = None
    db.commit()

    # If MFA is enabled on this account, issue MFA challenge ticket instead of final JWT
    if user.is_mfa_enabled:
        mfa_ticket = create_mfa_challenge_token(subject=user.email)
        log_security_audit(
            db, event_type="MFA_CHALLENGE_ISSUED", status="SUCCESS", user_id=user.id,
            ip_address=client_ip, user_agent=user_agent
        )
        return LoginResult(
            mfa_required=True,
            mfa_ticket=mfa_ticket,
        )

    # Issue standard access token + session cookie
    token = create_access_token(subject=user.email)
    csrf = generate_csrf_token()
    set_session_cookies(response, token, csrf)

    log_security_audit(
        db, event_type="LOGIN_SUCCESS", status="SUCCESS", user_id=user.id,
        ip_address=client_ip, user_agent=user_agent
    )

    return LoginResult(
        mfa_required=False,
        access_token=token,
        csrf_token=csrf,
        user=UserResponse.model_validate(user),
    )


@router.post("/mfa/verify-login", response_model=Token)
def verify_mfa_login(
    payload: MFALoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Verifies TOTP code or backup recovery code against a valid MFA login challenge ticket.
    """
    enforce_rate_limit(request, max_requests=10, window_seconds=60, prefix="mfa_verify")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    email = decode_mfa_challenge_token(payload.mfa_ticket)
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_mfa_enabled or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA state")

    verified = False

    # Check 6-digit TOTP code
    if payload.totp_code:
        if verify_totp_code(user.mfa_secret, payload.totp_code):
            verified = True
            log_security_audit(
                db, event_type="MFA_LOGIN_SUCCESS", status="SUCCESS", user_id=user.id,
                ip_address=client_ip, user_agent=user_agent
            )

    # Check single-use backup recovery code
    elif payload.recovery_code:
        is_valid, remaining_json = verify_and_consume_recovery_code(
            payload.recovery_code, user.mfa_recovery_codes
        )
        if is_valid:
            verified = True
            user.mfa_recovery_codes = remaining_json
            db.commit()
            log_security_audit(
                db, event_type="MFA_RECOVERY_CODE_USED", status="SUCCESS", user_id=user.id,
                ip_address=client_ip, user_agent=user_agent
            )

    if not verified:
        log_security_audit(
            db, event_type="MFA_VERIFY_FAILED", status="FAILURE", user_id=user.id,
            ip_address=client_ip, user_agent=user_agent
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid two-factor authentication code or recovery code.",
        )

    token = create_access_token(subject=user.email)
    csrf = generate_csrf_token()
    set_session_cookies(response, token, csrf)

    return Token(access_token=token, csrf_token=csrf, user=UserResponse.model_validate(user))


@router.post("/mfa/setup", response_model=MFASetupResponse)
def setup_mfa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initializes MFA setup for the authenticated user by generating a TOTP secret and QR code.
    """
    secret = generate_totp_secret()
    otpauth_url = get_totp_uri(secret, current_user.email)
    qr_code_data_url = generate_qr_code_data_url(otpauth_url)

    return MFASetupResponse(
        secret=secret,
        otpauth_url=otpauth_url,
        qr_code_data_url=qr_code_data_url,
    )


@router.post("/mfa/enable", response_model=MFAEnableResponse)
def enable_mfa(
    payload: MFAEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifies user's first TOTP code and activates MFA, generating 8 single-use recovery codes.
    """
    if not verify_totp_code(payload.secret, payload.totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is incorrect. Please ensure your authenticator app time is synchronized.",
        )

    import json
    plain_codes, hashed_codes = generate_recovery_codes(count=8)

    current_user.is_mfa_enabled = True
    current_user.mfa_secret = payload.secret
    current_user.mfa_recovery_codes = json.dumps(hashed_codes)
    db.commit()

    log_security_audit(
        db, event_type="MFA_ENABLED", status="SUCCESS", user_id=current_user.id
    )

    return MFAEnableResponse(
        message="Two-Factor Authentication has been successfully enabled for your account.",
        recovery_codes=plain_codes,
    )


@router.post("/mfa/recovery-codes/regenerate", response_model=MFAEnableResponse)
def regenerate_recovery_codes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Regenerates a new set of 8 single-use recovery codes, revoking any old ones.
    """
    if not current_user.is_mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on this account.",
        )

    import json
    plain_codes, hashed_codes = generate_recovery_codes(count=8)
    current_user.mfa_recovery_codes = json.dumps(hashed_codes)
    db.commit()

    log_security_audit(
        db, event_type="MFA_RECOVERY_CODES_REGENERATED", status="SUCCESS", user_id=current_user.id
    )

    return MFAEnableResponse(
        message="New backup recovery codes generated. Old codes have been revoked.",
        recovery_codes=plain_codes,
    )


@router.post("/mfa/disable")
def disable_mfa(
    payload: MFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Disables MFA after verifying the account password.
    """
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Re-authentication required to disable MFA.",
        )

    current_user.is_mfa_enabled = False
    current_user.mfa_secret = None
    current_user.mfa_recovery_codes = None
    db.commit()

    log_security_audit(
        db, event_type="MFA_DISABLED", status="SUCCESS", user_id=current_user.id
    )

    return {"message": "Two-Factor Authentication has been disabled."}


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Safely changes password after verifying current credentials and enforcing strong password policies.
    """
    enforce_rate_limit(request, max_requests=5, window_seconds=60, prefix="change_pwd")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    if not verify_password(payload.current_password, current_user.hashed_password):
        log_security_audit(
            db, event_type="PASSWORD_CHANGE_FAILED", status="FAILURE", user_id=current_user.id,
            ip_address=client_ip, user_agent=user_agent
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    validate_password_strength(payload.new_password)

    if payload.confirm_new_password and payload.new_password != payload.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match.",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.password_changed_at = datetime.now(timezone.utc)
    db.commit()

    log_security_audit(
        db, event_type="PASSWORD_CHANGED", status="SUCCESS", user_id=current_user.id,
        ip_address=client_ip, user_agent=user_agent
    )

    return {"message": "Password changed successfully."}


@router.post("/google", response_model=Token)
async def google_auth(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, max_requests=20, window_seconds=60, prefix="oauth_google")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    google_profile = await verify_google_identity(
        id_token=payload.id_token,
        code=payload.code,
        redirect_uri=payload.redirect_uri,
    )

    email = google_profile["email"]
    user = db.query(User).filter(User.email == email).first()

    if user:
        if not user.google_sub and google_profile.get("google_sub"):
            user.google_sub = google_profile["google_sub"]
        if not user.avatar_url and google_profile.get("avatar_url"):
            user.avatar_url = google_profile["avatar_url"]
        db.commit()
        db.refresh(user)
    else:
        user = User(
            email=email,
            full_name=google_profile["full_name"],
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            role="Developer",
            auth_provider="google",
            google_sub=google_profile.get("google_sub"),
            avatar_url=google_profile.get("avatar_url"),
            is_active=True,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if not user:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to provision user")
        db.refresh(user)

    # Record OAuthAccount
    if google_profile.get("google_sub"):
        oauth_rec = db.query(OAuthAccount).filter(
            OAuthAccount.provider == "GOOGLE",
            OAuthAccount.provider_user_id == google_profile["google_sub"],
        ).first()
        if not oauth_rec:
            oauth_rec = OAuthAccount(
                user_id=user.id,
                provider="GOOGLE",
                provider_user_id=google_profile["google_sub"],
                provider_email=email,
            )
            db.add(oauth_rec)
            db.commit()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    token = create_access_token(subject=user.email)
    csrf = generate_csrf_token()
    set_session_cookies(response, token, csrf)

    log_security_audit(
        db, event_type="LOGIN_OAUTH_GOOGLE", status="SUCCESS", user_id=user.id,
        ip_address=client_ip, user_agent=user_agent
    )

    return Token(access_token=token, csrf_token=csrf, user=UserResponse.model_validate(user))


@router.post("/github", response_model=Token)
async def github_auth(
    payload: GitHubAuthRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, max_requests=20, window_seconds=60, prefix="oauth_github")
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    github_profile = await verify_github_identity(
        code=payload.code,
        redirect_uri=payload.redirect_uri,
    )

    email = github_profile["email"]
    github_id = github_profile["github_id"]

    oauth_acc = db.query(OAuthAccount).filter(
        OAuthAccount.provider == "GITHUB",
        OAuthAccount.provider_user_id == github_id,
    ).first()

    if oauth_acc:
        user = db.query(User).filter(User.id == oauth_acc.user_id).first()
    else:
        user = db.query(User).filter(User.email == email).first()

    if user:
        if not user.github_id:
            user.github_id = github_id
        if not user.avatar_url and github_profile.get("avatar_url"):
            user.avatar_url = github_profile["avatar_url"]
        db.commit()
        db.refresh(user)
    else:
        user = User(
            email=email,
            full_name=github_profile["full_name"],
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            role="Developer",
            auth_provider="github",
            github_id=github_id,
            avatar_url=github_profile.get("avatar_url"),
            is_active=True,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if not user:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to provision user")
        db.refresh(user)

    if not oauth_acc:
        oauth_acc = OAuthAccount(
            user_id=user.id,
            provider="GITHUB",
            provider_user_id=github_id,
            provider_email=email,
        )
        db.add(oauth_acc)
        db.commit()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    token = create_access_token(subject=user.email)
    csrf = generate_csrf_token()
    set_session_cookies(response, token, csrf)

    log_security_audit(
        db, event_type="LOGIN_OAUTH_GITHUB", status="SUCCESS", user_id=user.id,
        ip_address=client_ip, user_agent=user_agent
    )

    return Token(access_token=token, csrf_token=csrf, user=UserResponse.model_validate(user))


@router.post("/logout")
def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Clears session cookies and logs audit event.
    """
    clear_session_cookies(response)
    log_security_audit(
        db, event_type="LOGOUT", status="SUCCESS", user_id=current_user.id
    )
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
