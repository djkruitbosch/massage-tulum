import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';

// ─── Mock ExecutionContext ─────────────────────────────────────────────────────

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

// ─── Mock Supabase client ─────────────────────────────────────────────────────

function makeSbClient(userResult: {
  data: { user: { id: string; email?: string } | null };
  error: null | { message: string };
}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue(userResult),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AdminGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ADMIN_EMAILS: 'admin@test.local' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const guard = new AdminGuard(makeSbClient({ data: { user: null }, error: null }) as never);
    const ctx = makeContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    const guard = new AdminGuard(
      makeSbClient({ data: { user: null }, error: { message: 'invalid token' } }) as never,
    );
    const ctx = makeContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when email is not in ADMIN_EMAILS', async () => {
    const guard = new AdminGuard(
      makeSbClient({
        data: { user: { id: 'abc', email: 'notadmin@test.local' } },
        error: null,
      }) as never,
    );
    const ctx = makeContext({ authorization: 'Bearer valid-token' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('returns true and attaches adminUserId when email matches ADMIN_EMAILS', async () => {
    const guard = new AdminGuard(
      makeSbClient({
        data: { user: { id: 'admin-id-123', email: 'admin@test.local' } },
        error: null,
      }) as never,
    );

    const req = { headers: { authorization: 'Bearer valid-token' } } as never;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect((req as unknown as { adminUserId: string }).adminUserId).toBe('admin-id-123');
  });

  it('is case-insensitive for email comparison', async () => {
    process.env['ADMIN_EMAILS'] = 'Admin@Test.Local';
    const guard = new AdminGuard(
      makeSbClient({
        data: { user: { id: 'admin-id', email: 'admin@test.local' } },
        error: null,
      }) as never,
    );

    const req = { headers: { authorization: 'Bearer valid-token' } } as never;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('supports multiple admin emails in ADMIN_EMAILS', async () => {
    process.env['ADMIN_EMAILS'] = 'first@test.local, second@test.local , admin@test.local';
    const guard = new AdminGuard(
      makeSbClient({
        data: { user: { id: 'second-admin', email: 'second@test.local' } },
        error: null,
      }) as never,
    );

    const req = { headers: { authorization: 'Bearer valid-token' } } as never;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
