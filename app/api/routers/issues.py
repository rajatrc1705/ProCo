from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import IssueRead
from db import Issue

router = APIRouter(tags=["issues"])


@router.get("/issues", response_model=list[IssueRead])
def list_issues(db: Session = Depends(get_db)):
    return db.query(Issue).all()
