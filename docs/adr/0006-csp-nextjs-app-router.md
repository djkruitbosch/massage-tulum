# ADR 0006: Content Security Policy for Next.js App Router

**Status:** Accepted
**Date:** 2026-04-26
**Author:** architect (agent)
**Context tickets:** CU-869d29f0x

## Context

The Next.js frontend (`apps/web`) must serve a Content Security Policy header from day one (`CLAUDE.md` security baseline). The App Router's architecture presents two placement options for CSP headers: `next.config.ts` headers configuration, and middleware (`middleware.ts`).

The project also uses next-intl v4, which requires its own middleware for locale detection and routing. Combining two middleware concerns into one file is necessary because Next.js supports only one `middleware.ts` export.

Additional constraints:
- Tailwind CSS injects inline styles (JIT mode). This affects the `style-src` directive.
- Supabase clients need access to REST (`https://*.supabase.co`) and Realtime WebSocket (`wss://*.supabase.co`) origins.
- Vercel preview deployments use a toolbar injected at `vercel.live`.
- A nonce is the preferred mechanism for `script-src` in Next.js App Router to avoid `'unsafe-inline'` on scripts.
- Auth-required pages are already dynamic (no static export benefit lost by using nonces).

## Decision

**Set CSP via Next.js middleware (`middleware.ts`) using a per-request nonce. Combine with the next-intl middleware in a single middleware function.**

### Why middleware, not `next.config.ts`

`next.config.ts` `headers()` is evaluated at build time and produces static header strings. A static `script-src` without a nonce requires `'unsafe-inline'`, which defeats XSS protection entirely. Middleware runs on every request and can generate a fresh cryptographic nonce per request, set it as both the `x-nonce` response header (readable by Server Components via `headers()`) and embed it in the `Content-Security-Policy` header simultaneously. [32][33]

### Nonce strategy

1. Middleware generates a nonce per request: `Buffer.from(crypto.randomUUID()).toString('base64')`
2. Nonce is set on `x-nonce` response header (so Server Components can read it from `headers()` to inject into `<script>` tags)
3. Nonce is embedded in the `Content-Security-Policy` header: `'nonce-<value>'`
4. next-intl middleware runs within the same function (locale detection first; CSP headers set on whatever response next-intl returns — redirect or normal)

When next-intl issues a locale redirect (307), the CSP header on the redirect response is not used by the browser. The subsequent request to the destination URL goes through middleware again and gets a fresh nonce. No continuity issue. [34]

### Combined middleware structure

Developer-fe implements this structure (not application code — this ADR specifies the architecture):

```typescript
// apps/web/middleware.ts  (illustrative shape — developer-fe writes the real file)
import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCsp(nonce);

  const response = intlMiddleware(request);      // handles locale detection + redirect

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static assets and image optimization
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### CSP policy

The policy below is the v1 baseline. It is implemented verbatim. Any change requires a PR with reviewer sign-off.

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

Where `NONCE_PLACEHOLDER` is replaced with the actual nonce value per request.

### Directive-by-directive rationale

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Catch-all fallback: only same-origin resources by default |
| `script-src` | `'self' 'nonce-<value>' 'strict-dynamic'` | Nonce-based script allowlisting; `'strict-dynamic'` propagates trust to scripts loaded by trusted scripts, removing the need to whitelist CDN origins. `'unsafe-inline'` is absent from script-src. |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind CSS JIT injects inline `<style>` tags that cannot be nonced. This is the explicit v1 tradeoff — see below. |
| `img-src` | `'self' data: blob: https:` | `data:` for inline base64 images; `blob:` for object URLs; `https:` permits any HTTPS image source (studio photos from Supabase Storage will be on a supabase.co CDN subdomain). |
| `font-src` | `'self'` | All fonts are self-hosted (no Google Fonts, no CDN). |
| `connect-src` | `'self' https://*.supabase.co wss://*.supabase.co https://vercel.live` | `https://*.supabase.co`: Supabase REST API and Auth API. `wss://*.supabase.co`: Supabase Realtime WebSocket (used for future real-time booking updates). `https://vercel.live`: Vercel preview deployment toolbar (injected in preview environments only). |
| `frame-src` | `'none'` | No iframes in the app. Prevents clickjacking via framing. |
| `object-src` | `'none'` | Disallows Flash, Silverlight, and other plugin content. |
| `base-uri` | `'self'` | Prevents `<base>` tag injection attacks that redirect relative URLs. |
| `form-action` | `'self'` | Form submissions go to same origin only. |
| `upgrade-insecure-requests` | (flag) | Instructs browsers to treat HTTP requests as HTTPS. Defense-in-depth for mixed content. |

