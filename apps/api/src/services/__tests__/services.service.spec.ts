import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ServicesService } from '../services.service';
import { StudioResolverService } from '../../common/services/studio-resolver.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const STUDIO_ID = 'bbbbbbbb-0001-0000-0000-000000000001';
const SERVICE_A_ID = 'cccccccc-0001-0000-0000-000000000001';
const SERVICE_B_ID = 'cccccccc-0002-0000-0000-000000000001';
const FAKE_JWT = 'fake.jwt.token';

const makeServiceRow = (
  overrides: Partial<{
    id: string;
    studio_id: string;
    name: string;
    description: string | null;
    category: string | null;
    duration_minutes: number;
    base_price_mxn: number;
    status: 'active' | 'inactive';
    created_at: string;
    updated_at: string;
  }> = {},
) => ({
  id: SERVICE_A_ID,
  studio_id: STUDIO_ID,
  name: 'Deep Tissue Massage',
  description: 'A relaxing deep tissue massage.',
  category: 'Relajación',
  duration_minutes: 60,
  base_price_mxn: 1200,
  status: 'active' as const,
  created_at: '2026-05-14T10:00:00.000Z',
  updated_at: '2026-05-14T10:00:00.000Z',
  ...overrides,
});

// ─── ServicesService ──────────────────────────────────────────────────────────

