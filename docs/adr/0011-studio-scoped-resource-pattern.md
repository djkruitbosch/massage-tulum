# ADR 0011: Studio-Scoped Resource Pattern

**Status:** Accepted
**Date:** 2026-05-07
**Author:** architect (agent)
**Context tickets:** CU-869d29f86 (PR #86 — StudioResolverService extraction)

## Context

By the time the Therapist Roster module was implemented, three distinct NestJS domain services (`StudiosService`, `StudiosProfileService`, and `TherapistsService`) each needed to answer the same question: "Given an authenticated user (identified by their JWT `sub` claim), which studio do they own?" Each service had independently written an ad-hoc `studio_profiles` lookup — a pattern that was diverging and accumulating subtle differences in error semantics.

PR #86 extracted this lookup into a shared `StudioResolverService` in `apps/api/src/common/services/`. The extraction was described in the PR body as implementing "ADR-0013", but no ADR with that number existed. This ADR retroactively documents the decision made in PR #86 as the canonical pattern for all studio-scoped NestJS modules, including the Service Catalog module designed in CU-869d29f21.

Forces at play:

- Every studio-owner-facing endpoint must resolve `studio_id` from the authenticated user's identity before performing any DB operation. The studio_id is not accepted from the request body — it is always derived server-side from the JWT to prevent a user from operating on another studio's data.
- The `studio_profiles` table maps `auth.uid()` → `studio_id`. The lookup uses the service-role Supabase client because it must happen before a user-scoped client can be constructed for subsequent DB operations.
- RLS on `studio_profiles` is the authorization gate for data access, but the resolver itself needs to run before RLS can be applied — hence service-role for this one lookup only.
- Error semantics matter: if no `studio_profiles` row exists for the user, the correct response is `404 Not Found` (the studio does not exist for this user), not `403 Forbidden` (the user is known but lacks permission) and not `401 Unauthorized` (the user is not authenticated).

## Decision

### The resolver pattern

A shared `StudioResolverService` (at `apps/api/src/common/services/studio-resolver.service.ts`) exposes a single method:

```typescript
async resolveStudioId(userId: string): Promise<string>
```

It queries `studio_profiles` using the **service-role Supabase client** and returns the `studio_id` UUID. If no row is found, it throws `NotFoundException('Studio not found for this user')`.

The service-role client is justified for this one lookup because:
1. The user has already been authenticated by `SupabaseJwtGuard` before this method is called.
2. The lookup is read-only and is scoped to the exact `userId` from the verified JWT.
3. The result (`studio_id`) is used only to construct subsequent user-scoped queries — it is never returned to the caller.

### Module structure

`StudioResolverModule` (at `apps/api/src/common/services/studio-resolver.module.ts`) provides and exports `StudioResolverService`. Any domain module that needs `StudioResolverService` imports `StudioResolverModule` explicitly. There is no monolithic `CommonModule` — imports are kept explicit to make dependency graphs visible.

### Error semantics standardized by this pattern

| Situation | Exception to throw | HTTP status |
|---|---|---|
| JWT missing or invalid | `UnauthorizedException` (thrown by `SupabaseJwtGuard`) | 401 |
| JWT valid but no `studio_profiles` row | `NotFoundException('Studio not found for this user')` — thrown by `resolveStudioId` | 404 |
| Resource exists but belongs to a different studio | RLS silently returns 0 rows → service throws `NotFoundException('Resource not found')` | 404 |

The third case deliberately returns 404 instead of 403 to avoid information leakage — a caller should not learn that a resource exists but belongs to another studio. The RLS layer enforces the actual access control; the 404 is the API surface.

`ForbiddenException` (403) is reserved for authenticated users attempting operations that are structurally forbidden for their role (e.g., a therapist attempting a write in a future v2 scenario). It is not used for cross-studio resource access.

### When to use StudioResolverService

Use `StudioResolverService.resolveStudioId(userId)` in any NestJS service method that:
1. Requires knowing which studio the authenticated user owns.
2. Must construct a user-scoped Supabase client for subsequent DB operations that are subject to RLS.

Do **not** use `resolveStudioId` for:
- Admin endpoints (they bypass studio ownership entirely).
- Public endpoints (no user identity available).
- Endpoints where the studio_id is already derivable from a verified resource (e.g., a second lookup within the same request that already resolved studio_id).

### Consumption pattern for new studio-scoped modules

```typescript
// In a new domain service constructor:
constructor(private readonly studioResolver: StudioResolverService) {}

// In each service method:
async someMethod(userId: string, jwt: string, ...): Promise<SomeDto> {
  const studioId = await this.studioResolver.resolveStudioId(userId);
  const userClient = this.buildUserClient(jwt);  // anon key + JWT; RLS applies
  // ... perform DB operations scoped to studioId via userClient
}
```

The `buildUserClient(jwt)` helper constructs a Supabase client with the anon key and `Authorization: Bearer <jwt>` header. RLS policies on the target table enforce ownership via the same `studio_profiles` join used in every existing policy.

### Extensibility hook (therapist read access, v2+)

The spec notes that therapists will gain read access to some resources in v2+. When that happens, a second resolver may be needed — e.g., `TherapistResolverService` that maps a therapist's `auth.uid()` to their `studio_id` via a `therapist_profiles` table. The `StudioResolverService` pattern is the template for that future resolver. Do not modify `StudioResolverService` to handle therapist identity — add a parallel service.

## Consequences

- **Positive:**
  - Single canonical location for the `userId → studio_id` lookup. All domain services share the same implementation and the same error semantics.
  - New studio-scoped modules (Service Catalog, Availability, etc.) can be implemented without re-deriving the ownership pattern.
  - Error semantics (404 for missing studio, 404 for cross-studio resource access) are now explicit and consistent.
  - Service-role use is confined to one place and one purpose, making it easy to audit.

- **Negative:**
  - Every new domain module must import `StudioResolverModule` explicitly. This is intentional (explicitness over magic) but adds a minor boilerplate cost.
  - The service-role client is used for the `studio_profiles` lookup, which bypasses RLS for that one read. The constraint (scoped to exactly `userId` from the verified JWT) makes this safe, but it must be preserved — future changes to `resolveStudioId` must not expand the scope of the service-role query.

- **Neutral / follow-up work:**
  - This ADR retroactively documents PR #86. No code changes are needed.
  - The `therapist-roster` architecture doc references "ADR-0013" (aspirational, never written). That reference should be understood as pointing to this ADR (0011). The migration comment in `20260503000008_create_therapists.sql` references `docs/adr/0013-studio-scoped-resource-pattern.md` — this is a stale reference. A future cleanup migration comment can update it, but no functional change is required.
  - When a v2 feature introduces a second resolver (e.g., for therapists), the pattern established here should be followed and a new ADR written documenting the second resolver's design.

## Alternatives considered

**Inline `studio_profiles` lookup in each service.** The pre-PR-#86 approach. Rejected because it led to three slightly different implementations with no shared test coverage and inconsistent error messages. Centralization is the correct choice once the pattern appears three times.

**`CommonModule` with all shared providers.** A single `CommonModule` exporting everything. Rejected because it creates an opaque dependency bag — every module that imports `CommonModule` pulls in all shared providers even if it needs only one. Explicit per-service modules (`StudioResolverModule`) keep the dependency graph readable.

**RLS-based ownership check without service-layer resolver.** Use the user-scoped client directly and rely on RLS to filter results. The problem: to construct the user-scoped client for query A, we may need `studio_id` for the `WHERE` clause — which requires a prior lookup. Some queries (e.g., `INSERT`) need the `studio_id` explicitly in the payload. The resolver provides it cleanly.

## Implementation notes

- Files implementing this pattern:
  - `apps/api/src/common/services/studio-resolver.service.ts`
  - `apps/api/src/common/services/studio-resolver.module.ts`
- Merged via PR #86 on or around 2026-05-07.
- All new studio-scoped domain modules (starting with `services/` for CU-869d29f21) must import `StudioResolverModule` and inject `StudioResolverService`. See `apps/api/src/therapists/therapists.module.ts` for the reference consumption pattern.
- Testing: unit tests for new domain services should mock `StudioResolverService.resolveStudioId`. The integration test for `StudioResolverService` itself (querying `studio_profiles`) is covered by the pgTAP RLS tests and by any service-level spec file that exercises the full flow.
