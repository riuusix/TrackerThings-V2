# TrackerThings AI Microservice

Specialized Python/FastAPI microservice serving as the `SelfHostedServerProvider` for academic document extraction in **TrackerThings V2**.

Designed for zero-spin-down, low-memory execution on **Koyeb Free Tier** (512 MB RAM).

---

## 1. Architectural Guardrails

- **Zero Database Persistence**: This service has **no direct connection** to the PostgreSQL or Prisma database. It functions purely as a stateless inference / extraction engine.
- **Privacy First (In-Memory Processing)**: User documents are processed strictly in RAM memory buffers and are never written to disk or logged.
- **Service-to-Service Security**: All extraction endpoints are protected by shared secret key verification (`SERVICE_API_KEY`). Only authenticated TrackerThings V2 Next.js backend servers can invoke extraction.

---

## 2. API Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | Uptime & readiness probe used by Koyeb and Next.js `isAvailable()` |
| `GET` | `/` | No | Service greeting and root info |
| `POST` | `/api/extract/academic` | Yes | Multipart academic document extraction endpoint |
| `POST` | `/extract` | Yes | Legacy alias for Next.js `SelfHostedServerProvider` |
| `GET` | `/docs` | No | Interactive OpenAPI Swagger UI documentation |

### Authentication Headers

Clients must provide either:
- `Authorization: Bearer <SERVICE_API_KEY>`
- or `X-TrackerThings-Service-Key: <SERVICE_API_KEY>`

---

## 3. Local Development

### Prerequisites
- Python 3.11+
- pip

### Setup & Run
```bash
cd trackerthings-ai-service
pip install -r requirements.txt
cp .env.example .env
python main.py
```

The service will listen on `http://localhost:8000`. Test via Swagger UI at `http://localhost:8000/docs`.

---

## 4. Koyeb Deployment

1. Push this repository to GitHub.
2. In the Koyeb Console, create a new **App** and select **GitHub**.
3. Point to the repository and specify root directory: `trackerthings-ai-service` (or repo root).
4. Select **Dockerfile** builder.
5. Set Environment Variables:
   - `SERVICE_API_KEY`: Strong random secret shared with Next.js backend.
   - `ENVIRONMENT`: `production`
6. Koyeb will automatically assign an HTTPS domain (e.g. `https://trackerthings-ai-service-<username>.koyeb.app`).
7. Update Next.js backend with:
   - `SELF_HOSTED_ML_URL="https://trackerthings-ai-service-<username>.koyeb.app"`
   - `SELF_HOSTED_ML_KEY="<SERVICE_API_KEY>"`

