# CertiFlow — Local Setup Guide

## Prerequisites
- Docker ≥ 20.x  and  Docker Compose v2+
- Git

## 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/certiflow.git
cd certiflow
```

## 2. Start the entire platform (one command)

```bash
docker compose up --build
```

**What happens automatically:**
1. PostgreSQL and Redis spin up with health checks
2. Mock WhatsApp service starts on port 3001
3. API server: runs `prisma migrate deploy` then seeds demo data (Anika, Dev, Meera, Kabir, Ravi, Neha, Farah + 2 sample batches + 3 valid certificates)
4. BullMQ worker starts processing jobs
5. Frontend builds and serves via Nginx on port 5173

**Wait about 60–90 seconds for the full stack to be ready.**

## 3. Access the app

| Service | URL |
|---|---|
| **Main App** | http://localhost:5173 |
| **API** | http://localhost:3000 |
| **API Health** | http://localhost:3000/health |
| **Mock WhatsApp** | http://localhost:3001/health |
| **Public Verification** | http://localhost:5173 → "Public Verification" tab |

## 4. Try the demo (switch personas from the top-bar dropdown)

| Persona | Role | First action |
|---|---|---|
| **Anika** | Training Centre | Create batch → Upload CSV → Submit |
| **Dev** | District Officer | Approve batch |
| **Meera** | District Officer | 2nd approval (triggers state review) |
| **Neha** | Quality Team | Approve large batches (≥50 candidates) |
| **Farah** | State Office | Final approval → watch certificates issue live |

**Demo CSVs** — download from the Anika dashboard:
- `samples/valid_batch_small.csv` — 5 clean rows
- `samples/valid_batch_large_60.csv` — 60 candidates (triggers Quality team review)
- `samples/invalid_batch_with_errors.csv` — intentionally bad rows to show Moment 1

**Pre-seeded certificates for instant public verification:**
- `PSM-2026-HYD001` ← try on the Public Verification tab
- `PSM-2026-HYD002`
- `PSM-2026-HYD003`

## 5. Run the automated test suite

```bash
# Tests run against real Postgres + Redis (they must be running)
docker compose exec api npm test
```

Or if running infra locally (not in Docker):
```bash
cd backend
npm test
```

**Expected output:** 7 test suites × multiple tests covering all 6 Mandatory Moments and 5 Never-Happen invariants.

## 6. Control Chaos Engineering (WhatsApp reliability)

The WhatsApp Inbox tab has live sliders. Or via API:
```bash
# Set 35% failure rate to watch BullMQ retries in action
curl -X POST http://localhost:3001/chaos \
  -H 'Content-Type: application/json' \
  -d '{"failRate": 0.35, "timeoutRate": 0.1}'

# Reset
curl -X POST http://localhost:3001/chaos \
  -H 'Content-Type: application/json' \
  -d '{"failRate": 0, "timeoutRate": 0}'
```

## 7. Stop everything

```bash
docker compose down
# To also wipe database volumes:
docker compose down -v
```

## Troubleshooting

| Issue | Fix |
|---|---|
| Port 5432 in use | `docker compose down -v` and retry |
| Seeds not applied | `docker compose exec api npx prisma db seed` |
| Frontend not loading | Wait 30s more for Nginx to finish building |
| Certificates not generating | Check worker logs: `docker compose logs worker -f` |
