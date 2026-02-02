from __future__ import annotations

import json
import uuid

from json import JSONDecodeError

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.services.ai_tools import build_summary, classify_issue, estimate_cost, pick_vendor
from db import ChatMessage, ChatRole, Issue, IssueCategory, IssueStatus, Vendor, VendorSpecialty

SYSTEM_PROMPT = """You are ProCo, an AI assistant helping tenants report property maintenance issues.

Your workflow:
1. Gather the problem, when it started, severity, and relevant details. 
2. Keep asking questions until you have ALL the details (when it started, severity and relevant details/description of the issue).
2. Classify the issue by category.
3. Find a vendor match from the list of vendors that are available for the issue category.
4. Estimate cost.
5. Summarize for the tenant and ask the tenants if they want to escalate the issue to the landlord.
6. If the tenant confirms, notify that you are escalating, and thank the tenant for raising the issue.
    6, a. the vendor shouldnt be revealed to the tenant at this stage
    6, b. give the tenant an idea of the cost of repairing the issue
    6, c. give the tenant an option to escalate the issue to the landlord
Be conversational and empathetic. Keep replies concise"""


def run_agent(
    db: Session,
    tenant_id: uuid.UUID,
    property_id: uuid.UUID,
    message: str,
    image_description: str | None = None,
    issue_id: uuid.UUID | None = None,
) -> tuple[str, uuid.UUID | None]:
    history: list[ChatMessage] = []
    if issue_id is not None:
        history = (
            db.query(ChatMessage)
            .filter(ChatMessage.issue_id == issue_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )

    message_with_image = message
    if image_description:
        message_with_image = f"{message}\n\nImage description: {image_description}"

    category = classify_issue(message_with_image)

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    def pick_vendor_with_llm() -> Vendor | None:
        specialty_map = {
            IssueCategory.HEATING: VendorSpecialty.HEATING,
            IssueCategory.PLUMBING: VendorSpecialty.PLUMBING,
            IssueCategory.ELECTRICAL: VendorSpecialty.ELECTRICAL,
            IssueCategory.OTHER: VendorSpecialty.GENERAL,
        }
        preferred = specialty_map.get(category, VendorSpecialty.GENERAL)
        candidates = (
            db.query(Vendor)
            .filter(Vendor.specialty == preferred)
            .order_by(Vendor.rating.desc().nullslast())
            .all()
        )
        if not candidates:
            candidates = db.query(Vendor).order_by(Vendor.rating.desc().nullslast()).all()
        if not candidates:
            return None

        vendor_list = [
            {
                "id": str(vendor.id),
                "name": vendor.name,
                "hourly_rate": float(vendor.hourly_rate),
                "rating": float(vendor.rating) if vendor.rating is not None else None,
            }
            for vendor in candidates
        ]
        prompt = (
            "Pick ONE vendor id from the list. Balance highest rating with reasonable cost; "
            "prefer a slightly lower price if the rating difference is small. "
            "Respond ONLY as JSON: {\"vendor_id\": \"...\"}."
        )
        try:
            choice = llm.invoke([SystemMessage(content=prompt), HumanMessage(content=json.dumps(vendor_list))])
            raw_choice = getattr(choice, "content", "") or str(choice)
            parsed_choice = json.loads(raw_choice)
            chosen_id = str(parsed_choice.get("vendor_id", "")).strip()
            for vendor in candidates:
                if str(vendor.id) == chosen_id:
                    return vendor
        except Exception:
            pass

        return sorted(
            candidates,
            key=lambda vendor: (
                -(vendor.rating or 0),
                float(vendor.hourly_rate),
            ),
        )[0]

    vendor = pick_vendor_with_llm()
    estimated = estimate_cost(float(vendor.hourly_rate), category) if vendor else None
    cost_text = f"${estimated:.2f}" if estimated is not None else "TBD"
    context_prompt = (
        "Decide if you have enough info to escalate. Required: "
        "when it started, what exactly is happening, and severity. "
        "Also require explicit tenant permission to escalate. "
        "Ask one concise follow-up question if anything is missing. "
        "Do not reveal vendor identity. "
        "Respond ONLY as JSON with keys: response (string), ready_to_create (boolean). "
        f"\nCategory: {category.value}\nEstimated cost: {cost_text}"
    )

    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for chat in history:
        if chat.role == ChatRole.USER:
            messages.append(HumanMessage(content=chat.content))
        elif chat.role == ChatRole.ASSISTANT:
            messages.append(AIMessage(content=chat.content))
        else:
            messages.append(AIMessage(content=chat.content))
    messages.append(SystemMessage(content=context_prompt))
    if not history or history[-1].role != ChatRole.USER or history[-1].content != message:
        messages.append(HumanMessage(content=message_with_image))

    response = llm.invoke(messages)
    raw_text = getattr(response, "content", "") or str(response)
    try:
        parsed = json.loads(raw_text)
        response_text = str(parsed.get("response", "")).strip()
        ready_to_create = bool(parsed.get("ready_to_create", False))
    except JSONDecodeError:
        response_text = raw_text.strip()
        ready_to_create = False

    def has_explicit_permission(text: str) -> bool:
        normalized = text.strip().lower()
        confirmations = {
            "yes",
            "yes please",
            "yep",
            "yeah",
            "sure",
            "ok",
            "okay",
            "please do",
            "go ahead",
            "escalate",
            "submit",
            "send it",
            "please escalate",
            "yes escalate",
            "confirm",
        }
        if normalized in confirmations:
            return True
        return any(
            phrase in normalized
            for phrase in (
                "please escalate",
                "go ahead and escalate",
                "yes, escalate",
                "yes, please",
                "please submit",
                "go ahead",
                "you can escalate",
                "submit it",
            )
        )

    if ready_to_create and not has_explicit_permission(message):
        ready_to_create = False

    def build_llm_summary() -> str:
        vendor_name = vendor.name if vendor else "Unassigned"
        cost_text = f"${estimated:.2f}" if estimated is not None else "TBD"
        summary_prompt = (
            "Create a concise landlord-ready summary in 3-5 sentences. "
            "Include: what the issue is, when it started, what the tenant reports, "
            "severity, estimated cost, and suggested vendor. "
            "If any detail is unknown, say it's unknown. "
            f"\nCategory: {category.value}"
            f"\nEstimated cost: {cost_text}"
            f"\nSuggested vendor: {vendor_name}"
        )
        summary_messages = [SystemMessage(content=summary_prompt)]
        issue_history = history
        for chat in issue_history:
            if chat.role == ChatRole.USER:
                summary_messages.append(HumanMessage(content=chat.content))
            elif chat.role == ChatRole.ASSISTANT:
                summary_messages.append(AIMessage(content=chat.content))
            else:
                summary_messages.append(AIMessage(content=chat.content))
        summary_messages.append(HumanMessage(content=message_with_image))
        summary_response = llm.invoke(summary_messages)
        summary_text = getattr(summary_response, "content", "") or str(summary_response)
        return summary_text.strip()

    summary = build_summary(message_with_image, category)
    if issue_id is None and ready_to_create:
        try:
            summary = build_llm_summary()
        except Exception:
            summary = build_summary(message_with_image, category)
        issue = Issue(
            tenant_id=tenant_id,
            property_id=property_id,
            category=category,
            summary=summary,
            description=message_with_image,
            status=IssueStatus.PENDING,
            vendor_id=vendor.id if vendor else None,
            estimated_cost=estimated,
        )
        db.add(issue)
        db.flush()
        issue_id = issue.id

    return response_text.strip() or "Thanks! I've logged your issue.", issue_id
