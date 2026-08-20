"""
Pydantic schemas for authentication, user management, password security, and MFA.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    confirm_password: Optional[str] = None
    full_name: str = Field(min_length=1, max_length=120)
    role: Optional[str] = "Developer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    code: Optional[str] = None
    redirect_uri: Optional[str] = None


class GitHubAuthRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    role: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)
    confirm_new_password: Optional[str] = None


class MFASetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_code_data_url: str


class MFAEnableRequest(BaseModel):
    secret: str
    totp_code: str = Field(min_length=6, max_length=8)


class MFAEnableResponse(BaseModel):
    message: str
    recovery_codes: List[str]


class MFALoginRequest(BaseModel):
    mfa_ticket: str
    totp_code: Optional[str] = None
    recovery_code: Optional[str] = None


class MFADisableRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    auth_provider: Optional[str] = "local"
    google_sub: Optional[str] = None
    github_id: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_mfa_enabled: bool = False
    password_changed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    csrf_token: Optional[str] = None
    user: UserResponse


class LoginResult(BaseModel):
    mfa_required: bool = False
    mfa_ticket: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    csrf_token: Optional[str] = None
    user: Optional[UserResponse] = None
