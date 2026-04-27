# Research: Foundation Prerequisites

**Date:** 2026-04-26
**Author:** researcher (agent)
**Ticket:** [CU-869d29f0x](https://app.clickup.com/t/869d29f0x)
**Spec:** [Spec: Infrastructure Foundation](https://app.clickup.com/9012175939/docs/8cjnt23-12272)
**Requested by:** architect (for ADRs 0001–0006)
**Decision deadline:** not blocking (spec already approved)

---

## Summary

Six questions answered for the Feature 0 infrastructure foundation. **R1:** Hetzner CX23 + Coolify is confirmed correct — always-on, 5x cheaper than Vercel Pro, the only option compatible with NestJS's stateful architecture + future WebSockets/cron; backup goes to Cloudflare R2 (free tier covers v1). **R2:** Anon-key REST ping on `0 8 */3 * *` does prevent pausing per community consensus, but the GitHub Actions 60-day repo-inactivity disable is a real second failure mode — mitigate with `gautamkrishnar/keepalive-workflow`. **R3:** Use `pnpm/action-setup@v4` + `actions/cache@v4` for the pnpm store, and Vercel Remote Cache (free for individuals) for Turborepo — no extra service needed. **R4:** next-intl v4.9.x with `localePrefix: 'as-needed'` and `defaultLocale: 'es'` renders Spanish at `/` without redirect; TypeScript augmentation catches missing keys at build time. **R5:** CSP belongs in Next.js middleware (not `next.config.ts`) with a per-request nonce; the nonce does survive locale redirects if both are in the same middleware function, but all pages become dynamically rendered. **R6:** `supabase start` + `supabase test db` runs fully in GitHub Actions via Docker; pgTAP is the canonical tool for RLS testing; a typical 10–20 test suite runs in ~45–75 seconds cold.

---

## R1 — BE Hosting Comparison Matrix

### Option A: Hetzner CX23 + Coolify (HUMAN'S CHOICE)

**What it is:** €3.49/mo VPS (2 vCPU, 4 GB RAM, 40 GB NVMe, 20 TB/mo traffic) [1] with Coolify — a self-hosted open-source PaaS (Heroku-style) that handles Docker orchestration, auto-SSL via Let's Encrypt, env var management, and GitHub webhook deploys. [2]

**Pros:**
- Lowest cost: €3.49/mo (~$3.75) vs $7 Render Starter or $20+ Vercel Pro [1][3]
- Always-on: persistent process, no cold starts; suitable for NestJS stateful lifecycle
- Full WebSocket + cron + background worker support — no architectural compromises
- 20 TB/mo egress included; traffic from Tulum (MX) to Finland (Hetzner HEL1, selected at GATE 2) is ~180–210ms round-trip [4] — acceptable for a studio management API
- Coolify handles auto-SSL renewal, rolling restarts, multi-container deploys, environment variables [2]
- Hetzner is GDPR-compliant (Germany), bonus for EU data residency
- Self-hosting Coolify costs $0 (open-source; cloud tier not needed) [2]

**Cons:**
- Operator is responsible for OS-level security patching (unattended-upgrades recommended)
- Coolify is a younger PaaS; rollback UX less polished than Heroku/Render
- No managed-database option (Supabase is used separately, so non-issue at v1)
- Uptime Kuma needs to run on the same box or a separate cheap node

**Operational burden:**
- OS updates: handled by `unattended-upgrades` (automated); ~1h/month for major kernel upgrades
- TLS renewal: Coolify delegates to Let's Encrypt via Traefik/Caddy; fully automated [2]
- Backups: manual setup required (see below)

**Rollback procedure (Coolify + Git):**
1. `git revert <bad-commit-sha>` locally — creates a new revert commit
2. `git push origin main` — Coolify's GitHub webhook fires automatically if auto-deploy is enabled
3. Coolify runs the new build, health-checks, then swaps traffic (rolling update where supported [5])
4. If the build itself fails and the old container is still running, Coolify keeps serving the old container until you fix the push — there is NO one-click rollback to a prior image in the free self-hosted Coolify [6]
5. Mitigation: tag release images in Coolify UI before each deploy; re-point to previous image tag manually via the Coolify dashboard as emergency rollback

**Tripwire — when to switch away from Hetzner+Coolify:**
- Operator spends >4 hours/month on Coolify/OS incidents (excluding planned work)
- A Coolify bug causes >2 unplanned outages in a rolling 60-day window
- Team grows beyond 1 developer and the lack of a managed secrets/environment system becomes a blocker
- WebSocket production load outgrows 4 GB RAM (upgrade to CX33 at €7.49/mo first before migrating)

### Option B: Vercel Functions Pro

**What it is:** Serverless function hosting at $20/developer seat/month [7], runs NestJS as a serverless adapter.

**Pros:** Zero ops; co-location with Next.js frontend.

**Cons:**
- NestJS is fundamentally stateful; Vercel Serverless Functions are stateless and terminate — bootstrap runs on every cold start (500ms–2s latency)
- WebSockets: not natively supported [8]
- Cron jobs: supported only as isolated invocations, not persistent processes
- Max function duration: Hobby=10s, Pro=default 15s (configurable to 300s via Fluid Compute) [9]
- Cost: $20/mo vs €3.49/mo — 5x more expensive at v1 scale
- Future WebSocket requirement would require complete backend re-architecture

**Verdict: Rejected.** NestJS architecture mismatch is disqualifying.

### Option C: Render Starter

**What it is:** Managed PaaS at $7/service/month for always-on web services (512 MB RAM, 0.5 CPU) [3].

**Pros:** Fully managed; native WebSocket support; cron jobs as separate services.

**Cons:**
- $7/mo for always-on — 2x Hetzner; future services (NestJS + worker) = $14+/mo
- 512 MB RAM and 0.5 CPU is marginal for NestJS under any meaningful load
- Less control: can't run Uptime Kuma or other tooling alongside
- Free tier sleeps after 15 min (useless for API) [3]

**Verdict: Rejected.** Costs 2x more for less RAM/CPU; offers no meaningful operational benefit over Coolify given the project already has Hetzner.

### Comparison Matrix

| Criterion | Hetzner CX23 + Coolify | Vercel Functions Pro | Render Starter |
|---|---|---|---|
| Monthly cost (v1) | ~€3.49 ($3.75) [1] | $20/seat [7] | $7/service [3] |
| Monthly cost (2 services) | ~€3.49 (same box) | $20/seat | $14 |
| Always-on / no cold start | Yes | Partial (Fluid Compute) [9] | Yes (paid tier) |
| NestJS stateful support | Full | Incompatible [8][10] | Full |
| WebSockets | Yes (native) | No [8] | Yes |
| Cron / background workers | Yes (native) | Isolated only [9] | Yes (separate service) |
| RAM at v1 | 4 GB | Per-function ephemeral | 512 MB |
| Latency from Tulum (MX) | ~170–200ms (Germany) [4] | ~50–80ms (edge) [7] | ~80–120ms (Oregon) [3] |
| TLS / SSL | Auto (Coolify+Traefik) [2] | Auto | Auto |
| OS patching | Operator responsibility | None | None |
| Rollback | Git revert + redeploy [5][6] | Git revert | Git revert (one-click) |
| Uptime Kuma co-location | Yes (~80 MB RAM) [11] | No | No |
| Egress pricing | 20 TB/mo included [1] | Usage-based [7] | Included |

**Recommendation: Hetzner CX23 + Coolify.** Confirmed. 5x lower cost than the next option, only choice architecturally compatible with NestJS + future WebSockets + background workers, manageable operational overhead for 1-developer project with unattended-upgrades + Coolify automation.

### Backup to S3-compatible storage

**Cloudflare R2:** Free tier = 10 GB storage + 1M Class A ops + 10M Class B ops/month; $0.015/GB/month above; zero egress fees; S3-compatible [12].

**Backblaze B2:** $0.006/GB/month storage (cheapest per-GB); free egress via Cloudflare Bandwidth Alliance [13]; S3-compatible. No free tier.

**Hetzner Storage Box:** ~€3.62/mo for 100 GB HDD; SFTP/rsync/Samba (not S3-API); intra-DC transfers [1].

**Recommendation: Cloudflare R2.** Free tier (10 GB) covers Coolify config backups + small DB dumps at v1. Zero egress means no surprise costs when restoring. S3-compatible (rclone, restic). When/if 10 GB outgrown, $0.015/GB still cheaper than AWS S3.

### Uptime Kuma resource check

Uptime Kuma with ~20 monitors uses ~80 MB RAM [11]. CX23 has 4 GB total. v1 estimate:
- Coolify daemon + Traefik: ~300 MB
- NestJS process: ~200–400 MB
- Uptime Kuma (Docker): ~100 MB
- OS + headroom: ~500 MB
- **Total: ~1.1–1.3 GB used; ~2.7 GB headroom**

Uptime Kuma on the same box is viable. Run as a Coolify-managed Docker container alongside the API.

---

## R2 — Supabase Keep-Alive Cron

### Does an anon-key REST ping reset the inactivity counter?

Supabase pauses projects after 7 days of inactivity. Community consensus across multiple guides (2024–2026) confirms HTTP requests to the REST API — including with the anon key — count as activity and reset the timer [14][15][16]. Supabase's docs do not explicitly enumerate what counts as activity; the community pattern of hitting `/rest/v1/` with the anon key is well-documented and reported to work. **Caveat:** if Supabase changes the definition of "activity" internally, this approach may silently stop working — monitor for unexpected pauses.

### Failure modes

1. **GitHub Actions 60-day pause:** GitHub auto-disables scheduled workflows if the repo has no commits for 60 days [17]. Mitigate with `gautamkrishnar/keepalive-workflow@v2` (creates a dummy commit or uses GitHub API to keep the repo active before the 60-day threshold; default 50 days) [18].

2. **Supabase project deleted/suspended by Supabase staff:** Free tier projects can be deleted after extended inactivity beyond pausing. The REST ping should prevent this.

3. **Workflow silently succeeds but Supabase pauses anyway:** The anon key ping returns HTTP 200 even if the project is degraded. Add a step that checks the response body, not just the HTTP status.

4. **Secrets rotation:** Anon key is long-lived and low-risk (read-only public scope), but should be a GitHub Actions secret (`SUPABASE_URL` + `SUPABASE_ANON_KEY`), not hardcoded.

### Recommendation: ping a single lightweight endpoint

`GET /rest/v1/` with the anon key returns a 200 or recognizable error without reading actual data. Simplest option that counts as activity. An auth round-trip is unnecessary and risks hitting auth rate limits [19].

### Minimal keep-alive workflow YAML

```yaml
# .github/workflows/keep-alive.yml
name: Supabase keep-alive

on:
  schedule:
    - cron: '0 8 */3 * *'   # every 3 days at 08:00 UTC — well within the 7-day window
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

# Companion: gautamkrishnar/keepalive-workflow@v2 in a separate weekly job
# OR ensure main branch sees a commit at least once every 50 days.
```

HTTP 404 from `/rest/v1/` is acceptable (project alive, endpoint returns "not found"). Only 5xx or connection refusal indicates a paused project.

---

## R3 — GitHub Actions Caching for pnpm 10 + Turborepo

### Current best-practice combination (2026)

The canonical pattern [20][21]:
1. `pnpm/action-setup@v4` — installs pnpm (specify `version: '10.x'`); set `run_install: false`
2. Get the pnpm store path via `pnpm store path --silent`
3. `actions/cache@v4` keyed on `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`
4. `actions/setup-node@v4` with `node-version: '22'` (do NOT use `cache: 'pnpm'` here if you're using pnpm/action-setup separately)
5. `pnpm install --frozen-lockfile`

### Cache key strategy

```
${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
```

Restore keys:
```
${{ runner.os }}-pnpm-store-
```

### Turborepo remote cache recommendation

**Use Vercel Remote Cache (free for individual accounts).** [22][23]

- Free on all Vercel plans, even if frontend is not hosted on Vercel [22]
- Zero infrastructure: configure `TURBO_TOKEN` + `TURBO_TEAM` (team slug) as GitHub Actions secrets
- Cache key is content-hash based — lockfile changes automatically invalidate affected task outputs
- Alternative `ducktors/turborepo-remote-cache` (self-hosted, S3-backed) is unnecessarily complex for 1 developer

**Performance estimate:**
- Cold (no caches): pnpm install ~90s, turbo build ~3–4min → total ~5–7min
- Warm (pnpm store cached, turbo remote hit): pnpm install ~15s, turbo build ~30s → total ~1–2min

The ≤5 min warm / ≤10 min cold targets from the spec are achievable.

### Sample `ci.yml` job snippet

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: '10.x'
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint + typecheck + test + build
        run: pnpm turbo lint typecheck test build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

---

## R4 — next-intl App Router Setup (2026 Pattern)

### Current stable version

next-intl v4.9.1 (~April 2026) [24]. Compatible with Next.js 15 and 16 App Router [24][25].

### Middleware vs `[locale]` segment

Both are used in combination:
- `[locale]` dynamic segment under `app/` (e.g., `app/[locale]/page.tsx`) scopes all routes
- Middleware (`middleware.ts`) handles locale detection and redirect logic
- `i18n/request.ts` handles server-side message loading

These are not alternatives; they work together [26][27].

### `i18n/request.ts` shape

```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

### Routing config (`i18n/routing.ts`)

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed',   // '/' renders es, '/en/' renders en
});
```

### Locale prefix recommendation: `as-needed`

With `localePrefix: 'as-needed'`, Spanish (default) renders at `/` without redirect. English renders at `/en/`. Correct for a product where Spanish is the default. A redirect from `/` to `/es` adds a round-trip and is unnecessary [28].

**Known issue:** next-intl's `redirect()` function may not respect `as-needed` in all cases when called from within a page — use Next.js's native `redirect()` for programmatic redirects and let middleware handle locale routing [29].

### Type-checking translation keys

next-intl v4 supports TypeScript augmentation via the `AppConfig` interface. After `next build` or `next typegen`, a declaration file is generated that causes `t('missing.key')` to produce a TypeScript error.

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: './messages/es.json'
  }
});
```

`t('home.title')` fails at build time if `home.title` is absent from the Spanish base messages file [30].

### Server vs Client Component split

- **Async Server Components:** `getTranslations` from `next-intl/server` (awaitable)
- **Non-async Server Components / Client Components:** `useTranslations` hook
- **Server Actions:** `getTranslations` from `next-intl/server`
- **Client Components:** receive locale and messages via `NextIntlClientProvider` in the layout [27][31]

Idiomatic split: load all translations server-side in layout; pass minimum necessary namespace to `NextIntlClientProvider`.

### Known compatibility issues

- next-intl v4 dropped support for Next.js <14 App Router patterns
- `proxy.ts` rename (middleware.ts → proxy.ts in Next.js 16) is upcoming but not yet required for Next.js 15 [26]
- No known breaking incompatibilities with Next.js 15.x stable + next-intl 4.9.x

---

## R5 — CSP Headers in Next.js App Router with next-intl

### Where to set CSP: middleware is the correct choice

**Recommendation: Next.js middleware (`middleware.ts`).** [32][33]

Rationale:
- `next.config.ts` `headers()` is static — cannot generate per-request nonce. Without a nonce, you must use `'unsafe-inline'` for scripts.
- Middleware runs on every request and can generate a fresh nonce per request, set it as an `x-nonce` header (read by Server Components via `headers()`), and embed it in the `Content-Security-Policy` header simultaneously.
- Vercel `vercel.json` headers are also static — same limitation.
- Middleware is the only option that supports dynamic nonces AND runs before the page renders.

**Tradeoff:** Using a nonce forces all pages to be dynamically rendered (no static export). For this project (auth-required studio app), every page is already dynamic — not a concern.

### Nonce strategy with middleware and next-intl

Combine both in a single `middleware.ts`:

```typescript
// middleware.ts (illustrative)
import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCsp(nonce);

  // Run next-intl locale detection first; may return a redirect
  const response = intlMiddleware(request);

  // Whether redirect or normal, attach CSP and nonce headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);
  return response;
}
```

Nonces survive locale redirects: when next-intl issues a 307, the destination request goes through middleware again and gets a new nonce. Each page load gets its own nonce. No continuity issue [34].

### Starter CSP policy string

```
default-src 'self';
script-src 'self' 'nonce-NONCE_PLACEHOLDER' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

