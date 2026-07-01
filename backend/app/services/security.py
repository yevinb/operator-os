from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if not stored or "$" not in stored:
        return not password
    salt, digest = stored.split("$", 1)
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return secrets.compare_digest(check.hex(), digest)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return str(sub) if sub else None
    except JWTError:
        return None


def create_oauth_state(user_id: str, integration_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {"sub": user_id, "integration_id": integration_id, "type": "google_oauth", "exp": expire},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )


def decode_oauth_state(state: str) -> tuple[str, str] | None:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "google_oauth":
            return None
        user_id = payload.get("sub")
        integration_id = payload.get("integration_id")
        if not user_id or not integration_id:
            return None
        return str(user_id), str(integration_id)
    except JWTError:
        return None


def create_google_login_state() -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {"type": "google_login", "exp": expire},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )


def verify_google_login_state(state: str) -> bool:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload.get("type") == "google_login"
    except JWTError:
        return False
