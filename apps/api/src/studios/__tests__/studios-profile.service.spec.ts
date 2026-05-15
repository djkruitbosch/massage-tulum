import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StudiosProfileService } from '../studios-profile.service';
import { StudioResolverService } from '../../common/services/studio-resolver.service';
import { UpdateStudioProfileDto } from '../dto/update-studio-profile.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const STUDIO_ID = 'bbbbbbbb-0001-0000-0000-000000000000';
const FAKE_JWT = 'fake.jwt.token';

const STUDIO_ROW = {
  id: STUDIO_ID,
  name: 'My Studio',
  address: 'Av. Tulum 123',
  phone: '+529841234567',
  email: 'studio@test.local',
  description: 'Holistic massage in the heart of Tulum.',
  updated_at: '2026-05-03T10:00:00.000Z',
};

const HOURS_ROWS = Array.from({ length: 7 }, (_, i) => ({
  weekday: i + 1,
  is_open: i === 0, // Monday open, rest closed
  open_time: i === 0 ? '09:00:00' : null,
  close_time: i === 0 ? '21:00:00' : null,
}));

// ─── StudiosProfileService ────────────────────────────────────────────────────

describe('StudiosProfileService', () => {
  let service: StudiosProfileService;
  let studioResolverMock: jest.Mocked<StudioResolverService>;

  beforeEach(() => {
    // Set env vars needed by buildUserClient.
    process.env['SUPABASE_URL'] = 'https://test.supabase.co';
    process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

    studioResolverMock = {
      resolveStudioId: jest.fn().mockResolvedValue(STUDIO_ID),
    } as unknown as jest.Mocked<StudioResolverService>;

    service = new StudiosProfileService(studioResolverMock);
  });

  afterEach(() => {
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_ANON_KEY'];
    jest.restoreAllMocks();
  });

  // ─── resolveStudioId ──────────────────────────────────────────────────────

  describe('resolveStudioId (via getMyProfile)', () => {
    it('throws NotFoundException when user has no studio_profile', async () => {
      studioResolverMock.resolveStudioId.mockRejectedValueOnce(
        new NotFoundException('Studio not found for this user'),
      );

      await expect(service.getMyProfile(USER_ID, FAKE_JWT)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getMyProfile ─────────────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it('returns studio profile with trimmed time strings', async () => {
      // Spy on buildUserClient to return a mock user-scoped client
      const userClientMock = {
        from: jest.fn(),
      };

      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      // studios select
      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: STUDIO_ROW, error: null }),
      });

      // studio_hours select
      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: HOURS_ROWS, error: null }),
      });

      const result = await service.getMyProfile(USER_ID, FAKE_JWT);

      expect(result.id).toBe(STUDIO_ID);
      expect(result.name).toBe('My Studio');
      expect(result.phone).toBe('+529841234567');
      expect(result.hours).toHaveLength(7);
      // Monday open — times should be trimmed to HH:MM
      expect(result.hours[0]!.isOpen).toBe(true);
      expect(result.hours[0]!.openTime).toBe('09:00');
      expect(result.hours[0]!.closeTime).toBe('21:00');
      // Tuesday closed — times should be null
      expect(result.hours[1]!.isOpen).toBe(false);
      expect(result.hours[1]!.openTime).toBeNull();
    });

    it('throws NotFoundException when studio row is not found', async () => {
      const userClientMock = { from: jest.fn() };
      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(service.getMyProfile(USER_ID, FAKE_JWT)).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException when hours query fails', async () => {
      const userClientMock = { from: jest.fn() };
      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: STUDIO_ROW, error: null }),
      });

      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST' } }),
      });

      await expect(service.getMyProfile(USER_ID, FAKE_JWT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── patchMyProfile ───────────────────────────────────────────────────────

  describe('patchMyProfile', () => {
    it('throws BadRequestException when patch would leave no contact method', async () => {
      const studioWithNoContact = { ...STUDIO_ROW, phone: null, email: null };

      const userClientMock = { from: jest.fn() };
      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: studioWithNoContact, error: null }),
      });

      // PATCH body sets phone to null and email is null — violates contact requirement
      const dto: UpdateStudioProfileDto = { phone: null };

      await expect(service.patchMyProfile(USER_ID, FAKE_JWT, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when patch would clear the name', async () => {
      // This case is covered by DTO MinLength(1) on name, but service also checks
      // after merge. We test via a case where dto.name would somehow bypass DTO.
      const studioRow = { ...STUDIO_ROW };

      const userClientMock = { from: jest.fn() };
      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        // Return a studio with an empty name to trigger the service rule
        single: jest.fn().mockResolvedValue({
          data: { ...studioRow, name: '' },
          error: null,
        }),
      });

      // Empty name (which would pass DTO if somehow set to '')
      const dto: UpdateStudioProfileDto = {};

      await expect(service.patchMyProfile(USER_ID, FAKE_JWT, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates only the provided fields and returns refreshed profile', async () => {
      // Arrange: second resolveStudioId call for the internal getMyProfile at the end
      studioResolverMock.resolveStudioId
        .mockResolvedValueOnce(STUDIO_ID) // first call: patchMyProfile
        .mockResolvedValueOnce(STUDIO_ID); // second call: internal getMyProfile

      const userClientMock = { from: jest.fn() };
      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      const updatedStudio = { ...STUDIO_ROW, name: 'New Name' };

      // First userClient call: current state fetch for business rule check
      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: STUDIO_ROW, error: null }),
      });
      // Second: the UPDATE call
      userClientMock.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      // Third: getMyProfile re-fetch — studios
      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedStudio, error: null }),
      });
      // Fourth: getMyProfile re-fetch — studio_hours
      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: HOURS_ROWS, error: null }),
      });

      const dto: UpdateStudioProfileDto = { name: 'New Name' };
      const result = await service.patchMyProfile(USER_ID, FAKE_JWT, dto);

      expect(result.name).toBe('New Name');
    });

    it('throws InternalServerErrorException when studios UPDATE fails', async () => {
      const userClientMock = { from: jest.fn() };
      jest
        .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
        .mockReturnValue(userClientMock);

      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: STUDIO_ROW, error: null }),
      });
      userClientMock.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { code: 'PGRST', message: 'db error' } }),
      });

      const dto: UpdateStudioProfileDto = { name: 'Failing Studio' };

      await expect(service.patchMyProfile(USER_ID, FAKE_JWT, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
