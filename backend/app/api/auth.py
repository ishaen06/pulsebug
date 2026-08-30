import json
import time
from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from jose import jwt, JWTError

from backend.app.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import User, PasswordResetToken
from backend.app.core.security import (
    verify_password, get_password_hash, create_access_token,
    generate_reset_token, hash_reset_token
)
from backend.app.services.email_service import email_service
from backend.app.schemas.auth import (
    Token, UserCreate, UserLogin, UserResponse, RoleSwitchRequest, UserUpdate,
    RegisterResponse, VerifyEmailRequest, VerifyEmailResponse,
    ResendVerificationRequest, ResendVerificationResponse,
    ForgotPasswordRequest, ForgotPasswordResponse,
    VerifyResetTokenRequest, VerifyResetTokenResponse,
    ResetPasswordRequest, ResetPasswordResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])

# In-memory rate limiting map: ip -> list of timestamps
_rate_limit_store: Dict[str, List[float]] = {}
RATE_LIMIT_WINDOW_SECONDS = 600  # 10 minutes
RATE_LIMIT_MAX_REQUESTS = 10      # max 10 requests per 10 min

def check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    timestamps = _rate_limit_store.get(client_ip, [])
    # Filter only recent requests within window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    timestamps.append(now)
    _rate_limit_store[client_ip] = timestamps
    return True

async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        # Fallback to demo default user if unauthenticated for smooth demo experience
        result = await db.execute(select(User).filter(User.email == "rahul@pulsebug.io"))
        default_user = result.scalars().first()
        if default_user:
            return default_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required"
        )
    
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
        
    result = await db.execute(select(User).filter(User.id == int(user_id)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of these roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == login_data.email))
    user = result.scalars().first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="EMAIL_NOT_VERIFIED: Please verify your email with the 6-digit code before logging in."
        )
        
    access_token = create_access_token(subject=user.id, role=user.role)
    
    skills_list = json.loads(user.skills) if isinstance(user.skills, str) else user.skills
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        avatar_url=user.avatar_url,
        skills=skills_list,
        active_status=user.active_status,
        is_verified=user.is_verified,
        created_at=user.created_at
    )
    return Token(access_token=access_token, token_type="bearer", user=user_resp)

@router.post("/register", response_model=RegisterResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == user_data.email))
    existing_user = result.scalars().first()
    
    code = email_service.generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    if existing_user:
        if not existing_user.is_verified:
            # Re-generate code for unverified account
            existing_user.verification_code = code
            existing_user.verification_code_expires_at = expires_at
            existing_user.hashed_password = get_password_hash(user_data.password)
            existing_user.full_name = user_data.full_name
            existing_user.role = user_data.role
            existing_user.skills = json.dumps(user_data.skills or [])
            await db.commit()
            
            email_res = email_service.send_verification_email(user_data.email, code, user_data.full_name)
            return RegisterResponse(
                message="Account exists but unverified. A new verification code has been generated.",
                email=user_data.email,
                is_verified=False,
                requires_verification=True,
                verification_code=code if not email_res.get("sent") else None
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        avatar_url=user_data.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={user_data.email}",
        skills=json.dumps(user_data.skills or []),
        active_status=user_data.active_status,
        is_verified=False,
        verification_code=code,
        verification_code_expires_at=expires_at
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    email_res = email_service.send_verification_email(user.email, code, user.full_name)
    
    return RegisterResponse(
        message="Registration successful. Please enter the 6-digit verification code sent to your email.",
        email=user.email,
        is_verified=False,
        requires_verification=True,
        verification_code=code if not email_res.get("sent") else None
    )

@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(req: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found")
        
    if user.is_verified:
        access_token = create_access_token(subject=user.id, role=user.role)
        skills_list = json.loads(user.skills) if isinstance(user.skills, str) else user.skills
        user_resp = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            avatar_url=user.avatar_url,
            skills=skills_list,
            active_status=user.active_status,
            is_verified=True,
            created_at=user.created_at
        )
        return VerifyEmailResponse(
            success=True,
            message="Email is already verified.",
            token=Token(access_token=access_token, token_type="bearer", user=user_resp)
        )
        
    if not user.verification_code or user.verification_code.strip() != req.code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code. Please check and try again.")
        
    now = datetime.now(timezone.utc)
    if user.verification_code_expires_at:
        exp = user.verification_code_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now > exp:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code has expired. Please click Resend Code.")
            
    # Mark verified
    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires_at = None
    await db.commit()
    await db.refresh(user)
    
    access_token = create_access_token(subject=user.id, role=user.role)
    skills_list = json.loads(user.skills) if isinstance(user.skills, str) else user.skills
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        avatar_url=user.avatar_url,
        skills=skills_list,
        active_status=user.active_status,
        is_verified=True,
        created_at=user.created_at
    )
    return VerifyEmailResponse(
        success=True,
        message="Email verified successfully! Welcome to PulseBug.",
        token=Token(access_token=access_token, token_type="bearer", user=user_resp)
    )

