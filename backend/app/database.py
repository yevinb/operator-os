from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from app import db_models  # noqa: F401

    if "sqlite" in settings.database_url:
        db_path = settings.database_url.split("///")[-1]
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    migrations = [
        "ALTER TABLE business_profiles ADD COLUMN niche_mode VARCHAR(64) DEFAULT 'general'",
        "ALTER TABLE users ADD COLUMN google_id VARCHAR(128)",
    ]
    if "sqlite" in settings.database_url:
        for sql in migrations:
            try:
                async with engine.begin() as conn:
                    await conn.exec_driver_sql(sql)
            except Exception:
                pass
    elif "postgresql" in settings.database_url:
        try:
            async with engine.begin() as conn:
                await conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(128)"
                )
                await conn.exec_driver_sql(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id) "
                    "WHERE google_id IS NOT NULL"
                )
        except Exception:
            pass
