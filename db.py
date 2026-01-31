from __future__ import annotations

import enum
import os
import uuid

from dotenv import load_dotenv
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, create_engine, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

load_dotenv()


class Base(DeclarativeBase):
    pass


class UserRole(enum.Enum):
    TENANT = "tenant"
    LANDLORD = "landlord"


class IssueCategory(enum.Enum):
    HEATING = "heating"
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    OTHER = "other"


class IssueStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class VendorSpecialty(enum.Enum):
    HEATING = "heating"
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    GENERAL = "general"


class ChatRole(enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True
    )

    property: Mapped["Property | None"] = relationship(
        back_populates="tenants", foreign_keys=lambda: [User.property_id]
    )
    issues: Mapped[list["Issue"]] = relationship(back_populates="tenant")


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    address: Mapped[str] = mapped_column(String, nullable=False)
    landlord_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    landlord: Mapped["User"] = relationship(foreign_keys=[landlord_id])
    tenants: Mapped[list["User"]] = relationship(
        back_populates="property",
        foreign_keys=lambda: [User.property_id],
        primaryjoin=lambda: Property.id == User.property_id,
    )
    issues: Mapped[list["Issue"]] = relationship(back_populates="property")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="property")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    specialty: Mapped[VendorSpecialty] = mapped_column(
        Enum(VendorSpecialty, name="vendor_specialty"), nullable=False
    )
    hourly_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)

    issues: Mapped[list["Issue"]] = relationship(back_populates="vendor")


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False
    )
    category: Mapped[IssueCategory] = mapped_column(
        Enum(IssueCategory, name="issue_category"), nullable=False
    )
    summary: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[IssueStatus] = mapped_column(
        Enum(IssueStatus, name="issue_status"), nullable=False
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True
    )
    estimated_cost: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tenant: Mapped["User"] = relationship(back_populates="issues")
    property: Mapped["Property"] = relationship(back_populates="issues")
    vendor: Mapped["Vendor | None"] = relationship(back_populates="issues")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="issue")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    issue_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("issues.id"), nullable=True
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    role: Mapped[ChatRole] = mapped_column(
        Enum(ChatRole, name="chat_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    issue: Mapped["Issue | None"] = relationship(back_populates="messages")
    tenant: Mapped["User"] = relationship(foreign_keys=[tenant_id])
    property: Mapped["Property | None"] = relationship(back_populates="messages")


def get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    return create_engine(database_url, pool_pre_ping=True)


def get_sessionmaker():
    engine = get_engine()
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def create_tables():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def seed_dummy_data():
    session = get_sessionmaker()()
    try:
        if session.query(User).first() is not None:
            return

        landlord = User(
            email="landlord@proco.dev",
            role=UserRole.LANDLORD,
            name="Leslie Landlord",
        )
        property_ = Property(address="123 Maple St, Austin, TX", landlord=landlord)
        tenant_1 = User(
            email="tenant1@proco.dev",
            role=UserRole.TENANT,
            name="Tara Tenant",
            property=property_,
        )
        tenant_2 = User(
            email="tenant2@proco.dev",
            role=UserRole.TENANT,
            name="Ben Tenant",
            property=property_,
        )

        vendors = [
            Vendor(
                name="ABC HVAC",
                specialty=VendorSpecialty.HEATING,
                hourly_rate=125.00,
                rating=4.7,
            ),
            Vendor(
                name="FlowFix Plumbing",
                specialty=VendorSpecialty.PLUMBING,
                hourly_rate=110.00,
                rating=4.5,
            ),
            Vendor(
                name="BrightSpark Electric",
                specialty=VendorSpecialty.ELECTRICAL,
                hourly_rate=135.00,
                rating=4.8,
            ),
            Vendor(
                name="Handy General Co",
                specialty=VendorSpecialty.GENERAL,
                hourly_rate=95.00,
                rating=4.2,
            ),
        ]

        issue = Issue(
            tenant=tenant_1,
            property=property_,
            category=IssueCategory.HEATING,
            summary="Heater not producing warm air",
            description="Tenant reports no warm air since yesterday morning.",
            status=IssueStatus.PENDING,
            vendor=vendors[0],
            estimated_cost=150.00,
        )

        messages = [
            ChatMessage(
                issue=issue,
                property=property_,
                tenant=tenant_1,
                role=ChatRole.USER,
                content="My heater isn't working.",
            ),
            ChatMessage(
                issue=issue,
                property=property_,
                tenant=tenant_1,
                role=ChatRole.ASSISTANT,
                content="When did this start and is there any airflow?",
            ),
            ChatMessage(
                issue=issue,
                property=property_,
                tenant=tenant_1,
                role=ChatRole.USER,
                content="Yesterday morning. No air at all.",
            ),
        ]

        session.add_all(
            [
                landlord,
                property_,
                tenant_1,
                tenant_2,
                *vendors,
                issue,
                *messages,
            ]
        )
        session.commit()
    finally:
        session.close()
