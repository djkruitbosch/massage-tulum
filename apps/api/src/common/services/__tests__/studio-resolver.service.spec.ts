import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StudioResolverService } from '../studio-resolver.service';
import { SUPABASE_CLIENT } from '../../supabase/supabase.provider';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const STUDIO_ID = 'bbbbbbbb-0001-0000-0000-000000000001';

// ─── Mock Supabase chain builder ───────────────────────────────────────────────

function buildAdminChain(resolvedValue: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── StudioResolverService ────────────────────────────────────────────────────

describe('StudioResolverService', () => {
  let service: StudioResolverService;
  let adminSupabaseMock: { from: jest.Mock };

  beforeEach(async () => {
    adminSupabaseMock = { from: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudioResolverService,
        {
          provide: SUPABASE_CLIENT,
          useValue: adminSupabaseMock,
        },
      ],
    }).compile();

    service = module.get<StudioResolverService>(StudioResolverService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── happy path ──────────────────────────────────────────────────────────────

  describe('resolveStudioId — happy path', () => {
    it('returns studio_id when studio_profile exists for user', async () => {
      adminSupabaseMock.from.mockReturnValue(
        buildAdminChain({ data: { studio_id: STUDIO_ID }, error: null }),
      );

      const result = await service.resolveStudioId(USER_ID);

      expect(result).toBe(STUDIO_ID);
      expect(adminSupabaseMock.from).toHaveBeenCalledWith('studio_profiles');
    });
  });

  // ─── no profile ─────────────────────────────────────────────────────────────

  describe('resolveStudioId — no studio profile', () => {
    it('throws NotFoundException with correct message when data is null', async () => {
      adminSupabaseMock.from.mockReturnValue(
        buildAdminChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }),
      );

      await expect(service.resolveStudioId(USER_ID)).rejects.toThrow(NotFoundException);
      await expect(service.resolveStudioId(USER_ID)).rejects.toThrow(
        'Studio not found for this user',
      );
    });

    it('throws NotFoundException when data is null and error is null (empty result)', async () => {
      adminSupabaseMock.from.mockReturnValue(buildAdminChain({ data: null, error: null }));

      await expect(service.resolveStudioId(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── unexpected DB error ─────────────────────────────────────────────────────

  describe('resolveStudioId — unexpected DB error', () => {
    it('throws NotFoundException (wraps DB error) when Supabase returns an error', async () => {
      adminSupabaseMock.from.mockReturnValue(
        buildAdminChain({
          data: null,
          error: { code: '500', message: 'connection refused' },
        }),
      );

      // The service treats any error + null data as NotFoundException (not InternalServerError).
      // This matches the existing behavior preserved from both original services.
      await expect(service.resolveStudioId(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('propagates unexpected thrown errors from the Supabase client', async () => {
      const unexpectedError = new Error('Unexpected network failure');
      adminSupabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(unexpectedError),
      });

      await expect(service.resolveStudioId(USER_ID)).rejects.toThrow('Unexpected network failure');
    });
  });
});
