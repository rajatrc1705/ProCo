from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import VendorRead
from db import Vendor

router = APIRouter(tags=["vendors"])


@router.get("/vendors", response_model=list[VendorRead])
def list_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).all()
