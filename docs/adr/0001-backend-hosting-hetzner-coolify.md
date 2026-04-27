# ADR 0001: Backend Hosting — Hetzner CX23 + Coolify

**Status:** Accepted
**Date:** 2026-04-26
**Author:** architect (agent)
**Context tickets:** CU-869d29f0x

## Context

NestJS is a stateful, long-running process. It requires persistent connections for WebSockets, cron-style background workers, and maintains an in-memory DI container that cannot be recreated cheaply on every HTTP request. Vercel Serverless Functions — the default co-hosting option alongside the Next.js frontend — are fundamentally incompatible with this architecture.

For v1 the team is one developer. Cost discipline is a hard constraint: Supabase free tier, Brevo free tier, Vercel hobby for the frontend. The backend host must be as cheap as possible while meeting:

- Always-on process (no cold starts on a studio owner's booking API call)
- Native WebSocket support (planned for future notification features)
- Native cron / background worker support (keep-alive pings, future async jobs)
- Automated TLS renewal
- A deployment UX that does not require deep Kubernetes or Docker Compose expertise
- A monitoring strategy for a 1-developer team

Three options were evaluated: Hetzner CX23 + Coolify (self-hosted PaaS), Vercel Functions Pro, and Render Starter.

## Decision

**Deploy the NestJS API on a Hetzner CX-class VPS (Finland, datacenter HEL1) managed by a self-hosted Coolify instance.**

Region choice: **HEL1 (Helsinki, Finland).** Selected by the human at GATE 2 over FSN1. Identical price and Hetzner feature parity with the German datacenters; ~180–210 ms round-trip from Tulum, MX is in the same band as Germany and acceptable for a studio-management API (internal tool, not a consumer-facing low-latency product). [4]

Coolify is deployed as the orchestration layer on the same box, managing Docker containers, Let's Encrypt TLS via Traefik, environment variables, and GitHub webhook-triggered deploys. It runs at zero incremental cost (open-source, no cloud tier required). [2]

### Backup strategy

- **Target:** Cloudflare R2 (free tier: 10 GB storage, 1 M Class A ops, 10 M Class B ops/month, zero egress). [12]
- **What is backed up:**
  1. Coolify configuration export (app definitions, env var shapes — not secret values)
  2. The Hetzner box `/etc` and Coolify data directory (`/data/coolify`)
  3. Postgres is hosted on Supabase (not local) — Supabase Pro backups cover it at launch; for dev/uat environments, pg_dump snapshots are optional and small
- **Tooling:** `rclone` (S3-compatible, well-documented for R2, single binary, cron-friendly). `restic` was considered but adds encryption complexity that is unnecessary when R2 is already access-controlled.
- **Cadence:** Daily at 02:00 UTC via a root cron job on the Hetzner box.
- **Retention:** 14 days (rclone `--max-age 14d` prune step after upload).

### Monitoring

Uptime Kuma runs as a Coolify-managed Docker container on the same Hetzner box. At ~80 MB RAM it fits within the ~2.7 GB headroom on a 4 GB box (see R1 resource estimate in the research report). [11]

Monitored endpoints:

| Target | Type | Alert threshold |
|---|---|---|
| `https://api.massage-tulum.dirk-jan.com/api/health` | HTTP 200 | 2 consecutive failures |
| `https://massage-tulum.dirk-jan.com` (Vercel FE) | HTTP 200 | 2 consecutive failures |
| Supabase REST (`https://<project>.supabase.co/rest/v1/`) | HTTP 200/404 | 2 consecutive failures |

Check interval: 60 seconds. Notifications: email (Brevo free tier).

### Rollback procedure

Because Coolify's free self-hosted edition does not offer one-click rollback to a prior image [6], the following convention is mandatory:

1. Before every production deploy, tag the current Docker image in Coolify UI with the release tag (e.g., `v0.2.3` matching the Git tag).
2. If a bad deploy occurs and the new container is healthy enough to replace the old one:
   a. In Coolify UI, navigate to the application → Deployments → select the previous deployment → "Redeploy".
   b. Alternatively: `git revert <sha>` locally, push to `main`, let the GitHub webhook re-trigger.
3. If the box itself is unhealthy: rebuild from the Hetzner snapshot (taken after each major provisioning step) or re-provision from the runbook.

Full runbook: `docs/runbooks/be-hosting.md` (authored by developer-devops).

### Tripwire — when to re-evaluate

Verbatim from the research report (R1):

> - Operator spends >4 hours/month on Coolify/OS incidents (excluding planned work)
> - A Coolify bug causes >2 unplanned outages in a rolling 60-day window
> - Team grows beyond 1 developer and the lack of a managed secrets/environment system becomes a blocker
> - WebSocket production load outgrows 4 GB RAM (upgrade to CX33 at €7.49/mo first before migrating)

When a tripwire is triggered, re-evaluate Render or Fly.io as managed alternatives. Do not migrate without a new ADR and human approval.

## Consequences

- **Positive:**
  - ~€3.49/mo ($3.75) — 5x cheaper than the next option (Render Starter at $7/mo). [1][3]
  - Full NestJS compatibility: always-on process, native WebSockets, native cron.
  - 20 TB/mo egress included — no surprise bandwidth bills. [1]
  - Automated TLS via Coolify + Traefik. [2]
  - GDPR-compliant datacenter (Germany). [1]
  - Uptime Kuma co-location saves the cost of an external monitoring service.

- **Negative:**
  - Operator is responsible for OS-level security patching. Mitigated by `unattended-upgrades`.
  - Coolify rollback UX is less polished than Render or Heroku. Mitigated by the image-tagging convention above.
  - No managed secrets rotation. Env vars set manually in Coolify UI.
  - Single datacenter — no automatic failover. Acceptable at v1 (studio management tool, not customer-facing 24/7 booking).

- **Neutral / follow-up work:**
  - Developer-devops provisions the box and Coolify (ticket: `[DEVOPS] Provision Hetzner CX23 + install Coolify + configure backup to Cloudflare R2`).
  - Runbook `docs/runbooks/be-hosting.md` must be authored before the first production deploy, covering: initial provision, OS patching procedure, Coolify app creation, backup verification, Uptime Kuma setup, rollback steps.
  - Domain DNS: `api.massage-tulum.dirk-jan.com` A record → Hetzner box IP (human action, not automated).

## Alternatives considered

**Vercel Functions Pro ($20/seat/month):** Rejected. NestJS is architecturally incompatible with stateless serverless functions. Each request would incur a cold start (500 ms–2 s), WebSockets are not natively supported, and background workers cannot run as persistent processes. 5x more expensive. [7][8][9][10]

**Render Starter ($7/service/month):** Rejected. Always-on (paid tier), but 512 MB RAM and 0.5 vCPU is marginal for NestJS. Future services (API + worker) would cost $14+/mo. No ability to co-locate Uptime Kuma or other tooling. Costs 2x more for less capacity. [3]

## Implementation notes

- Runbook to create: `docs/runbooks/be-hosting.md` (developer-devops writes this as part of the Provision ticket).
- Coolify image tagging convention: every CI deploy step should tag the image `ghcr.io/org/api:<git-sha>` before pushing; Coolify pulls the tagged image. This enables re-pointing to any prior tag.
- `unattended-upgrades` must be installed and enabled at provision time.
- Hetzner snapshot: take a manual snapshot in the Hetzner Console after the initial Coolify provisioning, before any application is deployed. Label: `coolify-base-<date>`.
- GitHub Actions secret `HETZNER_BOX_IP` (or similar) is needed only for deploy scripts; Coolify's webhook handles most deploy triggers automatically.
- The rclone backup cron job config lives in `docs/runbooks/be-hosting.md` as a copy-paste block, not in the repo (contains bucket credentials).

## References

1. Hetzner CX23 pricing — https://www.hetzner.com/cloud
2. Coolify docs — https://coolify.io/docs/applications/
3. Render pricing — https://render.com/pricing
4. Hetzner latency — https://hetzner-latency.sliplane.io/
5. Coolify rolling updates — https://coolify.io/docs/knowledge-base/rolling-updates
6. Coolify rollback discussion — https://github.com/coollabsio/coolify/discussions/1667
7. Vercel pricing — https://vercel.com/pricing
8. Vercel WebSocket support — https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
9. Vercel function duration limits — https://vercel.com/docs/functions/configuring-functions/duration
10. NestJS serverless FAQ — https://docs.nestjs.com/faq/serverless
11. Uptime Kuma resource usage — https://github.com/louislam/uptime-kuma/issues/3817
12. Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/
