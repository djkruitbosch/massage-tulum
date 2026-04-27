# ADR 0003: RLS Baseline Conventions

**Status:** Accepted
**Date:** 2026-04-26
**Author:** architect (agent)
**Context tickets:** CU-869d29f0x

## Context

Row Level Security (RLS) is the primary authorization mechanism for all data stored in Supabase Postgres. `CLAUDE.md` states: "RLS on every Supabase table. Period." The risk is that a developer creates a table and forgets to enable RLS, leaving data accessible to any authenticated user (or even the anon role) via the Supabase REST or GraphQL API.

There are two failure modes:
1. A table is created without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` — all rows are readable/writable by any role.
2. RLS is enabled but no policies are added — all rows are blocked from all roles including authenticated owners (silent data loss from the user's perspective).

Both must be detected before code reaches production. CI is the enforcement point.

## Decision

### Convention 1: RLS enabled in the same migration that creates the table

Every migration that contains `CREATE TABLE public.<name>` must also contain, in the same file:

```sql
ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;
```

This is non-negotiable. There is no grace period. The migration will be rejected in CI if the RLS enablement is missing (see Convention 2).

At minimum, a DENY-ALL fallback policy must also be included so that enabling RLS does not silently block all operations:

```sql
-- Deny all by default; specific policies below grant access
-- (No explicit DENY policy needed — RLS ENABLED with no matching ALLOW policies denies by default)
-- Document the intended policies here, even if stubbed, so reviewers can verify correctness.
```

### Convention 2: CI enforces zero tables without RLS

A pgTAP assertion runs on every CI push as part of the RLS test job:

```sql
-- supabase/tests/rls_baseline_test.sql
BEGIN;
SELECT plan(1);

SELECT is(
  (SELECT count(*)::int FROM pg_tables
   WHERE schemaname = 'public'
     AND rowsecurity = false),
  0,
  'All public tables must have RLS enabled'
);

SELECT * FROM finish();
ROLLBACK;
```

CI failure on this assertion means a migration was merged without enabling RLS. The developer must fix it in a new additive migration (not by editing the original — see ADR-0002 migration discipline).

### Convention 3: Per-table test file

Every table gets a dedicated test file at:

```
supabase/tests/rls_<table>_test.sql
```

Minimum 4 test cases per table:

| Case | Description |
|---|---|
| anon-read-blocked | `SET LOCAL role = anon;` — SELECT returns empty (or throws, depending on policy) |
| owner-read-allowed | Authenticated user with matching `auth.uid()` can SELECT their own rows |
| cross-owner-read-blocked | Authenticated user cannot SELECT rows owned by another user |
| anon-write-blocked | `SET LOCAL role = anon;` — INSERT/UPDATE/DELETE throws RLS violation |

The pgTAP pattern from the research report (R6) is the canonical template. Developer-be adapts it per table. Example:

```sql
-- supabase/tests/rls_<table>_test.sql
BEGIN;
SELECT plan(4);

-- Arrange: insert test data as service_role (bypasses RLS)
INSERT INTO public.<table> (id, owner_id, ...)
VALUES
  ('11111111-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', ...),
  ('22222222-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', ...);

-- Test 1: anon cannot read
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public.<table> $$,
  'anon: cannot read any rows'
);

-- Test 2: owner can read own rows
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000000", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT id FROM public.<table> WHERE owner_id = auth.uid() $$,
  ARRAY['11111111-0000-0000-0000-000000000000'::uuid],
  'authenticated owner: can read own rows'
);

-- Test 3: owner cannot read other owner's rows
SELECT is_empty(
  $$ SELECT * FROM public.<table> WHERE owner_id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  'authenticated owner: cannot read cross-owner rows'
);

-- Test 4: anon cannot insert
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO public.<table> (owner_id) VALUES (gen_random_uuid()) $$,
  'new row violates row-level security policy for table "<table>"',
  'anon: cannot insert'
);

