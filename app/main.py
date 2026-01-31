from fastapi import FastAPI

from app.api.routers import health, issues, vendors

app = FastAPI(title="ProCo API")

app.include_router(health.router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
