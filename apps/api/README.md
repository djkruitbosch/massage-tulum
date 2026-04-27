# @massage-tulum/api

NestJS REST API for the Massage Tulum booking platform.

- Swagger UI: `/api/docs`
- Health check: `/api/health`
- Hosted on Hetzner CX23 + Coolify (ADR-0001), port 3001

## Quick start

```bash
# From repo root
pnpm install
cp apps/api/.env.example apps/api/.env
# Fill in .env values
pnpm --filter @massage-tulum/api start:dev
```

See `CLAUDE.md` in this directory for full developer context.
