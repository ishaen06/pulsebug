import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union, Tuple
from jose import jwt
from backend.app.config import settings

def create_access_token(subject: Union[str, Any], role: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_password_hash(password: str) -> str:
    salt = "pulsebug_salt_2026_"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    expected_hash = get_password_hash(plain_password)
    return expected_hash == hashed_password

def generate_reset_token() -> Tuple[str, str]:
    """
    Generates a cryptographically random, secure reset token.
    Returns: (raw_token, token_hash)
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(raw_token)
    return raw_token, token_hash

def hash_reset_token(raw_token: str) -> str:
    """
    Hashes the reset token using SHA-256 for secure database storage.
    """
    token_salt = "pulsebug_reset_token_salt_2026_"
    return hashlib.sha256((token_salt + raw_token).encode("utf-8")).hexdigest()
