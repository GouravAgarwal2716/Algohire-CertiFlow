# CertiFlow — Production Deployment Plan

## Target Load
- 100,000 registered users, ~10,000 DAU
- Peak: **500 batches/hour** approved → **30,000 PDFs + 30,000 WhatsApp messages/hour**
- Public verification: thousands of requests/day in bursts

---

## Architecture Diagram

```
                        ┌─────────────────────────────────┐
                        │       AWS CloudFront CDN         │
                        │  (Frontend static assets + cert  │
                        │   PDF presigned URL distribution) │
                        └────────────────┬────────────────┘
                                         │
                             ┌───────────▼──────────┐
                             │  AWS ALB (Application │
                             │  Load Balancer)        │
                             └───────────┬──────────┘
                                         │
                   ┌─────────────────────┼──────────────────────┐
                   │                     │                      │
          ┌────────▼──────┐   ┌──────────▼──────┐   ┌──────────▼──────┐
          │  ECS API Pod  │   │  ECS API Pod    │   │  ECS API Pod    │
          │  (Express)    │   │  (Express)      │   │  (Express)      │
          │  min: 3       │   │  auto-scaled    │   │  max: 20        │
          └────────┬──────┘   └──────────┬──────┘   └──────────┬──────┘
                   │                     │                      │
                   └─────────────────────┼──────────────────────┘
                                         │
                   ┌─────────────────────┼──────────────────────┐
                   ▼                     ▼                      ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │  RDS PostgreSQL  │  │  ElastiCache     │  │  ECS Worker Pool │
        │  Multi-AZ        │  │  Redis Cluster   │  │  (BullMQ)        │
        │  + Read Replica  │  │  (AOF + replica) │  │  min: 5, max: 50 │
        └──────────────────┘  └──────────────────┘  └──────────────────┘
                                                               │
                                                    ┌──────────▼──────────┐
                                                    │  EFS Shared Volume   │
                                                    │  → S3 sync (PDFs)   │
                                                    └──────────────────────┘
```

---

## Component Hosting & Rationale

| Component | Hosting | Why |
|---|---|---|
| Frontend | **S3 + CloudFront** | Zero-server static delivery; CDN edge reduces verify latency to <30ms globally |
| API Server | **AWS ECS Fargate** (3-20 pods) | Serverless containers; pay-per-task; no AMI maintenance |
| Worker | **AWS ECS Fargate** (5-50 pods) | Independent scaling from API; more workers = more PDF throughput |
| PostgreSQL | **RDS Aurora PostgreSQL** (Multi-AZ + 1 Read Replica) | Automatic failover; connection pooling via RDS Proxy |
| Redis | **ElastiCache Redis Cluster** (3 shards, AOF enabled) | BullMQ persistence; pub/sub for SSE fanout |
| Cert PDFs | **S3 + CloudFront signed URLs** (IAM-controlled) | Durable, cheap, globally distributed; presigned URLs expire |

---

## Capacity Math for Peak Load

**Peak: 500 batch approvals/hr → 30,000 PDFs + 30,000 WhatsApp msgs/hr**

```
PDFs:
  - 30,000 PDFs/hr = 500 PDFs/min = ~8.3 PDFs/second
  - PDFKit generation time: ~150ms/PDF
  - Workers needed: ceil(8.3 × 0.15) = 2 workers just for PDFs (sequential)
  - With 10 worker pods at concurrency=10: 100 concurrent → ~667 PDFs/min → easily handles peak

WhatsApp:
  - 30,000 messages/hr = 500 msg/min = ~8.3 msg/sec
  - WhatsApp Business API rate limit: 80 msg/sec (upgradeable to 250 msg/sec)
  - At 8.3 msg/sec: well within single-tier limits
  - BullMQ processes queue → absorbs spikes → drains backlog at 80 msg/sec

Total worker sizing at peak:
  - 10 × ECS Fargate tasks (0.5 vCPU / 1 GB each)
  - Each task: concurrency=10 (certificate-issuance) + 5 (sla-watchdog)
  - Burst: auto-scale to 50 tasks on CloudWatch `QueueDepth > 1000` alarm
  - Backlog clear time at 500 batches: ~6 minutes at max scale
```

---

## Scaling Strategy

| Component | Scales Horizontally? | Trigger | Limit |
|---|---|---|---|
| API pods | ✅ Yes | CPU > 60% or RPS > 500/pod | 20 pods |
| Worker pods | ✅ Yes | BullMQ `certificate-issuance` depth > 500 | 50 pods |
| PostgreSQL | ⚠️ Read replicas only | Add replicas for verify queries | Write bottleneck: 1 primary |
| Redis | ✅ Cluster sharding | Memory > 70% | 6 shards |
| WhatsApp | ⚠️ Rate-limited | Fixed 80 msg/sec (Meta API limit) | Queue drains linearly |

