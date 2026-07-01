import os
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings


def _normalize_postgres_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+" not in url.split("://", 1)[1].split("@")[0]:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _default_database_url() -> str:
    # Railway Postgres plugin (persistent — preferred)
    env_url = (os.getenv("DATABASE_URL") or os.getenv("DATABASE_PRIVATE_URL") or "").strip()
    if env_url:
        return _normalize_postgres_url(env_url)

    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("PORT"):
        # /app/data survives redeploys better than /tmp (ephemeral)
        data_dir = os.getenv("NEXA_DATA_DIR", "/app/data")
        Path(data_dir).mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{data_dir}/operatoros.db"

    Path("./data").mkdir(parents=True, exist_ok=True)
    return "sqlite+aiosqlite:///./data/operatoros.db"


class Settings(BaseSettings):
    app_name: str = "Nexa"
    debug: bool = False
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://yevinb.github.io",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [x.strip() for x in v.split(",") if x.strip()]
        return v

    # Auth
    jwt_secret: str = "change-me-in-production-operatoros-secret"
    jwt_expire_days: int = 30

    # AI providers (optional — falls back to rule-based engine)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    ai_provider: str = "auto"  # auto | groq | openai | anthropic | gemini | rules

    # Database — Postgres via DATABASE_URL on Railway; else persistent SQLite in /app/data
    database_url: str = ""

    @field_validator("database_url", mode="before")
    @classmethod
    def resolve_database_url(cls, v):
        if v and str(v).strip():
            return _normalize_postgres_url(str(v).strip())
        return _default_database_url()
    redis_url: str = "redis://localhost:6379/0"

    # Optional automation webhooks
    n8n_webhook_url: str = ""

    # Google OAuth (Gmail, Calendar, Google Ads)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://operator-os-production-2a8a.up.railway.app/api/v1/oauth/google/callback"
    frontend_url: str = "https://yevinb.github.io/operator-os"

    @property
    def google_oauth_redirect_uri(self) -> str:
        """Integration OAuth callback — distinct from /auth/google/callback used for login."""
        uri = (self.google_redirect_uri or "").strip()
        return uri.replace("/api/v1/auth/google/callback", "/api/v1/oauth/google/callback")

    @property
    def google_auth_redirect_uri(self) -> str:
        """Account login/signup OAuth callback."""
        uri = (self.google_redirect_uri or "").strip()
        return uri.replace("/api/v1/oauth/google/callback", "/api/v1/auth/google/callback")

    class Config:
        env_file = ".env"


settings = Settings()
