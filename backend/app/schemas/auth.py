from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "DEVELOPER"
    avatar_url: Optional[str] = None
    skills: Optional[List[str]] = []
    active_status: str = "AVAILABLE"
    is_verified: bool = True

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class RegisterResponse(BaseModel):
    message: str
    email: str
    is_verified: bool
    requires_verification: bool = True
    verification_code: Optional[str] = None

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class VerifyEmailResponse(BaseModel):
    success: bool
    message: str
    token: Optional[Token] = None

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class ResendVerificationResponse(BaseModel):
    success: bool
    message: str
    verification_code: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    skills: Optional[List[str]] = None
    active_status: Optional[str] = None

class RoleSwitchRequest(BaseModel):
    role: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Password Reset Schemas
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    message: str
    simulated_reset_link: Optional[str] = None
    expires_in_minutes: int = 15

class VerifyResetTokenRequest(BaseModel):
    token: str

class VerifyResetTokenResponse(BaseModel):
    valid: bool
    status: str  # "VALID", "EXPIRED", "USED", "INVALID"
    email: Optional[str] = None
    message: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ResetPasswordResponse(BaseModel):
    success: bool
    message: str

Token.model_rebuild()
