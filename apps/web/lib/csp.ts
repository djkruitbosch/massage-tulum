/**
 * Content Security Policy helper.
 *
 * Generates the CSP header value for a given per-request nonce.
 * Policy is defined verbatim per ADR-0006 §"CSP policy".
 *
 * Any change to the policy below requires a PR with reviewer sign-off
 * and must be reflected in the ADR (which is immutable — supersede it
 * with a new ADR if the policy changes structurally).
 *
 * Ref: docs/adr/0006-csp-nextjs-app-router.md
 * Ticket: CU-869d29n0x (FE-3)
 */
export function buildCsp(nonce: string): string {
  const policy = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ];

  return policy.join('; ');
}