Notes:
- `style-src 'unsafe-inline'`: Tailwind injects inline styles for JIT. Hash-based approach is complex; `'unsafe-inline'` is the pragmatic v1 tradeoff [35].
- `script-src 'strict-dynamic'`: allows scripts loaded by a nonced script to run; removes need to whitelist individual CDN origins.
- `connect-src https://*.supabase.co wss://*.supabase.co`: covers Supabase REST + realtime WebSocket origins.
- `https://vercel.live`: needed for Vercel preview deployment toolbar.
- `'unsafe-eval'` is explicitly absent.
- `frame-ancestors` not needed at v1.

### Pitfalls with next-intl locale redirects

1. CSP header in a redirect response is irrelevant — browser doesn't use it. Subsequent request gets fresh nonce. No issue [34].
2. Do not set the nonce in a cookie — exposes it and defeats its purpose.
3. Configure middleware `matcher` to exclude `/_next/static/`, `/_next/image`, `/favicon.ico` to avoid unnecessary nonce generation [32].

---

## R6 — Supabase CLI + RLS Testing in CI

### Can `supabase db reset` run in GitHub Actions?

Yes. The Supabase CLI uses Docker to spin up a local Postgres + Auth + Storage stack. GitHub Actions `ubuntu-latest` runners include Docker Engine, so `supabase start` works without additional setup [36][37].

