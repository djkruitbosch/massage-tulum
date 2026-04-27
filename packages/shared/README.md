# @massage-tulum/shared

Shared TypeScript types and Zod validation schemas used across the monorepo.

## Purpose

This package is the single source of truth for data shapes that cross the API/FE boundary. Any schema that appears in both a NestJS DTO and a Next.js form lives here.

## Usage

```typescript
import { healthResponseSchema, type HealthResponse } from '@massage-tulum/shared';
```

## Contents

| Export | Description |
|---|---|
| `healthResponseSchema` | Zod schema for `GET /api/health` response: `{ status: 'ok' }` |
| `HealthResponse` | TypeScript type inferred from `healthResponseSchema` |

## Rules

- No framework-specific code. No NestJS decorators, no React, no Next.js.
- No `any` without a justifying comment.
- Every schema export has a corresponding type export.
- All schemas have unit tests in `src/schemas/*.test.ts`.

## Development

```bash
# Build (tsc)
pnpm build

# Type-check only (no emit)
pnpm typecheck

# Run tests
pnpm test

# Watch mode build
pnpm dev
```

## Adding a new schema

1. Create `src/schemas/<domain>.schema.ts` with the Zod schema and inferred type.
2. Add a test file `src/schemas/<domain>.schema.test.ts`.
3. Re-export from `src/schemas/index.ts`.
4. `src/index.ts` picks it up automatically via `export * from './schemas/index.js'`.
