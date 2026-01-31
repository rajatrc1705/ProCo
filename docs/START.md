# Getting Started

This guide covers how to run the backend and frontend from scratch, including
installing `uv` if it is not already available.

## Backend (FastAPI)

### 1) Install `uv`

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Restart your shell (or run `source ~/.zshrc`).

### 2) Install Python deps + run

```bash
cd /Users/rajat/hackathons/ProCo
uv sync
export OPENAI_API_KEY=...
export DATABASE_URL=postgresql+psycopg://...
uv run uvicorn app.main:app --reload
```

Note: This repo uses `pyproject.toml` + `uv` instead of `requirements.txt`.
`uv sync` installs the dependencies defined in `pyproject.toml`.

## Frontend (Next.js in `app/web`)

### 1) Install pnpm (if missing)

```bash
volta install pnpm
```

### 2) Install + run

```bash
cd /Users/rajat/hackathons/ProCo/app/web
pnpm install
```

Create `app/web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_DEMO_TENANT_ID=<tenant-uuid>
NEXT_PUBLIC_DEMO_PROPERTY_ID=<property-uuid>
```

Then run:

```bash
pnpm dev
```

## URLs

- Frontend: http://localhost:3000
- Backend docs: http://127.0.0.1:8000/docs
