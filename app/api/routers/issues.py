import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import IssueRead
from db import Issue, IssueStatus

router = APIRouter(tags=["issues"])


@router.get("/issues", response_model=list[IssueRead])
def list_issues(db: Session = Depends(get_db)):
    return db.query(Issue).all()


@router.patch("/issues/{issue_id}/approve", response_model=IssueRead)
def approve_issue(issue_id: uuid.UUID, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    issue.status = IssueStatus.APPROVED
    db.commit()
    db.refresh(issue)
    return issue


@router.patch("/issues/{issue_id}/reject", response_model=IssueRead)
def reject_issue(issue_id: uuid.UUID, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    issue.status = IssueStatus.REJECTED
    db.commit()
    db.refresh(issue)
    return issue
