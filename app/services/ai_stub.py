from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.orm import Session

from db import IssueCategory, Vendor, VendorSpecialty


KEYWORD_MAP: dict[IssueCategory, Sequence[str]] = {
    IssueCategory.HEATING: ("heater", "heat", "furnace", "thermostat", "ac"),
    IssueCategory.PLUMBING: ("leak", "pipe", "sink", "toilet", "faucet", "drain"),
    IssueCategory.ELECTRICAL: ("outlet", "breaker", "electric", "power", "light"),
}


def classify_issue(message: str) -> IssueCategory:
    normalized = message.lower()
    for category, keywords in KEYWORD_MAP.items():
        if any(keyword in normalized for keyword in keywords):
            return category
    return IssueCategory.OTHER


def pick_vendor(db: Session, category: IssueCategory) -> Vendor | None:
    specialty_map = {
        IssueCategory.HEATING: VendorSpecialty.HEATING,
        IssueCategory.PLUMBING: VendorSpecialty.PLUMBING,
        IssueCategory.ELECTRICAL: VendorSpecialty.ELECTRICAL,
        IssueCategory.OTHER: VendorSpecialty.GENERAL,
    }
    preferred = specialty_map.get(category, VendorSpecialty.GENERAL)
    vendor = (
        db.query(Vendor)
        .filter(Vendor.specialty == preferred)
        .order_by(Vendor.rating.desc().nullslast())
        .first()
    )
    if vendor is None:
        vendor = db.query(Vendor).order_by(Vendor.rating.desc().nullslast()).first()
    return vendor


def estimate_cost(hourly_rate: float, category: IssueCategory) -> float:
    hours = {
        IssueCategory.HEATING: 2.0,
        IssueCategory.PLUMBING: 1.5,
        IssueCategory.ELECTRICAL: 2.5,
        IssueCategory.OTHER: 1.0,
    }.get(category, 1.0)
    return round(hourly_rate * hours, 2)


def build_summary(message: str, category: IssueCategory) -> str:
    truncated = (message[:80] + "...") if len(message) > 80 else message
    return f"{category.value.title()} issue: {truncated}"
