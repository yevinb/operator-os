from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(255), default="My Company")
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    plan: Mapped[str] = mapped_column(String(32), default="starter")
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped["BusinessProfile | None"] = relationship(back_populates="user", uselist=False)
    integrations: Mapped[list["IntegrationConnection"]] = relationship(back_populates="user")
    command_logs: Mapped[list["CommandLog"]] = relationship(back_populates="user")


class BusinessProfile(Base):
    __tablename__ = "business_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), unique=True)
    industry: Mapped[str] = mapped_column(String(255), default="")
    goal: Mapped[str] = mapped_column(String(255), default="")
    market: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    website: Mapped[str] = mapped_column(String(512), default="")

    user: Mapped["User"] = relationship(back_populates="profile")


class IntegrationConnection(Base):
    __tablename__ = "integration_connections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    integration_id: Mapped[str] = mapped_column(String(64))
    connected: Mapped[bool] = mapped_column(Boolean, default=False)
    api_key: Mapped[str] = mapped_column(Text, default="")
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="integrations")


class CommandLog(Base):
    __tablename__ = "command_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    command: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(Text)
    tasks_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="command_logs")