describe('ServicesService', () => {
  let service: ServicesService;
  let studioResolverMock: jest.Mocked<StudioResolverService>;
  let userClientMock: {
    from: jest.Mock;
  };

  beforeEach(() => {
    process.env['SUPABASE_URL'] = 'https://test.supabase.co';
    process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

    studioResolverMock = {
      resolveStudioId: jest.fn().mockResolvedValue(STUDIO_ID),
    } as unknown as jest.Mocked<StudioResolverService>;

    userClientMock = {
      from: jest.fn(),
    };

    service = new ServicesService(studioResolverMock);

    jest
      .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
      .mockReturnValue(userClientMock);
  });

  afterEach(() => {
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_ANON_KEY'];
    jest.restoreAllMocks();
  });

  // ─── listServices ───────────────────────────────────────────────────────────

  describe('listServices', () => {
    it("returns active services only and emits service_catalog_viewed with filter_applied='active'", async () => {
      const rows = [
        makeServiceRow({ id: SERVICE_A_ID, name: 'Alpha', status: 'active' }),
        makeServiceRow({ id: SERVICE_B_ID, name: 'Beta', status: 'inactive' }),
      ];

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      });

      // Spy on trackEvent to verify analytics emission.
      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const result = await service.listServices(USER_ID, FAKE_JWT, 'active');

      // Returns only active services.
      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('active');
      expect(result[0]!.name).toBe('Alpha');

      // Analytics event emitted with correct counts (from unfiltered list).
      expect(trackSpy).toHaveBeenCalledWith('service_catalog_viewed', {
        studio_id: STUDIO_ID,
        active_count: 1,
        inactive_count: 1,
        filter_applied: 'active',
      });
    });

    it("returns all services and emits service_catalog_viewed with filter_applied='all'", async () => {
      const rows = [
        makeServiceRow({ id: SERVICE_A_ID, name: 'Alpha', status: 'active' }),
        makeServiceRow({ id: SERVICE_B_ID, name: 'Beta', status: 'inactive' }),
      ];

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const result = await service.listServices(USER_ID, FAKE_JWT, 'all');

      expect(result).toHaveLength(2);
      expect(trackSpy).toHaveBeenCalledWith('service_catalog_viewed', {
        studio_id: STUDIO_ID,
        active_count: 1,
        inactive_count: 1,
        filter_applied: 'all',
      });
    });

    it("returns inactive services only and emits service_catalog_viewed with filter_applied='inactive'", async () => {
      const rows = [
        makeServiceRow({ id: SERVICE_A_ID, name: 'Alpha', status: 'active' }),
        makeServiceRow({ id: SERVICE_B_ID, name: 'Beta', status: 'inactive' }),
      ];

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const result = await service.listServices(USER_ID, FAKE_JWT, 'inactive');

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('inactive');
      expect(result[0]!.name).toBe('Beta');
      expect(trackSpy).toHaveBeenCalledWith('service_catalog_viewed', {
        studio_id: STUDIO_ID,
        active_count: 1,
        inactive_count: 1,
        filter_applied: 'inactive',
      });
    });

    it('throws InternalServerErrorException when DB query fails', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      await expect(service.listServices(USER_ID, FAKE_JWT, 'active')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── listCategories ─────────────────────────────────────────────────────────

  describe('listCategories', () => {
    it('returns alphabetical distinct categories', async () => {
      const rows = [
        { category: 'Terapéutico' },
        { category: 'Relajación' },
        { category: 'Relajación' }, // duplicate — should be deduplicated
        { category: 'Exótico' },
      ];

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: rows, error: null }),
      });

      const result = await service.listCategories(USER_ID, FAKE_JWT);

      expect(result).toEqual(['Exótico', 'Relajación', 'Terapéutico']);
    });

    it('returns empty array when no categories have been assigned', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await service.listCategories(USER_ID, FAKE_JWT);

      expect(result).toEqual([]);
    });
  });

  // ─── createService ──────────────────────────────────────────────────────────

  describe('createService', () => {
    it('creates a service and returns the DTO with trimmed name', async () => {
      const newRow = makeServiceRow({
        id: SERVICE_A_ID,
        name: 'Deep Tissue Massage',
        category: 'Relajación',
        description: 'Relaxing.',
      });

      userClientMock.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newRow, error: null }),
      });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const dto: CreateServiceDto = {
        name: '  Deep Tissue Massage  ', // leading/trailing whitespace should be trimmed
        description: 'Relaxing.',
        category: 'Relajación',
        durationMinutes: 60,
        basePriceMxn: 1200,
      };

      const result = await service.createService(USER_ID, FAKE_JWT, dto);

      expect(result.id).toBe(SERVICE_A_ID);
      expect(result.studioId).toBe(STUDIO_ID);
      expect(result.durationMinutes).toBe(60);
      expect(result.basePriceMxn).toBe(1200);

      // Verify analytics emission.
      expect(trackSpy).toHaveBeenCalledWith('service_created', {
        studio_id: STUDIO_ID,
        service_id: SERVICE_A_ID,
        duration_minutes: 60,
        base_price_mxn: 1200,
        has_category: true,
        has_description: true,
      });

      // Verify name was trimmed in the insert payload.
      const fromMock = userClientMock.from.mock.results[0]!;
      const insertMock = fromMock.value.insert as jest.Mock;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Deep Tissue Massage' }),
      );
    });

    it('stores null for description and category when not provided', async () => {
      const newRow = makeServiceRow({
        description: null,
        category: null,
      });

      userClientMock.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newRow, error: null }),
      });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const dto: CreateServiceDto = {
        name: 'Free Service',
        durationMinutes: 30,
        basePriceMxn: 0,
      };

      await service.createService(USER_ID, FAKE_JWT, dto);

      expect(trackSpy).toHaveBeenCalledWith('service_created', {
        studio_id: STUDIO_ID,
        service_id: SERVICE_A_ID,
        duration_minutes: 60,
        base_price_mxn: 1200,
        has_category: false,
        has_description: false,
      });
    });

    it('throws InternalServerErrorException when insert fails', async () => {
      userClientMock.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      const dto: CreateServiceDto = {
        name: 'Test',
        durationMinutes: 60,
        basePriceMxn: 100,
      };

      await expect(service.createService(USER_ID, FAKE_JWT, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateService ──────────────────────────────────────────────────────────

  describe('updateService', () => {
    it('performs a partial update and returns the updated DTO with correct fields_changed', async () => {
      const updatedRow = makeServiceRow({ name: 'Updated Massage', duration_minutes: 90 });

      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
      });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const dto: UpdateServiceDto = { name: 'Updated Massage', durationMinutes: 90 };
      const result = await service.updateService(USER_ID, FAKE_JWT, SERVICE_A_ID, dto);

      expect(result.name).toBe('Updated Massage');
      expect(result.durationMinutes).toBe(90);

      expect(trackSpy).toHaveBeenCalledWith('service_edited', {
        studio_id: STUDIO_ID,
        service_id: SERVICE_A_ID,
        fields_changed: expect.arrayContaining(['name', 'durationMinutes']),
      });
    });

    it('throws BadRequestException when no fields are provided', async () => {
      const dto: UpdateServiceDto = {};

      await expect(service.updateService(USER_ID, FAKE_JWT, SERVICE_A_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for cross-studio service (RLS returns zero rows)', async () => {
      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const dto: UpdateServiceDto = { name: 'Hacker' };

      await expect(service.updateService(USER_ID, FAKE_JWT, SERVICE_B_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getFutureBookingsCount ─────────────────────────────────────────────────

  describe('getFutureBookingsCount', () => {
    it('returns { futureBookingsCount: 0 } in v1', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: SERVICE_A_ID },
          error: null,
        }),
      });

      const result = await service.getFutureBookingsCount(USER_ID, FAKE_JWT, SERVICE_A_ID);

      expect(result).toEqual({ futureBookingsCount: 0 });
    });

    it('throws NotFoundException when service does not exist or belongs to another studio', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(service.getFutureBookingsCount(USER_ID, FAKE_JWT, SERVICE_B_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deactivateService ──────────────────────────────────────────────────────

  describe('deactivateService', () => {
    it('deactivates an active service and emits service_deactivated', async () => {
      const activeRow = makeServiceRow({ status: 'active' });
      const deactivatedRow = makeServiceRow({ status: 'inactive' });

      // First from(): SELECT current row.
      userClientMock.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: activeRow, error: null }),
        })
        // Second from(): UPDATE status='inactive'.
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: deactivatedRow, error: null }),
        });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const result = await service.deactivateService(USER_ID, FAKE_JWT, SERVICE_A_ID);

      expect(result.status).toBe('inactive');
      expect(trackSpy).toHaveBeenCalledWith('service_deactivated', {
        studio_id: STUDIO_ID,
        service_id: SERVICE_A_ID,
        had_future_bookings: false,
        future_booking_count: 0,
      });
    });

    it("throws ConflictException('service_already_inactive') when already inactive", async () => {
      const inactiveRow = makeServiceRow({ status: 'inactive' });

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: inactiveRow, error: null }),
      });

      await expect(service.deactivateService(USER_ID, FAKE_JWT, SERVICE_A_ID)).rejects.toThrow(
        ConflictException,
      );

      await expect(service.deactivateService(USER_ID, FAKE_JWT, SERVICE_A_ID)).rejects.toThrow(
        'service_already_inactive',
      );
    });

    it('throws NotFoundException for cross-studio service', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(service.deactivateService(USER_ID, FAKE_JWT, SERVICE_B_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── reactivateService ──────────────────────────────────────────────────────

  describe('reactivateService', () => {
    it('reactivates an inactive service and emits service_reactivated', async () => {
      const inactiveRow = makeServiceRow({ status: 'inactive' });
      const reactivatedRow = makeServiceRow({ status: 'active' });

      // First from(): SELECT current row.
      userClientMock.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: inactiveRow, error: null }),
        })
        // Second from(): UPDATE status='active'.
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: reactivatedRow, error: null }),
        });

      const trackSpy = jest.spyOn(
        service as unknown as { trackEvent: (event: string, props: unknown) => void },
        'trackEvent',
      );

      const result = await service.reactivateService(USER_ID, FAKE_JWT, SERVICE_A_ID);

      expect(result.status).toBe('active');
      expect(trackSpy).toHaveBeenCalledWith('service_reactivated', {
        studio_id: STUDIO_ID,
        service_id: SERVICE_A_ID,
      });
    });

    it("throws ConflictException('service_already_active') when already active", async () => {
      const activeRow = makeServiceRow({ status: 'active' });

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: activeRow, error: null }),
      });

      await expect(service.reactivateService(USER_ID, FAKE_JWT, SERVICE_A_ID)).rejects.toThrow(
        ConflictException,
      );

      await expect(service.reactivateService(USER_ID, FAKE_JWT, SERVICE_A_ID)).rejects.toThrow(
        'service_already_active',
      );
    });

    it('throws NotFoundException for cross-studio service', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(service.reactivateService(USER_ID, FAKE_JWT, SERVICE_B_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
