# apps/api — NestJS Backend

This file is loaded when Claude Code sessions are working inside `apps/api/`.

## Local development

```bash
# From repo root — installs all workspace dependencies
pnpm install

# Start the API in watch mode (restarts on file changes)
pnpm --filter @massage-tulum/api start:dev

# The API is available at http://localhost:3001
# Swagger UI: http://localhost:3001/api/docs
# Health check: http://localhost:3001/api/health
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL. Also used to derive the JWKS endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) and the expected `iss` claim — see ADR-0012. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — server-side only, bypasses RLS |
| `SUPABASE_ANON_KEY` | Yes | Public anon key — used with user JWT for RLS-scoped access |
| `SUPABASE_SITE_URL` | No | Base URL for magic-link redirects (defaults to `http://localhost:3000`) |
| `ADMIN_EMAILS` | Yes | Comma-separated list of admin emails |
| `BREVO_API_KEY` | Yes | Brevo HTTP API key for transactional email |
| `PORT` | No | Defaults to `3001` (ADR-0001) |
| `NODE_ENV` | No | `development` / `production` / `test` |

## Running tests

```bash
# Unit tests only
pnpm --filter @massage-tulum/api test

# With coverage
pnpm --filter @massage-tulum/api test:cov

# Typecheck only
pnpm --filter @massage-tulum/api typecheck
```

## Module structure

```
src/
  main.ts                     Bootstrap: pipes, filters, Swagger, listen
  app.module.ts               Root module — import domain modules here
  health/                     First domain module (liveness probe)
    health.controller.ts
    health.module.ts
    health.service.ts
    __tests__/
      health.service.spec.ts
  common/
    filters/
      global-exception.filter.ts  Catch-all exception → { statusCode, message, error }
    swagger.ts                    Swagger DocumentBuilder config
```

## Conventions

- Every public endpoint has `@ApiOperation` + `@ApiResponse` Swagger decorators.
- Public (no-auth) endpoints require a comment explaining the reviewer approval
  per CLAUDE.md. The `/api/health` liveness probe is the canonical example.
- Errors: throw NestJS exceptions (`NotFoundException`, `BadRequestException`, etc.).
  The GlobalExceptionFilter formats them consistently — do not write your own
  try/catch in controllers.
- Never log PII (emails, names, phone numbers, payment data).
- Never use the Supabase service-role key in code that runs in an HTTP request
  context visible to the client. It is server-side only.

## Adding a new domain module

1. Create `src/<domain>/` with controller, service, module (and DTOs if needed).
2. Import the module in `AppModule`.
3. Add Swagger decorators to every endpoint.
4. Write unit tests for the service. Integration tests are optional for Foundation.
5. If the module needs Supabase access, inject the Supabase provider (ticket for that).