**Throughput bottleneck at peak**: WhatsApp API rate limit (80 msg/sec). At peak, 30,000 messages drain in 30,000/80 = **375 seconds (~6 minutes)**. BullMQ queue absorbs the burst. Users see `ISSUING` → `COMPLETED` within 10 minutes of approval.

---

## Failure Handling

### Worker Crash
- BullMQ jobs are persisted in Redis (AOF). On restart, all `active` jobs are re-queued automatically.
- Idempotent worker: re-processes without duplicating certificates (checks DB first).
- ECS Fargate auto-restarts crashed tasks; zero manual intervention.

### Redis Restart
- AOF (Append-Only File) persistence ensures zero job loss.
- ElastiCache Cluster: replica promotes to primary in <30 seconds.
- API continues serving reads from local memory during brief reconnect.

### WhatsApp API Outage
- BullMQ jobs retry with exponential backoff (1s → 2s → 4s → 128s, 8 attempts).
- After 8 failures: job moves to Dead Letter Queue (`whatsapp-dlq`).
- Circuit breaker (using `opossum`): after 5 consecutive failures, bypass WhatsApp for 60s, then probe.
- Alert: CloudWatch alarm on DLQ depth > 100 → PagerDuty → on-call engineer manually retriggers batch.
- WhatsApp outage does not block certificate issuance — PDF generated and stored; re-delivery attempted on recovery.

### Slow Database
- RDS Proxy: connection pooling prevents connection exhaustion under spike.
- Read replicas serve `GET /api/public/verify` and dashboard list queries.
- Write queries (approvals, state changes) always hit primary.
- PgBouncer as sidecar in ECS task for further pooling.
- RDS Performance Insights + slow query logs → alarm on P99 > 500ms.

---

## Certificate File Storage & Access Control

```
Worker generates PDF → uploads to S3 (bucket: certiflow-certs-prod)
  Path: s3://certiflow-certs-prod/{districtId}/{batchId}/{certNumber}.pdf

Access Control:
  - Bucket: Private, no public access
  - API generates CloudFront signed URL (key pair ID + private key) expiring in 1 hour
  - URL transmitted via WhatsApp → candidate downloads via CloudFront edge
  - IAM role: Worker has s3:PutObject only; API has s3:GetObject only
  - Object lock: COMPLIANCE mode; PDFs cannot be deleted for 7 years (regulatory)
```

---

## Monitoring & Alerting

| Metric | Threshold | Action |
|---|---|---|
| API P99 latency | > 1000ms | PagerDuty (P2) |
| Worker queue depth (cert-issuance) | > 5000 | Auto-scale workers |
| WhatsApp DLQ depth | > 100 | PagerDuty (P1) |
| DB connections | > 80% max | Scale RDS Proxy |
| Redis memory | > 70% | Add shard |
| Failed job rate | > 5% over 5 min | PagerDuty (P2) |
| Public verify error rate | > 1% | PagerDuty (P2) |
| Certificate issuance lag | > 15 min from approval | Slack alert |

**Tools**: AWS CloudWatch (metrics + alarms) + OpenTelemetry (distributed traces with correlationId) + Datadog APM (optional) + Pino structured logs → CloudWatch Logs Insights.

---

## Monthly Cost Estimate (USD)

| Service | Config | $/month |
|---|---|---|
| ECS Fargate (API, 3-10 avg tasks) | 0.5 vCPU / 1GB × 7 avg | ~$70 |
| ECS Fargate (Worker, 5-15 avg tasks) | 0.5 vCPU / 1GB × 10 avg | ~$100 |
| RDS Aurora PostgreSQL (Multi-AZ) | db.t4g.medium | ~$120 |
| ElastiCache Redis (3 × cache.t3.small) | Cluster mode | ~$80 |
| S3 + CloudFront (PDFs) | 100k certs × ~100KB avg, CDN | ~$15 |
| ALB | 2 LCUs avg | ~$25 |
| CloudWatch + Logs | Moderate retention | ~$30 |
| Data transfer | Moderate | ~$20 |
| **Total** | | **~$460/month** |

**Trade-offs:**
- Aurora over RDS Standard (+$30/mo): automatic failover in <30s vs ~60s; worth it for a certification registry
- Fargate over EC2: +20% cost but zero AMI patching; appropriate for a 2-person team
- CloudFront over direct S3 presigned: +$5/mo for global PDF download speeds
- Could reduce to ~$280/mo by using reserved instances (1-year commitment)