### The `style-src 'unsafe-inline'` tradeoff

**The tradeoff:** `'unsafe-inline'` on `style-src` means an XSS payload could inject a `<style>` tag. This is a lower-severity risk than `'unsafe-inline'` on `script-src` because styles cannot exfiltrate data or execute code directly (though CSS injection attacks exist, e.g., CSS keylogger via attribute selectors — a niche vector).

**Why it is accepted at v1:** Tailwind's JIT compiler generates inline styles that cannot be hashed or nonced reliably in a Next.js App Router context without a complex CSS extraction pipeline. The cost of implementing hash-based style CSP is high relative to the risk reduction at v1 scale. [35]

**Conditions under which we revisit:** Post-launch, if security requirements tighten (e.g., a PCI-DSS scope expansion), investigate:
1. Extracting Tailwind output to a static CSS file and serving it as `'self'` (possible in Next.js with appropriate Tailwind configuration).
2. CSP Level 3 nonce-based styles (`style-src 'nonce-<value>'`) — requires Next.js to inject the nonce into every `<style>` tag, which is not natively supported.

### CSP report endpoint

No CSP report endpoint at v1. Reasons:
- Report-to requires a receiving endpoint that logs and surfaces violations. Building one adds scope.
- In dev, CSP violations are visible in the browser console.
- Post-launch, if violations need systematic monitoring, add a `report-uri` pointing to a service like Sentry's CSP reporting endpoint or a lightweight custom endpoint in the NestJS API (`POST /api/csp-report`).

The `report-uri` directive is reserved for a future ADR.

## Consequences

- **Positive:**
  - No `'unsafe-inline'` on `script-src` — the highest-value XSS mitigation is in place from day one.
  - `'strict-dynamic'` future-proofs the policy for scripts loaded dynamically.
  - Combined middleware means a single file manages both i18n and security headers — no execution ordering ambiguity.
  - `upgrade-insecure-requests` provides defense-in-depth against mixed content.

- **Negative:**
  - `'unsafe-inline'` on `style-src` is a known, accepted gap. Documented above.
  - All pages are dynamically rendered (nonces prevent static caching). For an auth-required studio management app, all pages are already dynamic — this is a non-issue at v1 but would matter for any future public/static marketing pages.
  - `vercel.live` in `connect-src` is only needed in preview environments. In production, this origin is unnecessary. A future improvement is to conditionally include it based on `VERCEL_ENV` environment variable. Not implemented at v1 for simplicity.

- **Neutral / follow-up work:**
  - Developer-fe implements the combined middleware and the `buildCsp(nonce)` helper function.
  - Server Components that render inline `<script>` tags (e.g., analytics snippets in future sprints) must read the `x-nonce` header via Next.js `headers()` and apply it to the script tag.
  - CSP report endpoint: add to the NestJS API in a post-launch sprint.
  - Revisit `style-src 'unsafe-inline'` when Tailwind extraction or CSP Level 3 becomes practical.

## Alternatives considered

**`next.config.ts` static headers:** Rejected. Cannot generate per-request nonces. Requires `'unsafe-inline'` on `script-src`, negating the primary XSS protection CSP provides. [32]

**Vercel `vercel.json` headers:** Rejected. Same limitation as `next.config.ts` — static strings. Additionally, using `vercel.json` couples CSP configuration to Vercel's deployment infrastructure, making it harder to replicate in other environments.

**Two separate middleware functions (next-intl `proxy` pattern):** Rejected. Next.js 15 supports only one `middleware.ts` export. The combined-function pattern is the officially documented approach for combining next-intl with other middleware logic. [26][34]

**No CSP at v1:** Rejected. `CLAUDE.md` explicitly requires CSP headers from day one. This is a hard security baseline requirement.

## References

26. next-intl App Router getting started — https://next-intl.dev/docs/getting-started/app-router
32. Next.js CSP guide — https://nextjs.org/docs/app/guides/content-security-policy
33. CSP nonce + Next.js middleware — https://centralcsp.com/articles/how-to-setup-nonce-with-nextjs
34. next-intl CSP discussion — https://github.com/amannn/next-intl/discussions/682
35. Tailwind + CSP inline styles tradeoff — https://github.com/vercel/next.js/discussions/81703
