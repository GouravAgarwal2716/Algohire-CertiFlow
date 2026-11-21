# CertiFlow — Skilling Certificate Issuance Platform

> **Pragati Skills Mission | Algohire Hackathon Submission**

## Requirements & Deliberate Design Decisions

### What we built
CertiFlow is an event-driven, containerised credentialing platform that replaces the Pragati Skills Mission's broken manual workflow (email → WhatsApp → Word → email) with a secure, auditable, real-time certification pipeline. It handles the full journey: batch upload → multi-officer district review → quality gate → state approval → automatic per-candidate PDF certificate generation → WhatsApp delivery → public employer verification.

### Deliberate Design Decisions

| Decision | Chosen | Alternative Considered | Rationale |
|---|---|---|---|
| **District quorum** | 2 distinct officers | 1 or majority vote | Prevents single-officer fraud while keeping the flow practical |
| **Quality threshold** | ≥ 50 candidates triggers PENDING_QUALITY | Fixed team, percentage | Proportional risk — large batches have higher fraud surface |
| **Send-back policy** | Increment `revisionNumber`, keep old approvals frozen in `BatchApproval` | Soft-delete / override | Full immutable audit trail; prior approvals are evidence, not noise |
| **SLA escalation** | BullMQ delayed job per status+revision; fires if still untouched | Cron scanner | Scales to thousands of batches without polling the DB every minute |
| **PDF download security** | HMAC-SHA256 signed URL with expiry | Presigned S3 URL | No cloud dependency locally; same security model; swappable in prod |
| **Public verify PII** | Returns only name, course, centre, district, dates, status | Full record | Employers need proof-of-credential, not personal data |
| **Idempotency** | Deterministic BullMQ `jobId: cert-{batchId}-{candidateId}` | UUID job ID | Exactly-once semantics across container restarts |
| **Redis cache on revoke** | Synchronous `redis.del` inside revoke handler | Async / TTL expiry | Employer checking 1 second later must see REVOKED immediately |
| **AI Fraud Detection** | Dual Engine: Custom Isolation Forest + Random Forest in `/ml` + OpenAI GPT-4o Copilot | Rules-only or manual sampling | Detects phantom candidates, sequential phone numbers, and grade clustering before issuance |

---

## Architecture

```
┌─────────────┐     SSE / HTTP      ┌──────────────────────┐
│   Browser   │◄────────────────────│  React + Vite (Nginx)│
│  (Tailwind) │                     └──────────┬───────────┘
└─────────────┘                                │ /api proxy
                                               ▼
                                  ┌────────────────────────┐
                                  │  Express + TypeScript  │
                                  │  API Server (:3000)    │
                                  │  - JWT Auth            │
                                  │  - RBAC middleware      │
                                  │  - Correlation IDs      │
                                  │  - SSE /events/stream  │
                                  └────┬──────────────┬────┘
                                       │              │
                               Prisma  │        Redis │ Pub/Sub
                                       ▼              ▼
                              ┌──────────────┐  ┌──────────┐
                              │  PostgreSQL  │  │  Redis   │
                              │  (Prisma +   │  │  cache + │
                              │  migrations) │  │  BullMQ  │
                              └──────────────┘  └────┬─────┘
                                                      │
                                              ┌───────▼──────┐
                                              │  BullMQ      │
                                              │  Worker      │
                                              │  (PDF+WA)    │
                                              └───────┬──────┘
                                                      │ POST /send
                                              ┌───────▼──────┐
                                              │ Mock-WhatsApp │
                                              │  Service      │
                                              │  (:3001)      │
                                              └──────────────┘
```

### Queues
| Queue | Purpose | Attempts | Backoff |
|---|---|---|---|
| `certificate-issuance` | PDF generation + WhatsApp delivery | 8 | Exponential 1s→128s |
| `sla-watchdog` | Delayed escalation if batch sits untouched | 3 | Fixed |

---

## Tech Stack Justification

