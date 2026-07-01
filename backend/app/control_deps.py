"""Resolve user for Cursor/agent control API (control key or JWT)."""

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.db_models import User
from app.services.security import decode_token

security = HTTPBearer(auto_error=False)


async def get_control_user(
    x_nexa_control_key: str | None = Header(None, alias="X-Nexa-Control-Key"),
    x_nexa_user_email: str | None = Header(None, alias="X-Nexa-User-Email"),
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """JWT bearer OR X-Nexa-Control-Key for Cursor/MCP/agents."""
    if (
        x_nexa_control_key
        and settings.nexa_control_key
        and x_nexa_control_key == settings.nexa_control_key
    ):
        email = (x_nexa_user_email or settings.nexa_control_email or "").lower().strip()
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Set NEXA_CONTROL_EMAIL on server or pass X-Nexa-User-Email header",
            )
        result = await db.execute(
            select(User)
            .where(User.email == email)
            .options(selectinload(User.profile), selectinload(User.integrations))
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail=f"No Nexa user for email {email}")
        return user

    if creds and creds.credentials:
        user_id = decode_token(creds.credentials)
        if user_id:
            result = await db.execute(
                select(User)
                .where(User.id == user_id)
                .options(selectinload(User.profile), selectinload(User.integrations))
            )
            user = result.scalar_one_or_none()
            if user:
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Use Bearer JWT or X-Nexa-Control-Key header",
    )