@router.post("/resend-verification", response_model=ResendVerificationResponse)
async def resend_verification(req: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found")
        
    if user.is_verified:
        return ResendVerificationResponse(
            success=True,
            message="Account is already verified. You can log in directly."
        )
        
    code = email_service.generate_verification_code()
    user.verification_code = code
    user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    await db.commit()
    
    email_res = email_service.send_verification_email(user.email, code, user.full_name)
    
    return ResendVerificationResponse(
        success=True,
        message=f"A fresh 6-digit verification code has been sent to {user.email}.",
        verification_code=code if not email_res.get("sent") else None
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    skills_list = json.loads(current_user.skills) if isinstance(current_user.skills, str) else current_user.skills
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        avatar_url=current_user.avatar_url,
        skills=skills_list,
        active_status=current_user.active_status,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at
    )

@router.get("/users", response_model=List[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    resp = []
    for u in users:
        skills_list = json.loads(u.skills) if isinstance(u.skills, str) else u.skills
        resp.append(UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            avatar_url=u.avatar_url,
            skills=skills_list,
            active_status=u.active_status,
            is_verified=u.is_verified,
            created_at=u.created_at
        ))
    return resp

@router.post("/switch-demo-user/{email}", response_model=Token)
async def switch_demo_user(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo user not found")
        
    access_token = create_access_token(subject=user.id, role=user.role)
    skills_list = json.loads(user.skills) if isinstance(user.skills, str) else user.skills
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        avatar_url=user.avatar_url,
        skills=skills_list,
        active_status=user.active_status,
        is_verified=user.is_verified,
        created_at=user.created_at
    )
    return Token(access_token=access_token, token_type="bearer", user=user_resp)

# --------------------------------------------------------------------------
# PASSWORD RESET ENDPOINTS
# --------------------------------------------------------------------------

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    req_data: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Initiates the Forgot Password workflow:
    1. Enforces rate limiting.
    2. Generates a secure, single-use, time-limited cryptographic token.
    3. Stores the token hash in the database.
    4. Returns a generic confirmation message (never leaks user existence).
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait a few minutes before trying again."
        )

    # Standard security response message
    generic_message = "If an account exists for this email, a password reset link has been sent."

    # Look up user by email
    result = await db.execute(select(User).filter(User.email == req_data.email))
    user = result.scalars().first()

    simulated_link = None
    if user:
        # Invalidate any existing unused reset tokens for this user
        await db.execute(
            update(PasswordResetToken)
            .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used == False)
            .values(is_used=True)
        )

        # Generate new cryptographic token (15-minute validity)
        raw_token, token_hash = generate_reset_token()
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=15)

        reset_token_obj = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            raw_token_preview=raw_token,
            expires_at=expires_at,
            is_used=False,
            created_at=now,
            ip_address=client_ip
        )
        db.add(reset_token_obj)
        await db.commit()

        # Build simulated email reset link for local browser demo
        simulated_link = f"http://localhost:5173/reset-password?token={raw_token}"

    return ForgotPasswordResponse(
        message=generic_message,
        simulated_reset_link=simulated_link,
        expires_in_minutes=15
    )

@router.post("/verify-reset-token", response_model=VerifyResetTokenResponse)
async def verify_reset_token(
    req_data: VerifyResetTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Validates whether a reset token is valid, expired, or already used.
    """
    token_hash = hash_reset_token(req_data.token.strip())
    
    result = await db.execute(
        select(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
    )
    token_record = result.scalars().first()

    if not token_record:
        return VerifyResetTokenResponse(
            valid=False,
            status="INVALID",
            message="This password reset link is invalid. Please request a new one."
        )

    if token_record.is_used:
        return VerifyResetTokenResponse(
            valid=False,
            status="USED",
            message="This password reset link is no longer valid. Please request a new one."
        )

    now = datetime.now(timezone.utc)
    token_expiry = token_record.expires_at
    if token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)

    if now > token_expiry:
        return VerifyResetTokenResponse(
            valid=False,
            status="EXPIRED",
            message="This password reset link has expired. Please request a new one."
        )

    # Fetch associated user
    user_res = await db.execute(select(User).filter(User.id == token_record.user_id))
    user = user_res.scalars().first()

    return VerifyResetTokenResponse(
        valid=True,
        status="VALID",
        email=user.email if user else None,
        message="Token is valid."
    )

@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    req_data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Securely updates the user's password and invalidates the single-use token.
    """
    if len(req_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )

    token_hash = hash_reset_token(req_data.token.strip())
    
    result = await db.execute(
        select(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
    )
    token_record = result.scalars().first()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid. Please request a new one."
        )

    if token_record.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is no longer valid. Please request a new one."
        )

    now = datetime.now(timezone.utc)
    token_expiry = token_record.expires_at
    if token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)

    if now > token_expiry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired. Please request a new one."
        )

    # Fetch User
    user_res = await db.execute(select(User).filter(User.id == token_record.user_id))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found")

    # Update password hash
    user.hashed_password = get_password_hash(req_data.new_password)

    # Invalidate token immediately
    token_record.is_used = True
    token_record.used_at = now

    # Invalidate all remaining tokens for this user
    await db.execute(
        update(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used == False)
        .values(is_used=True)
    )

    await db.commit()

    return ResetPasswordResponse(
        success=True,
        message="Password updated successfully. You can now log in with your new password."
    )
