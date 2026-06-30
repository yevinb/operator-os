from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "OperatorOS"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # AI providers (optional — falls back to rule-based engine)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    ai_provider: str = "auto"  # auto | openai | anthropic | gemini | rules

    # Database (optional for Phase 1)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/operatoros"
    redis_url: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"


settings = Settings()
