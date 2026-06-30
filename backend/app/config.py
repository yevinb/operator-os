import os

from pydantic import field_validator
from pydantic_settings import BaseSettings


def _default_database_url() -> str:
    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("PORT"):
        return "sqlite+aiosqlite:////tmp/operatoros.db"
    return "sqlite+aiosqlite:///./operatoros.db"


class Settings(BaseSettings):
    app_name: str = "OperatorOS"
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
    ai_provider: str = "auto"  # auto | openai | anthropic | gemini | rules

    # Database — SQLite local; /tmp on Railway; Postgres via DATABASE_URL
    database_url: str = _default_database_url()
    redis_url: str = "redis://localhost:6379/0"

    # Optional automation webhooks
    n8n_webhook_url: str = ""

    # Google OAuth (Gmail, Calendar, Google Ads)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://operator-os-production-2a8a.up.railway.app/api/v1/oauth/google/callback"
    frontend_url: str = "https://yevinb.github.io/operator-os"

    class Config:
        env_file = ".env"


settings = Settings()
