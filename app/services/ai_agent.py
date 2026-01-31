from __future__ import annotations

import json
import uuid

from json import JSONDecodeError

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.services.ai_stub import build_summary, classify_issue, estimate_cost, pick_vendor
from db import ChatMessage, ChatRole, Issue, IssueStatus

SYSTEM_PROMPT = """You are ProCo, an AI assistant helping tenants report property maintenance issues.

Your workflow:
1. Gather the problem, when it started, severity, and relevant details. Keep going back and forth until you have enough data on the issue.
2. Classify the issue by category.
3. Find a vendor match.
4. Estimate cost.
5. Summarize for the tenant and let the tenants know that you are escalating the summarized issue to the landlord..
    5, a. the vendor shouldnt be revealed to the tenant at this stage
    5, b. give the tenant an idea of the cost of repairing the issue
    5, c. give the tenant an option to escalate the issue to the landlord
6. If the tenant confirms, notify that you are escalating, and thank the tenant for raising the issue.
Be conversational and empathetic. Keep replies concise"""


def run_agent(
    db: Session,
    tenant_id: uuid.UUID,
    property_id: uuid.UUID,
    message: str,
    issue_id: uuid.UUID | None = None,
) -> tuple[str, uuid.UUID | None]:
    history = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.tenant_id == tenant_id,
            ChatMessage.property_id == property_id,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(12)
        .all()
    )
    history = list(reversed(history))

    category = classify_issue(message)
    vendor = pick_vendor(db, category)
    estimated = estimate_cost(float(vendor.hourly_rate), category) if vendor else None
    summary = build_summary(message, category)

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    cost_text = f"${estimated:.2f}" if estimated is not None else "TBD"
    context_prompt = (
        "Decide if you have enough info to escalate. Required: "
        "when it started, what exactly is happening, and severity. "
        "Ask one concise follow-up question if anything is missing. "
        "Do not reveal vendor identity. "
        "Respond ONLY as JSON with keys: response (string), ready_to_create (boolean). "
        f"\nCategory: {category.value}\nEstimated cost: {cost_text}"
    )

    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for chat in history:
        if chat.role == ChatRole.USER:
            messages.append(HumanMessage(content=chat.content))
        else:
            messages.append(AIMessage(content=chat.content))
    messages.append(SystemMessage(content=context_prompt))
    if not history or history[-1].role != ChatRole.USER or history[-1].content != message:
        messages.append(HumanMessage(content=message))

    response = llm.invoke(messages)
    raw_text = getattr(response, "content", "") or str(response)
    try:
        parsed = json.loads(raw_text)
        response_text = str(parsed.get("response", "")).strip()
        ready_to_create = bool(parsed.get("ready_to_create", False))
    except JSONDecodeError:
        response_text = raw_text.strip()
        ready_to_create = False

    if issue_id is None and ready_to_create:
        issue = Issue(
            tenant_id=tenant_id,
            property_id=property_id,
            category=category,
            summary=summary,
            description=message,
            status=IssueStatus.PENDING,
            vendor_id=vendor.id if vendor else None,
            estimated_cost=estimated,
        )
        db.add(issue)
        db.flush()
        issue_id = issue.id

    return response_text.strip() or "Thanks! I've logged your issue.", issue_id
