# ADR 0002: Supabase Project and Environment Strategy

**Status:** Accepted
**Date:** 2026-04-26
**Author:** architect (agent)
**Context tickets:** CU-869d29f0x

## Context

Supabase is used for both the Postgres database and Auth (magic-link). The free tier provides 500 MB DB storage, 1 GB file storage, and pauses the project after 7 days of inactivity. The project uses three environments: dev (now), uat (at v1 feature-complete), prod (at launch).

Key constraints:
- Free tier pauses after 7 days of inactivity — must be actively mitigated.
- GitHub Actions scheduled workflows are auto-disabled after 60 days of repo inactivity — a second failure mode.
- The anon key is safe to use in the browser and in ping scripts; the service role key must never leave the backend.
- Local development must not depend on the remote Supabase project being awake.

## Decision

### Environment isolation

One separate Supabase project per environment. No shared databases between environments, ever (mirrors the rule in `CLAUDE.md`).

| Environment | Supabase project | When created | Plan |
|---|---|---|---|
| dev | `massage-tulum-dev` | Now | Free |
| uat | `massage-tulum-uat` | When v1 feature-complete | Free |
| prod | `massage-tulum-prod` | At launch | Pro (required for daily backups) |

Plan upgrade rationale: The Supabase Free plan does not include Point-in-Time Recovery or scheduled database backups. Once real studio bookings are stored in prod, the data must be backed up. Upgrading to Pro ($25/mo) at launch is the planned step. This is a human action requiring explicit approval.

### Free-tier pause mitigation (dev and uat)

**Method:** A GitHub Actions scheduled workflow pings the Supabase REST API with the anon key every 3 days. Community consensus confirms that REST API requests reset the inactivity timer. [14][15][16]

**Schedule:** `0 8 */3 * *` (08:00 UTC every 3rd day — well within the 7-day pause window).

**Endpoint pinged:** `GET /rest/v1/` — the lightest possible request; returns 200 or 404 (both acceptable), not an auth round-trip (which would hit Supabase Auth rate limits). [19]

**Second failure mode mitigated:** `gautamkrishnar/keepalive-workflow@v2` runs as a companion job in the same workflow or a sibling workflow. It uses the GitHub API to keep the repository marked as active, preventing GitHub's 60-day scheduled workflow disable. [17][18]

**Minimal keep-alive workflow** (developer-devops writes the actual file; canonical YAML from research report R2):

```yaml
# .github/workflows/keep-alive.yml
name: Supabase keep-alive

on:
  schedule:
    - cron: '0 8 */3 * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST API
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/")
          echo "HTTP status: $STATUS"
          if [ "$STATUS" != "200" ] && [ "$STATUS" != "404" ]; then
            echo "Unexpected status $STATUS — project may be paused or key invalid"
            exit 1
          fi

  keepalive:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gautamkrishnar/keepalive-workflow@v2
        with:
          time_elapsed: 50
```

Secrets required (stored as GitHub Actions repository secrets, NOT in code or `.env*` files):
- `SUPABASE_URL` — the project URL (e.g., `https://xyzxyz.supabase.co`)
- `SUPABASE_ANON_KEY` — anon/public key for the dev project

### Key distribution model

| Key | Where stored | Who uses it |
|---|---|---|
| Anon key | Vercel env vars (FE) + GitHub Actions secret (keep-alive) | Next.js client-side Supabase calls, keep-alive ping |
| Service role key | Coolify env vars (BE) | NestJS API only — never in browser, never in FE code |
| Both keys (dev) | Local `.env.local` (gitignored) | Local development |

**Rule:** The service role key bypasses RLS. It must only be used in server-side NestJS code running in trusted infrastructure (Coolify). Any usage in a user-request path requires explicit reviewer approval and an ADR update.

### Local development

Use the Supabase CLI Docker stack. Developers run `supabase start` to get a local Postgres + Auth + Storage + API stack on their machine. This does not require the remote dev project to be awake.

Local env vars live in `apps/api/.env.local` and `apps/web/.env.local` (both gitignored via root `.gitignore`). The Supabase CLI prints local credentials after `supabase start`.

### Migration discipline

Every schema change is a migration file generated via:
```
supabase migration new <description>
```

Migrations live in `supabase/migrations/`. They are version-controlled, reviewed in PRs, and applied to environments via `supabase db push` (dev/uat) or Supabase dashboard (prod, with human approval). Never apply migrations directly against prod without a human "yes" — matches the rule in `CLAUDE.md`.

## Consequences

- **Positive:**
  - Environment isolation prevents a bad dev migration from touching uat or prod data.
  - Keep-alive prevents the free-tier dev project from pausing and breaking the team's daily workflow.
  - Anon-key-only on the frontend eliminates a class of service role key leakage.
  - Local CLI stack means developers can work offline or when the remote project is paused.

- **Negative:**
  - Three separate Supabase projects means 3x the manual setup (credentials, Auth config, storage buckets). Mitigated by runbook and eventual Terraform/Supabase Management API scripts (future work).
  - Pro upgrade at launch adds $25/mo to COGS.
  - The keep-alive relies on community-documented behavior, not a Supabase API guarantee. If Supabase changes what counts as "activity," the ping may silently stop working. Monitor Uptime Kuma for unexpected project pauses.

- **Neutral / follow-up work:**
  - Developer-devops creates the keep-alive workflow file.
  - Human creates the dev Supabase project and stores credentials in GitHub Secrets and Coolify/Vercel env vars.
  - At uat creation and prod launch, this process repeats with new project credentials.
  - Supabase Pro upgrade is a human action at launch — flag in the launch runbook.

## Alternatives considered

**Single Supabase project for all environments with schema separation (schemas: `dev`, `uat`, `public`):** Rejected. RLS policies and Auth configuration cannot be cleanly isolated by Postgres schema. A dev migration error could affect prod data. CLAUDE.md explicitly prohibits shared databases between environments.

**Disable pause prevention, just re-enable manually when paused:** Rejected. A paused dev project breaks CI (RLS tests use `supabase start` locally, but any integration test pointing at remote dev would fail). It also trains developers to ignore the monitoring alerts. 3-day pings cost ~$0 in GitHub Actions minutes.

**Self-host Postgres on the Hetzner box:** Rejected for v1. Supabase provides Auth, Storage, and RLS out of the box. Running and backing up a self-hosted Postgres at production quality is significant operational overhead for a 1-person team.

## Implementation notes

- GitHub Actions secrets to create: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for keep-alive + CI RLS tests).
- Workflow file: `.github/workflows/keep-alive.yml` (developer-devops ticket).
- Local development setup documented in `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md` (added by developer-be and developer-fe respectively).
- `supabase/config.toml` is the Supabase CLI config checked into the repo (no secrets in it).
- `.gitignore` must include: `.env`, `.env.local`, `.env.*`, `!.env.example`.
- The `supabase` directory lives at repo root (not inside `apps/api/`) so both BE and FE can reference shared migrations and types.

## References

14. Supabase keep-alive via REST — https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel
15. Supabase pause prevention guide — https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263
16. George McCarron — preventing Supabase pausing — https://www.georgemccarron.com/blog/preventing-supabase-pausing
17. GitHub Actions scheduled workflow disable — https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow
18. Keepalive Workflow GitHub Action — https://github.com/marketplace/actions/keepalive-workflow
19. Supabase Auth rate limits — https://supabase.com/docs/guides/auth/rate-limits
