from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import ChatRequest, ChatResponse
from app.services.ai_agent import run_agent
from db import ChatMessage, ChatRole, User, UserRole

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    tenant = db.query(User).filter(User.id == request.tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    if tenant.role != UserRole.TENANT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a tenant"
        )

    property_id = request.property_id or tenant.property_id
    if property_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property ID is required for chat messages",
        )

    user_message = ChatMessage(
        issue_id=request.issue_id,
        property_id=property_id,
        tenant_id=tenant.id,
        role=ChatRole.USER,
        content=request.message,
    )
    db.add(user_message)
    db.flush()

    response_text, issue_id = run_agent(
        db=db,
        tenant_id=tenant.id,
        property_id=property_id,
        message=request.message,
        issue_id=request.issue_id,
    )

    user_message.issue_id = issue_id
    assistant_message = ChatMessage(
        issue_id=issue_id,
        property_id=property_id,
        tenant_id=tenant.id,
        role=ChatRole.ASSISTANT,
        content=response_text,
    )
    db.add(assistant_message)
    db.commit()

    return ChatResponse(
        response=response_text, issue_created=issue_id is not None, issue_id=issue_id
    )
