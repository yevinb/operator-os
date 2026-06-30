from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    name: str
    company: str
    password: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str = ""


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    company: str
    plan: str = "starter"
    onboarded: bool = False


@router.post("/signup", response_model=UserOut)
async def signup(req: SignupRequest):
    return UserOut(
        id=f"user_{int(datetime.utcnow().timestamp())}",
        email=req.email,
        name=req.name,
        company=req.company,
        plan="starter",
        onboarded=False,
    )


@router.post("/login", response_model=UserOut)
async def login(req: LoginRequest):
    return UserOut(
        id=f"user_{int(datetime.utcnow().timestamp())}",
        email=req.email,
        name=req.email.split("@")[0].title(),
        company="My Company",
        plan="business",
        onboarded=True,
    )
