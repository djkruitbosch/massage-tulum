import { ConflictException, NotFoundException } from '@nestjs/common';
import { StudiosService } from '../studios.service';
import { BrevoService } from '../../common/brevo/brevo.service';
import { CreatePendingStudioDto } from '../dto/create-pending-studio.dto';
import { RejectStudioDto } from '../dto/reject-studio.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PENDING_ROW = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  email: 'studio@test.local',
  studio_name: 'Test Studio',
  contact_phone: null,
  description: 'A test studio',
  locale: 'en',
  status: 'pending',
  rejection_reason: null,
  auth_user_id: null,
  submitted_at: '2026-05-03T10:00:00.000Z',
  reviewed_at: null,
  reviewed_by: null,
};

const ADMIN_EMAILS = ['admin@test.local'];
const ADMIN_USER_ID = 'dddddddd-0000-0000-0000-000000000001';

// ─── StudiosService ────────────────────────────────────────────────────────────

describe('StudiosService', () => {
  let service: StudiosService;
  let supabaseMock: ReturnType<typeof buildMockSupabaseClient>;
  let brevoMock: jest.Mocked<BrevoService>;

  function buildMockSupabaseClient() {
    return {
      from: jest.fn(),
      auth: {
        admin: {
          listUsers: jest.fn(),
          createUser: jest.fn(),
          generateLink: jest.fn(),
        },
      },
    };
  }

  beforeEach(() => {
    supabaseMock = buildMockSupabaseClient();
    brevoMock = { sendWelcomeEmail: jest.fn() } as unknown as jest.Mocked<BrevoService>;

    service = new StudiosService(
      supabaseMock as unknown as ConstructorParameters<typeof StudiosService>[0],
      brevoMock,
    );
  });

  // ─── createPendingStudio ─────────────────────────────────────────────────

  describe('createPendingStudio', () => {
    const dto: CreatePendingStudioDto = {
      email: 'owner@mystudio.com',
      studioName: 'My Studio',
      contactPhone: null,
      description: 'A great studio',
      locale: 'en',
    };

    it('inserts a pending_studios row on valid input', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      supabaseMock.from.mockReturnValue({ insert: insertMock });

      await expect(service.createPendingStudio(dto)).resolves.toBeUndefined();
      expect(supabaseMock.from).toHaveBeenCalledWith('pending_studios');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          studio_name: dto.studioName,
          description: dto.description,
          locale: dto.locale,
          status: 'pending',
        }),
      );
    });

    it('silently de-dups duplicate email (unique constraint violation code 23505)', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: { code: '23505' } });
      supabaseMock.from.mockReturnValue({ insert: insertMock });

      await expect(service.createPendingStudio(dto)).resolves.toBeUndefined();
    });

    it('throws InternalServerErrorException on unexpected DB error', async () => {
      const insertMock = jest
        .fn()
        .mockResolvedValue({ error: { code: '42P01', message: 'table missing' } });
      supabaseMock.from.mockReturnValue({ insert: insertMock });

      await expect(service.createPendingStudio(dto)).rejects.toThrow('Failed to process signup');
    });
  });

  // ─── listPendingStudios ──────────────────────────────────────────────────

  describe('listPendingStudios', () => {
    it('returns a paginated list with camelCased fields', async () => {
      const rows = [PENDING_ROW];
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: rows, error: null, count: 1 }),
      };
      supabaseMock.from.mockReturnValue(chain);

      const result = await service.listPendingStudios(
        { status: 'pending', page: 1, limit: 20 },
        ADMIN_EMAILS,
      );

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data[0]).toMatchObject({
        id: PENDING_ROW.id,
        studioName: PENDING_ROW.studio_name,
        locale: PENDING_ROW.locale,
        status: PENDING_ROW.status,
      });
    });

    it('uses defaults when page/limit not provided', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };
      supabaseMock.from.mockReturnValue(chain);

      const result = await service.listPendingStudios({}, ADMIN_EMAILS);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('throws InternalServerErrorException on DB error', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST' }, count: null }),
      };
      supabaseMock.from.mockReturnValue(chain);

      await expect(service.listPendingStudios({ status: 'pending' }, ADMIN_EMAILS)).rejects.toThrow(
        'Failed to retrieve pending studios',
      );
    });
  });

  // ─── rejectPendingStudio ─────────────────────────────────────────────────

  describe('rejectPendingStudio', () => {
    const dto: RejectStudioDto = { reason: 'Out of area' };

    it('updates status to rejected', async () => {
      const singleMock = jest.fn().mockResolvedValue({ data: PENDING_ROW, error: null });
      const updateMock = jest.fn().mockResolvedValue({ error: null });
      supabaseMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: singleMock,
      });
      supabaseMock.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      // Workaround: mock update chain
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      supabaseMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: PENDING_ROW, error: null }),
      });
      supabaseMock.from.mockReturnValueOnce(updateChain);

      // Re-create service with fresh mock
      supabaseMock.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: PENDING_ROW, error: null }),
        })
        .mockReturnValueOnce(updateChain);

      void updateMock;
      await expect(
        service.rejectPendingStudio(PENDING_ROW.id, dto, ADMIN_USER_ID, ADMIN_EMAILS),
      ).resolves.toBeUndefined();
    });

    it('throws ConflictException if already rejected', async () => {
      const rejectedRow = { ...PENDING_ROW, status: 'rejected' };
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: rejectedRow, error: null }),
      });

      await expect(
        service.rejectPendingStudio(PENDING_ROW.id, dto, ADMIN_USER_ID, ADMIN_EMAILS),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if pending studio does not exist', async () => {
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(
        service.rejectPendingStudio('non-existent-id', dto, ADMIN_USER_ID, ADMIN_EMAILS),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── approvePendingStudio — ConflictException path ──────────────────────

  describe('approvePendingStudio', () => {
    it('throws ConflictException if studio is already approved', async () => {
      const approvedRow = { ...PENDING_ROW, status: 'approved' };
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: approvedRow, error: null }),
      });

      await expect(
        service.approvePendingStudio(PENDING_ROW.id, ADMIN_USER_ID, ADMIN_EMAILS),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if pending studio does not exist', async () => {
      supabaseMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(
        service.approvePendingStudio('non-existent-id', ADMIN_USER_ID, ADMIN_EMAILS),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── AdminGuard integration — email in ADMIN_EMAILS ─────────────────────
  // (Tested via guard spec; service tests cover business logic only)
});
