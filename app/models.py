from __future__ import annotations

from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from db import ChatRole, IssueCategory, IssueStatus, UserRole, VendorSpecialty


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    name: str
    property_id: uuid.UUID | None


class VendorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    specialty: VendorSpecialty
    hourly_rate: float
    rating: float | None


class IssueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    property_id: uuid.UUID
    category: IssueCategory
    summary: str
    description: str
    status: IssueStatus
    vendor_id: uuid.UUID | None
    estimated_cost: float | None
    created_at: datetime


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    issue_id: uuid.UUID | None
    tenant_id: uuid.UUID
    role: ChatRole
    content: str
    created_at: datetime
