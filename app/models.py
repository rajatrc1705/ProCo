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
    email: str | None
    specialty: VendorSpecialty
    hourly_rate: float
    rating: float | None


class PropertyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    address: str
    landlord_id: uuid.UUID
    latitude: float | None
    longitude: float | None


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
    appointment_at: datetime | None
    created_at: datetime


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    issue_id: uuid.UUID | None
    property_id: uuid.UUID | None
    tenant_id: uuid.UUID
    role: ChatRole
    content: str
    image_base64: str | None
    created_at: datetime


class ChatMessageCreate(BaseModel):
    tenant_id: uuid.UUID
    content: str


class ChatRequest(BaseModel):
    tenant_id: uuid.UUID
    message: str
    image_base64: str | None = None
    issue_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None


class ChatResponse(BaseModel):
    response: str
    issue_created: bool
    issue_id: uuid.UUID | None = None


class IssueActionResponse(BaseModel):
    id: uuid.UUID
    status: IssueStatus


class VendorResponseRequest(BaseModel):
    accepted: bool
    appointment_at: datetime | None = None
    notes: str | None = None


class WalletSummary(BaseModel):
    property_id: uuid.UUID
    balance: float
    used: float
    remaining: float


class WalletTopupRequest(BaseModel):
    property_id: uuid.UUID
    amount: float
    note: str | None = None


class WalletBalanceUpdate(BaseModel):
    property_id: uuid.UUID
    balance: float