SELECT * FROM finish();
ROLLBACK;
```

### Convention 4: Service role key bypass — permitted cases only

The service role key bypasses RLS by design. Its use is permitted only in:

- NestJS server-side admin scripts (e.g., seeding, data migrations)
- Future scheduled jobs running inside the Coolify-managed NestJS process
- CI seed data setup in test files (using `service_role` role context)

The service role key is **never** permitted in:
- Any code path that handles a user HTTP request (use the anon key + JWT for user context instead)
- Frontend code
- GitHub Actions (except keep-alive, which uses the anon key)

If a PR introduces service-role key usage in a request path, the reviewer agent must flag it as a blocking issue.

### Convention 5: Reviewer checklist

The reviewer agent (`docs/agents/reviewer.md`) must verify on every PR that adds a table:

- [ ] The migration file contains `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`
- [ ] At least one RLS policy is defined (ALLOW or explicit DENY)
- [ ] `supabase/tests/rls_<table>_test.sql` exists with the 4 minimum cases
- [ ] The baseline test (`rls_baseline_test.sql`) is not broken

This checklist is binding, not advisory.

## Consequences

- **Positive:**
  - Zero-tolerance for unprotected tables. Any miss is caught in CI before merge.
  - pgTAP tests run inside Postgres, at the exact enforcement layer — no network emulation.
  - Convention is self-documenting: each table's test file is the living spec for its access model.
  - Reviewer checklist makes the requirement visible to all agents handling PRs.

- **Negative:**
  - Adds ~10–20 lines of test SQL per new table. Acceptable overhead given the security baseline.
  - pgTAP has a learning curve. Mitigated by the canonical template above.
  - Service role restrictions mean some admin workflows require explicit design (e.g., a future admin panel needs careful role handling).

- **Neutral / follow-up work:**
  - Developer-be writes `supabase/tests/rls_baseline_test.sql` as part of the Supabase CLI scaffolding ticket.
  - The `_meta` placeholder table (described in the architecture repo-layout doc) gets its own `rls__meta_test.sql` as the first example.
  - As domain tables (studios, bookings, therapists) are added in subsequent features, each developer ticket includes "add RLS policy + test file" as a required deliverable.
  - The reviewer agent's system prompt should be updated to reference this ADR's checklist (human action after GATE 2).

## Alternatives considered

**Application-layer auth only (no RLS):** Rejected. The Supabase REST API is directly accessible to any client with the anon key. Without RLS, a JavaScript console call could read any row in any table. RLS is the only mechanism that protects data at the database layer, independent of application code bugs.

**RLS on all tables except internal/admin tables:** Rejected. "Internal" tables still contain data. If the service role key is leaked or a bug bypasses app-layer auth, unprotected tables are fully exposed. The CI check (`rowsecurity = false` must equal 0) ensures no exceptions slip through.

**Vitest + Supabase JS client for RLS tests instead of pgTAP:** Not used as primary. Integration tests via Supabase JS are valuable and will be added in later sprints. They test behavior but not policies at the enforcement layer. pgTAP tests policies at the database level where they are enforced. Both complement each other; pgTAP is the mandatory baseline.

## Implementation notes

- `supabase/tests/` directory is created in the Supabase CLI scaffolding ticket (developer-be).
- `supabase/tests/rls_baseline_test.sql` is the first file to commit — it catches everything.
- CI runs `supabase test db` which applies migrations + seed + runs all `*.sql` files in `supabase/tests/`. See ADR-0004 for the CI job structure.
- The placeholder `_meta` table migration (also in the scaffolding ticket) demonstrates the full pattern: CREATE TABLE → ENABLE ROW LEVEL SECURITY → CREATE POLICY → test file.
- pgTAP is bundled with the Supabase local Docker stack — no additional install needed.

## References

36. Supabase automated testing GitHub Actions — https://supabase.com/docs/guides/deployment/ci/testing
38. pgTAP Supabase testing guide — https://usebasejump.com/blog/testing-on-supabase-with-pgtap
39. Testing RLS with pgTAP — https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602
