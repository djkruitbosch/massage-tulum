# ADR 0012: Asymmetric JWT verification for Supabase access tokens

**Status:** Accepted
**Date:** 2026-05-17
**Author:** worker-03 (agent), confirmed by project owner
**Context tickets:** none (fix-forward for production auth outage)
**Supersedes (in part):** ADR-0007 §"Security posture" — the HS256/symmetric verification assumption

## Context

Supabase migrated its access-token signing model to **asymmetric keys** (ES256 / RS256) for new and migrated projects during 2024. The legacy symmetric "JWT Secret" (HS256) still exists in the dashboard for backwards compatibility, but the access tokens returned by `supabase.auth.signInWithOtp()` and similar flows are now signed with the project's asymmetric private key. The matching public key is published at the project's JWKS endpoint:

```
${SUPABASE_URL}/auth/v1/.well-known/jwks.json
```

The original NestJS guard (per the implicit defaults from ADR-0007) used `jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] })` with `SUPABASE_JWT_SECRET`. This rejects every token on a project using asymmetric signing, regardless of which "JWT Secret" value is configured, because the token was never signed with that secret.

The symptom in production was:
- `GET https://api.massage-tulum.dirk-jan.com/api/studios/profile` returned `401 "Invalid or expired token"` for every authenticated request.
- The frontend interpreted this as "user is unauthenticated" and redirected to `/login`, which the middleware then bounced back to `/dashboard` (since the Supabase session cookies were still valid). Net effect: clicking "Studio profile" landed the user back on `/dashboard` and the protected pages were unreachable.
- Decoding the access token header showed `{"alg": "ES256", "kid": "<uuid>"}` — confirming the asymmetric flow was in use.

## Decision

Replace the `jsonwebtoken` + `SUPABASE_JWT_SECRET` (HS256) verification with `jose` + the project's remote JWKS:

1. **Library:** `jose@^5`. Maintained, audited, dual ESM/CJS so it loads under both NestJS runtime and ts-jest. Native `createRemoteJWKSet` with built-in cache and cooldown.
2. **Key resolution:** `createRemoteJWKSet(new URL(${SUPABASE_URL}/auth/v1/.well-known/jwks.json))`. jose caches the JWKS in memory (default 10-minute TTL, 30-second cooldown). The token header's `kid` selects the right key. On `kid` rotation, jose refreshes automatically once cooldown elapses.
3. **Algorithms accepted:** `['ES256', 'RS256']`. Supabase rolled out ES256 first; RS256 is supported in the same JWKS for legacy compatibility. HS256 is **not** accepted — symmetric verification is no longer the supported posture for hosted Supabase auth.
4. **Claim validation:** verify `iss === ${SUPABASE_URL}/auth/v1` and `aud === 'authenticated'` in the same `jwtVerify()` call. Both were previously accepted implicitly; making them explicit closes a confused-deputy hole (token from a different Supabase project, or a service-role token, would have verified under HS256).
5. **Environment variable change:** `SUPABASE_JWT_SECRET` is **dropped** from the API's required env. `SUPABASE_URL` (already required for the Supabase service client) now does double duty as both API base and JWT issuer. Removing the secret reduces blast radius.

## Consequences

### Positive

- The guard works on Supabase's current security posture without manual key configuration.
- One fewer secret to manage (`SUPABASE_JWT_SECRET` deleted from Coolify, Vercel, and `.env.example`).
- `iss` / `aud` validation closes a class of token-confusion attacks that the symmetric path admitted.
- Aligned with Supabase's documented direction; rolling the asymmetric key in Supabase no longer requires a redeploy here.

### Negative

- Cold-start of a NestJS instance now triggers one outbound HTTPS request to the Supabase JWKS endpoint on the first protected request. The latency cost is paid once per worker process, then amortised across all subsequent verifications.
- A network partition between the API host and `*.supabase.co` would break authentication. jose's cache mitigates this within the cache TTL; full Supabase outage would also break the frontend itself, so this is acceptable coupling.
- ts-jest in CommonJS mode cannot transform jose 6 (ESM-only). The project is pinned to jose 5 (dual ESM/CJS) until the API workspace migrates to native ESM or a different test transformer.

### Rejected alternatives

- **Toggle Supabase project back to legacy HS256 + keep current code.** Possible via dashboard. Rejected: opts out of the recommended security posture, and re-migrating later costs more than fixing now.
- **Manually fetch JWKS and verify with `jsonwebtoken` + `jwks-rsa`.** Works but pulls two libraries where one suffices, and the callback-based `getKey` API is awkward inside a NestJS guard.
- **Accept both HS256 and asymmetric in parallel.** Adds complexity for no benefit — the project is on asymmetric; there is no scenario where an HS256 Supabase token would also need to verify.

## Deployment

After this PR merges and the API redeploys:

1. **Drop** `SUPABASE_JWT_SECRET` from the Coolify env vars for the NestJS app (cosmetic; the guard no longer reads it).
2. **Confirm** `SUPABASE_URL` is set to `https://<project-ref>.supabase.co` (no trailing slash, no `/auth/v1` suffix).
3. **Sanity check:** `curl -s ${API}/api/studios/profile -H "Authorization: Bearer foo"` should return `"Invalid or expired token"` (signature rejection) — confirming JWKS fetch is wired. Then authenticated requests through the frontend should succeed.

No frontend changes required; the frontend already forwards the asymmetric token from the Supabase session cookie.

## References

- Supabase asymmetric JWT migration announcement (2024)
- `apps/api/src/common/guards/supabase-jwt.guard.ts`
- `apps/api/src/common/guards/__tests__/supabase-jwt.guard.spec.ts`
- ADR-0007 — Supabase Auth — Magic Link (Email OTP) Only
