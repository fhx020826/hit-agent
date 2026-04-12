from __future__ import annotations

from pydantic import BaseModel

from .common import RoleType, UserProfileBase, UserSummary


class AuthRegisterRequest(BaseModel):
    role: RoleType
    account: str
    password: str
    confirm_password: str
    profile: UserProfileBase


class AuthLoginRequest(BaseModel):
    role: RoleType
    account: str
    password: str


class AuthLoginResponse(BaseModel):
    token: str
    user: UserSummary
