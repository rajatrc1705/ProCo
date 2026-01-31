from collections.abc import Generator

from sqlalchemy.orm import Session

from db import get_sessionmaker

SessionLocal = get_sessionmaker()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