The official `supabase/setup-cli@v1` action handles CLI installation. Minimal CI job:

```yaml
- uses: supabase/setup-cli@v1
  with:
    version: latest
- run: supabase start
- run: supabase test db
```

`supabase db reset` applies migrations and seed data before tests. `supabase test db` runs all SQL files in `supabase/tests/*.sql` via pgTAP.

### RLS test strategy recommendation: pgTAP via `supabase test db`

**Recommended: pgTAP tests via `supabase test db`.** [36][38]

Rationale:
- pgTAP tests run inside Postgres — eliminates network layer; tests policies at the exact enforcement point
- `supabase test db` is the official Supabase-supported testing path
- pgTAP's `set_config` / `set role` allows impersonating any user role (anon, authenticated, service_role) within the same test transaction
- Vitest + Supabase JS client tests are integration tests (valuable) but test behavior, not policies directly — add later for E2E coverage, not as a substitute for pgTAP

### Sample RLS policy test pattern (architect's template for ADR-0003)

```sql
-- supabase/tests/rls_studios_test.sql
BEGIN;
SELECT plan(4);

-- Arrange: create test data as service_role (bypasses RLS)
INSERT INTO studios (id, owner_id, name)
VALUES
  ('11111111-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Studio A'),
  ('22222222-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Studio B');

-- Test 1: anon cannot read studios
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM studios $$,
  'anon: cannot read any studios'
);

-- Test 2: authenticated owner can read their own studio
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000000", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT name FROM studios WHERE owner_id = auth.uid() $$,
  ARRAY['Studio A'],
  'authenticated owner: can read own studio'
);

-- Test 3: authenticated owner cannot read another owner's studio
SELECT is_empty(
  $$ SELECT * FROM studios WHERE owner_id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  'authenticated owner: cannot read other studios'
);

-- Test 4: anon cannot insert
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO studios (owner_id, name) VALUES (gen_random_uuid(), 'Evil Studio') $$,
  'new row violates row-level security policy for table "studios"',
  'anon: cannot insert studios'
);

SELECT * FROM finish();
ROLLBACK;
```

