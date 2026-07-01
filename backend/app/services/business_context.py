from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db_models import BusinessProfile, IntegrationConnection, User


@dataclass
class BusinessContext:
    company: str = ""
    industry: str = ""
    goal: str = ""
    market: str = ""
    description: str = ""
    website: str = ""
    connected_integrations: list[str] = field(default_factory=list)
    live_metrics: dict[str, str | float | int] = field(default_factory=dict)
    integration_snapshots: dict = field(default_factory=dict)
    business_narrative: str = ""
    niche_mode: str = "general"

    def to_prompt_block(self) -> str:
        lines = [
            f"Company: {self.company or 'Unknown'}",
            f"Industry: {self.industry or 'Not specified'}",
            f"Niche mode: {self.niche_mode or 'general'}",
            f"Primary goal: {self.goal or 'Not specified'}",
            f"Market: {self.market or 'Not specified'}",
        ]
        if self.description:
            lines.append(f"About: {self.description}")
        if self.website:
            lines.append(f"Website: {self.website}")
        if self.connected_integrations:
            lines.append(f"Connected tools: {', '.join(self.connected_integrations)}")
        if self.business_narrative:
            lines.append(f"Business pulse: {self.business_narrative}")
        if self.live_metrics:
            metrics = ", ".join(f"{k}={v}" for k, v in self.live_metrics.items())
            lines.append(f"Live business data: {metrics}")
        return "\n".join(lines)


async def build_business_context(user: User, db: AsyncSession) -> BusinessContext:
    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.profile), selectinload(User.integrations))
    )
    full_user = result.scalar_one()
    profile = full_user.profile

    connected = [
        i.integration_id
        for i in full_user.integrations
        if i.connected
    ]

    ctx = BusinessContext(
        company=full_user.company,
        industry=profile.industry if profile else "",
        goal=profile.goal if profile else "",
        market=profile.market if profile else "",
        description=profile.description if profile else "",
        website=profile.website if profile else "",
        connected_integrations=connected,
        niche_mode=profile.niche_mode if profile else "general",
    )

    if connected:
        from app.services.business_snapshot import build_business_snapshot
        from app.services.integrations.providers import parse_config

        integration_data = {
            i.integration_id: {
                "api_key": i.api_key or "",
                "config": parse_config(i.config_json),
            }
            for i in full_user.integrations
            if i.connected
        }
        snap = await build_business_snapshot(
            ctx.company,
            connected,
            integration_data,
            cache_key=full_user.id,
        )
        ctx.live_metrics.update(snap.metrics)
        ctx.integration_snapshots = snap.sources
        ctx.business_narrative = snap.narrative

    return ctx


async def ensure_profile(db: AsyncSession, user_id: str) -> BusinessProfile:
    result = await db.execute(select(BusinessProfile).where(BusinessProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile:
        return profile
    profile = BusinessProfile(user_id=user_id)
    db.add(profile)
    await db.flush()
    return profile
