from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import chat, health, issues, vendors

app = FastAPI(title="ProCo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