Convention: each table gets `rls_<table>_test.sql` with at minimum: (1) anon read blocked, (2) owner read allowed, (3) cross-owner read blocked, (4) anon write blocked [38][39].

### Performance estimate

- `supabase start` cold boot: 30–60s on `ubuntu-latest` (cached on subsequent runs via `actions/cache` for Docker layers) [37]
- 10–20 pgTAP assertions: 1–5s
- Full RLS test job: ~45–75s total — well within 90s target

**Recommendation:** Run RLS tests on every push (cheap; schema migrations must never break policies). If suite grows beyond ~200 tests and approaches 3–4 min, split by domain (studios, bookings, therapists) and run in parallel matrix jobs.

---

## Citations

1. Hetzner CX23 pricing — https://www.hetzner.com/cloud — accessed 2026-04-26; corroborated by https://costgoat.com/pricing/hetzner
2. Coolify docs (applications, CI/CD, rolling updates) — https://coolify.io/docs/applications/ — accessed 2026-04-26
3. Render Starter plan pricing — https://render.com/pricing — accessed 2026-04-26; corroborated by https://kuberns.com/blogs/render-pricing/
4. Hetzner latency from Americas — https://hetzner-latency.sliplane.io/ and https://www.openstatus.dev/blog/global-latency-monitoring-benchmark-hono-hetzner — accessed 2026-04-26 (no Tulum-specific data; estimate based on MX→EU baseline)
5. Coolify rolling updates — https://coolify.io/docs/knowledge-base/rolling-updates — accessed 2026-04-26
6. Coolify rollback discussion — https://github.com/coollabsio/coolify/discussions/1667 — accessed 2026-04-26
7. Vercel pricing 2026 — https://vercel.com/pricing — accessed 2026-04-26
8. Vercel WebSocket incompatibility — https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections — accessed 2026-04-26
9. Vercel function duration limits — https://vercel.com/docs/functions/configuring-functions/duration — accessed 2026-04-26
10. NestJS serverless FAQ — https://docs.nestjs.com/faq/serverless — accessed 2026-04-26
11. Uptime Kuma resource usage — https://github.com/louislam/uptime-kuma/issues/3817 — accessed 2026-04-26
12. Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/ — accessed 2026-04-26
13. Backblaze B2 pricing — https://www.backblaze.com/cloud-storage/pricing — accessed 2026-04-26
14. Supabase keep-alive via REST — https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel — accessed 2026-04-26
15. Supabase pause prevention guide (2026) — https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263 — accessed 2026-04-26
16. George McCarron — preventing Supabase pausing — https://www.georgemccarron.com/blog/preventing-supabase-pausing — accessed 2026-04-26
17. GitHub Actions scheduled workflow disable — https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow — accessed 2026-04-26
18. Keepalive Workflow GitHub Action — https://github.com/marketplace/actions/keepalive-workflow — accessed 2026-04-26
19. Supabase Auth rate limits — https://supabase.com/docs/guides/auth/rate-limits — accessed 2026-04-26
20. pnpm GitHub Actions CI docs — https://pnpm.io/continuous-integration — accessed 2026-04-26
21. pnpm/action-setup — https://github.com/pnpm/action-setup — accessed 2026-04-26
22. Turborepo remote cache (Vercel free) — https://turborepo.dev/blog/free-vercel-remote-cache — accessed 2026-04-26
23. Turborepo remote caching docs — https://turborepo.dev/docs/core-concepts/remote-caching — accessed 2026-04-26
24. next-intl npm — https://www.npmjs.com/package/next-intl — accessed 2026-04-26 (v4.9.1 current)
25. next-intl releases — https://github.com/amannn/next-intl/releases — accessed 2026-04-26
26. next-intl App Router getting started — https://next-intl.dev/docs/getting-started/app-router — accessed 2026-04-26
27. next-intl Server/Client Components — https://next-intl.dev/docs/environments/server-client-components — accessed 2026-04-26
28. next-intl routing configuration (localePrefix) — https://next-intl.dev/docs/routing/configuration — accessed 2026-04-26
29. next-intl redirect as-needed issue — https://github.com/amannn/next-intl/issues/1845 — accessed 2026-04-26
30. next-intl TypeScript augmentation — https://next-intl.dev/docs/workflows/typescript — accessed 2026-04-26
31. next-intl request config — https://next-intl.dev/docs/usage/configuration — accessed 2026-04-26
32. Next.js CSP guide — https://nextjs.org/docs/app/guides/content-security-policy — accessed 2026-04-26
33. CSP nonce + Next.js middleware — https://centralcsp.com/articles/how-to-setup-nonce-with-nextjs — accessed 2026-04-26
34. next-intl CSP discussion — https://github.com/amannn/next-intl/discussions/682 — accessed 2026-04-26
35. Tailwind + CSP inline styles tradeoff — https://github.com/vercel/next.js/discussions/81703 — accessed 2026-04-26
36. Supabase automated testing GitHub Actions — https://supabase.com/docs/guides/deployment/ci/testing — accessed 2026-04-26
37. Supabase setup-cli GitHub Action — https://github.com/supabase/setup-cli — accessed 2026-04-26
38. pgTAP Supabase testing guide — https://usebasejump.com/blog/testing-on-supabase-with-pgtap — accessed 2026-04-26
39. Testing RLS with pgTAP (Medium) — https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602 — accessed 2026-04-26