| Tool | Used for | Why |
|---|---|---|
| **Node.js + Express + TypeScript** | API server | Type-safety catches state-machine bugs at compile time |
| **Prisma** | ORM + migrations | Schema-first with auto migrations; `$executeRaw FOR UPDATE` for row-level locking |
| **PostgreSQL** | Relational data + ACID | Multi-officer concurrency requires true serialisable transactions |
| **Redis** | BullMQ queues + SSE pub/sub + verify cache | Durable queues (AOF), sub-millisecond cache, fan-out events |
| **BullMQ** | Background job queues | Deterministic `jobId` for exactly-once; built-in exponential retries |
| **PDFKit** | Certificate PDF generation | Runs in-process; no external service dependency |
| **qrcode** | QR code embedded in PDF | Employer scans → instant verify URL |
| **React + Vite + Tailwind** | Frontend | Vite HMR, Tailwind utility classes, zero runtime CSS overhead |
| **SSE** | Real-time push | Simpler than WebSockets for one-directional updates; works through Nginx |
| **pino** | Structured JSON logging | Correlates every log line to a `correlationId` spanning HTTP → worker → WhatsApp |
| **Vitest + Supertest** | Integration tests | Runs against real Postgres/Redis; proves moments and invariants |
| **Mock WhatsApp** | Chaos-capable WA stub | Configurable `FAIL_RATE` / `TIMEOUT_RATE` to prove retry resilience |

---

## Demo Personas (switch instantly from top-bar)

| Persona | Role | District |
|---|---|---|
| **Anika** | Training Centre | Hyderabad |
| **Dev** | District Officer | Hyderabad |
| **Meera** | District Officer | Hyderabad |
| **Kabir** | District Officer | Hyderabad |
| **Ravi** | District Officer | Warangal (cross-district RBAC tests) |
| **Neha** | Quality Team | — |
| **Farah** | State Office (Director) | — |

Pre-seeded data: 1 small batch in `PENDING_DISTRICT`, 1 completed batch with 3 valid certificates (verify `PSM-2026-HYD001` instantly).

---

## Unique Feature: AI Autonomous Forensic Audit Pipeline 🧠

Every batch can be run through a **4-stage autonomous audit agent** that:
1. **Extracts statistical features** — mean, median, stddev, pass rate
2. **Runs forensic anomaly detection** — score clumping (stddev < 1.2 → ghost data), grade saturation (>60% perfect scores → answer key leak), sequential phone numbers (SIM batch purchase → fake candidates), marginal clustering (>30% just above pass threshold → score manipulation)
3. **Computes a 0–100 risk score** and assigns LOW / MEDIUM / HIGH risk
4. **Issues a recommendation**: FAST_TRACK_APPROVAL / MANUAL_REVIEW_RECOMMENDED / ESCALATE_TO_STATE_VIGILANCE

This is surfaced on every batch detail panel under the **🧠 AI Audit** tab.

---

## The 6 Mandatory Moments

| Moment | Implementation |
|---|---|
| **1. Atomic CSV upload** | Full in-memory Zod validation → if any error: 0 rows written, HTTP 400 with per-row errors |
| **2. Concurrent approvals** | `SELECT … FOR UPDATE` row-level Postgres lock; second transaction waits and sees updated state |
| **3. Exactly-once issuance** | BullMQ `jobId: cert-{batchId}-{candidateId}` deduplicates; idempotency key on WhatsApp |
| **4. Instant revocation** | `redis.del` synchronously inside revocation handler; next verify query hits DB |
| **5. SLA escalation** | Delayed BullMQ job fires after `SLA_TIMEOUT_MS`; checks batch still in that status |
| **6. Send-back policy** | `revisionNumber++` on resubmit; old `BatchApproval` rows preserved by scoped unique constraint |

---

## Local Setup (3 commands)

```bash
git clone <your-repo-url>
cd certiflow
docker compose up --build
```

Then open **http://localhost:5173** — demo data and all personas ready instantly.

**Run tests:**
```bash
# From repo root (requires running postgres + redis)
docker compose exec api npm test
# Or locally with running infra:
cd backend && npm test
```

---

## Known Limitations & Next Steps

- **PDF downloads from Docker**: Signed URLs use `localhost:3000` — works for local demo; in prod these would be CloudFront presigned S3 URLs
- **WhatsApp Inbox CORS**: The inbox tab calls `localhost:3001` directly — in prod this would be proxied through the backend
- **Worker in same image**: Worker and API share the backend Dockerfile (separate entrypoint) — in prod these would be separate images with independent scaling
- **No real WhatsApp**: The mock is intentionally simple; a real WABA integration would need webhook callbacks for delivery receipts
- **SLA in demo**: `SLA_TIMEOUT_MS=60000` (1 min). Set `SLA_TIMEOUT_MS=500` in env for faster test observation

---

## AI Usage

Antigravity (Google DeepMind) was used to scaffold boilerplate (prisma schema, express routes, react components). Every line was reviewed and corrected:
- Concurrency locking (`FOR UPDATE`) was hand-verified against Postgres docs
- BullMQ idempotency pattern was confirmed against BullMQ docs
- AI-generated PDF layout was tested against PDFKit API
- Test assertions were written to prove business rules, not just code paths
