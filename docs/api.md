# ProCo API (FastAPI)

Base URL (local): `http://127.0.0.1:8000/api`

## Environment

- `DATABASE_URL` must be set for DB access.
- `OPENAI_API_KEY` must be set for chat responses.

## Endpoints

### Health

`GET /health`

```bash
curl http://127.0.0.1:8000/api/health
```

### Vendors

`GET /vendors`

```bash
curl http://127.0.0.1:8000/api/vendors
```

### Issues

`GET /issues`

```bash
curl http://127.0.0.1:8000/api/issues
```

`PATCH /issues/{issue_id}/approve`

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/<issue-uuid>/approve
```

`PATCH /issues/{issue_id}/reject`

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/<issue-uuid>/reject
```

### Chat

`POST /chat`

Request body:

```json
{
  "tenant_id": "uuid",
  "message": "string",
  "issue_id": "uuid (optional)",
  "property_id": "uuid (optional)"
}
```

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"<tenant-uuid>","message":"My heater is not working."}'
```

Response shape:

```json
{
  "response": "string",
  "issue_created": true,
  "issue_id": "uuid"
}
```
