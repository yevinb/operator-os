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


def create_access_token(
    user_id: str,
    *,
    email: str | None = None,
    remember: bool = True,
) -> str:
    days = settings.jwt_expire_days if remember else settings.jwt_session_days
    expire = datetime.now(timezone.utc) + timedelta(days=days)
    payload: dict = {"sub": user_id, "exp": expire}
    if email:
        payload["email"] = email.lower().strip()
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token_payload(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None


def decode_token(token: str) -> str | None:
    payload = decode_token_payload(token)
    if not payload:
        return None
    sub = payload.get("sub")
    return str(sub) if sub else None


def decode_token_email(token: str) -> str | None:
    payload = decode_token_payload(token)
    if not payload:
        return None
    email = payload.get("email")
    return str(email).lower().strip() if email else None


def create_oauth_state(user_id: str, integration_id: str, oauth_type: str = "google_oauth") -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {"sub": user_id, "integration_id": integration_id, "type": oauth_type, "exp": expire},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )


def decode_oauth_state(state: str, expected_type: str | None = None) -> tuple[str, str] | None:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[ALGORITHM])
        oauth_type = payload.get("type")
        if expected_type and oauth_type != expected_type:
            return None
        if oauth_type not in ("google_oauth", "shopify_oauth", "quickbooks_oauth"):
            return None
        user_id = payload.get("sub")
        integration_id = payload.get("integration_id")
        if not user_id or not integration_id:
            return None
        return str(user_id), str(integration_id)
    except JWTError:
        return None


def create_google_login_state(*, remember: bool = True) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {"type": "google_login", "remember": remember, "exp": expire},
        settings.jwt_secret,
        algorithm=ALGORITHM,
    )


def parse_google_login_state(state: str) -> tuple[bool, bool]:
    """Return (valid, remember_me)."""
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "google_login":
            return False, True
        remember = payload.get("remember")
        return True, True if remember is None else bool(remember)
    except JWTError:
        return False, True


def verify_google_login_state(state: str) -> bool:
    valid, _ = parse_google_login_state(state)
    return valid
