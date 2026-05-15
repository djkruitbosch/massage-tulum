import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { TherapistsService } from '../therapists.service';
import { StudioResolverService } from '../../common/services/studio-resolver.service';
import { CreateTherapistDto } from '../dto/create-therapist.dto';
import { UpdateTherapistDto } from '../dto/update-therapist.dto';
import { UpdateTherapistStatusDto } from '../dto/update-therapist-status.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const STUDIO_ID = 'bbbbbbbb-0001-0000-0000-000000000001';
const THERAPIST_A_ID = 'cccccccc-0001-0000-0000-000000000001';
const THERAPIST_B_ID = 'cccccccc-0002-0000-0000-000000000001';
const FAKE_JWT = 'fake.jwt.token';

const makeTherapistRow = (
  overrides: Partial<{
    id: string;
    studio_id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    photo_url: string | null;
    status: 'active' | 'inactive';
    created_at: string;
    updated_at: string;
  }> = {},
) => ({
  id: THERAPIST_A_ID,
  studio_id: STUDIO_ID,
  name: 'Ana Martinez',
  role: 'Masajista',
  phone: null,
  email: null,
  notes: null,
  photo_url: null,
  status: 'active' as const,
  created_at: '2026-05-03T10:00:00.000Z',
  updated_at: '2026-05-03T10:00:00.000Z',
  ...overrides,
});

// ─── TherapistsService ────────────────────────────────────────────────────────

describe('TherapistsService', () => {
  let service: TherapistsService;
  let studioResolverMock: jest.Mocked<StudioResolverService>;
  let userClientMock: {
    from: jest.Mock;
    storage: {
      from: jest.Mock;
    };
  };

  beforeEach(() => {
    process.env['SUPABASE_URL'] = 'https://test.supabase.co';
    process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

    studioResolverMock = {
      resolveStudioId: jest.fn().mockResolvedValue(STUDIO_ID),
    } as unknown as jest.Mocked<StudioResolverService>;

    userClientMock = {
      from: jest.fn(),
      storage: {
        from: jest.fn(),
      },
    };

    service = new TherapistsService(studioResolverMock);

    jest
      .spyOn(service as unknown as { buildUserClient: () => unknown }, 'buildUserClient')
      .mockReturnValue(userClientMock);
  });

  afterEach(() => {
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_ANON_KEY'];
    jest.restoreAllMocks();
  });

  // ─── resolveStudioId (via StudioResolverService) ────────────────────────────

  describe('resolveStudioId (via listTherapists)', () => {
    it('throws NotFoundException when user has no studio_profile', async () => {
      studioResolverMock.resolveStudioId.mockRejectedValueOnce(
        new NotFoundException('Studio not found for this user'),
      );

      await expect(service.listTherapists(USER_ID, FAKE_JWT)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listTherapists ─────────────────────────────────────────────────────────

  describe('listTherapists', () => {
    it('returns active therapists ordered by name', async () => {
      const rows = [
        makeTherapistRow({ id: THERAPIST_A_ID, name: 'Ana', status: 'active' }),
        makeTherapistRow({ id: THERAPIST_B_ID, name: 'Carlos', status: 'inactive' }),
      ];

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      });

      // Storage returns empty signed URLs (no photos).
      userClientMock.storage.from.mockReturnValue({
        createSignedUrls: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await service.listTherapists(USER_ID, FAKE_JWT, 'all');

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('Ana');
      expect(result[0]!.photoUrl).toBeNull();
    });

    it('returns only inactive therapists when filter=inactive', async () => {
      const rows = [makeTherapistRow({ id: THERAPIST_B_ID, name: 'Carlos', status: 'inactive' })];

      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      };
      userClientMock.from.mockReturnValue(queryMock);

      userClientMock.storage.from.mockReturnValue({
        createSignedUrls: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await service.listTherapists(USER_ID, FAKE_JWT, 'inactive');

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('inactive');
      // Verify eq was called with 'inactive' status filter.
      expect(queryMock.eq).toHaveBeenCalledWith('status', 'inactive');
    });

    it('returns all therapists when filter=all', async () => {
      const rows = [
        makeTherapistRow({ id: THERAPIST_A_ID, name: 'Ana', status: 'active' }),
        makeTherapistRow({ id: THERAPIST_B_ID, name: 'Carlos', status: 'inactive' }),
      ];

      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      };
      userClientMock.from.mockReturnValue(queryMock);

      userClientMock.storage.from.mockReturnValue({
        createSignedUrls: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await service.listTherapists(USER_ID, FAKE_JWT, 'all');

      expect(result).toHaveLength(2);
      // Should NOT add status filter when 'all'.
      const eqCalls = queryMock.eq.mock.calls as [string, unknown][];
      const statusFilterCall = eqCalls.find((c) => c[0] === 'status');
      expect(statusFilterCall).toBeUndefined();
    });

    it('returns signed URLs for therapists that have a photo_url', async () => {
      const photoPath = 'therapists/cccccccc-0001-0000-0000-000000000001/photo.webp';
      const rows = [makeTherapistRow({ id: THERAPIST_A_ID, photo_url: photoPath })];

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      });

      const signedUrl =
        'https://test.supabase.co/storage/v1/object/sign/therapist-photos/therapists/cccccccc-0001-0000-0000-000000000001/photo.webp?token=abc';

      userClientMock.storage.from.mockReturnValue({
        createSignedUrls: jest.fn().mockResolvedValue({
          data: [{ path: photoPath, signedUrl }],
          error: null,
        }),
      });

      const result = await service.listTherapists(USER_ID, FAKE_JWT);

      expect(result[0]!.photoUrl).toBe(signedUrl);
    });

    it('throws InternalServerErrorException when DB query fails', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      await expect(service.listTherapists(USER_ID, FAKE_JWT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createTherapist ────────────────────────────────────────────────────────

  describe('createTherapist', () => {
    it('creates and returns a therapist', async () => {
      const newRow = makeTherapistRow({
        id: THERAPIST_A_ID,
        name: 'Ana Martinez',
        role: 'Masajista',
      });

      userClientMock.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newRow, error: null }),
      });

      const dto: CreateTherapistDto = {
        name: 'Ana Martinez',
        role: 'Masajista',
      };

      const result = await service.createTherapist(USER_ID, FAKE_JWT, dto);

      expect(result.id).toBe(THERAPIST_A_ID);
      expect(result.name).toBe('Ana Martinez');
      expect(result.role).toBe('Masajista');
      expect(result.photoUrl).toBeNull();
      expect(result.studioId).toBe(STUDIO_ID);
    });

    it('throws InternalServerErrorException when insert fails', async () => {
      userClientMock.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      const dto: CreateTherapistDto = { name: 'Test', role: 'Role' };

      await expect(service.createTherapist(USER_ID, FAKE_JWT, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateTherapist ────────────────────────────────────────────────────────

  describe('updateTherapist', () => {
    it('updates provided fields and returns updated therapist', async () => {
      const updatedRow = makeTherapistRow({ name: 'Updated Name' });

      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
      });

      userClientMock.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const dto: UpdateTherapistDto = { name: 'Updated Name' };
      const result = await service.updateTherapist(USER_ID, FAKE_JWT, THERAPIST_A_ID, dto);

      expect(result.name).toBe('Updated Name');
    });

    it('throws BadRequestException when no fields are provided', async () => {
      const dto: UpdateTherapistDto = {};

      await expect(service.updateTherapist(USER_ID, FAKE_JWT, THERAPIST_A_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when therapist not found (simulates cross-studio RLS denial)', async () => {
      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const dto: UpdateTherapistDto = { name: 'Hacker' };

      await expect(service.updateTherapist(USER_ID, FAKE_JWT, THERAPIST_B_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateTherapistStatus ──────────────────────────────────────────────────

  describe('updateTherapistStatus', () => {
    it('deactivates a therapist (active → inactive)', async () => {
      const updatedRow = makeTherapistRow({ status: 'inactive' });

      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
      });

      userClientMock.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const dto: UpdateTherapistStatusDto = { status: 'inactive' };
      const result = await service.updateTherapistStatus(USER_ID, FAKE_JWT, THERAPIST_A_ID, dto);

      expect(result.status).toBe('inactive');
    });

    it('reactivates a therapist (inactive → active)', async () => {
      const updatedRow = makeTherapistRow({ status: 'active' });

      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
      });

      userClientMock.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const dto: UpdateTherapistStatusDto = { status: 'active' };
      const result = await service.updateTherapistStatus(USER_ID, FAKE_JWT, THERAPIST_A_ID, dto);

      expect(result.status).toBe('active');
    });

    it('throws NotFoundException when therapist not found', async () => {
      userClientMock.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const dto: UpdateTherapistStatusDto = { status: 'inactive' };

      await expect(
        service.updateTherapistStatus(USER_ID, FAKE_JWT, THERAPIST_B_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── uploadTherapistPhoto ───────────────────────────────────────────────────

  describe('uploadTherapistPhoto', () => {
    it('throws NotFoundException when therapist not found for upload', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const fakeFile = {
        buffer: Buffer.from('fake-image-bytes'),
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      await expect(
        service.uploadTherapistPhoto(USER_ID, FAKE_JWT, THERAPIST_B_ID, fakeFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException when Storage upload fails', async () => {
      const currentRow = makeTherapistRow({ photo_url: null });

      // First from() call: SELECT current therapist row.
      userClientMock.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: currentRow, error: null }),
      });

      // Storage upload fails.
      userClientMock.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage quota exceeded' },
        }),
      });

      // Provide a valid WebP file buffer so Sharp processing succeeds.
      // We mock the sharp processing by providing a buffer that is already valid WebP.
      // Since sharp is not mocked here, we need a real image buffer.
      // Use a 1x1 pixel PNG as minimum valid input for sharp to process.
      const minimalPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const fakeFile = {
        buffer: minimalPng,
        mimetype: 'image/png',
        size: minimalPng.length,
      } as Express.Multer.File;

      await expect(
        service.uploadTherapistPhoto(USER_ID, FAKE_JWT, THERAPIST_A_ID, fakeFile),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('uploads a new photo, updates photo_url, deletes old photo, and returns signed URL (AC-9 replace path)', async () => {
      const oldPath = 'therapists/cccccccc-0001-0000-0000-000000000001/old.webp';
      const currentRow = makeTherapistRow({ photo_url: oldPath });
      // Row after update — photo_url will be the new path. Match it loosely; the
      // service maps the row to a DTO with the freshly-generated signed URL.
      const updatedRow = makeTherapistRow({ photo_url: 'therapists/x/new.webp' });

      // SELECT current therapist row.
      userClientMock.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: currentRow, error: null }),
        })
        // UPDATE photo_url.
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: updatedRow, error: null }),
        });

      const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'x' }, error: null });
      const removeMock = jest.fn().mockResolvedValue({ data: [], error: null });
      const createSignedUrlMock = jest
        .fn()
        .mockResolvedValue({ data: { signedUrl: 'https://signed.example/new' }, error: null });
      userClientMock.storage.from.mockReturnValue({
        upload: uploadMock,
        remove: removeMock,
        createSignedUrl: createSignedUrlMock,
      });

      const minimalPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const fakeFile = {
        buffer: minimalPng,
        mimetype: 'image/png',
        size: minimalPng.length,
      } as Express.Multer.File;

      const result = await service.uploadTherapistPhoto(
        USER_ID,
        FAKE_JWT,
        THERAPIST_A_ID,
        fakeFile,
      );

      expect(uploadMock).toHaveBeenCalledTimes(1);
      // The old path must be removed (best-effort cleanup, but the call MUST happen).
      expect(removeMock).toHaveBeenCalledWith([oldPath]);
      expect(createSignedUrlMock).toHaveBeenCalledTimes(1);
      expect(result.photoUrl).toBe('https://signed.example/new');
    });
  });

  // ─── removeTherapistPhoto ───────────────────────────────────────────────────

  describe('removeTherapistPhoto', () => {
    it('returns therapist with photoUrl=null when photo is already null (idempotent)', async () => {
      const rowWithNoPhoto = makeTherapistRow({ photo_url: null });

      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: rowWithNoPhoto, error: null }),
      });

      const result = await service.removeTherapistPhoto(USER_ID, FAKE_JWT, THERAPIST_A_ID);

      expect(result.photoUrl).toBeNull();
    });

    it('removes photo and returns therapist with photoUrl=null', async () => {
      const photoPath = 'therapists/cccccccc-0001-0000-0000-000000000001/old.webp';
      const rowWithPhoto = makeTherapistRow({ photo_url: photoPath });
      const rowWithNullPhoto = makeTherapistRow({ photo_url: null });

      // First from(): SELECT current row.
      userClientMock.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: rowWithPhoto, error: null }),
        })
        // Second from(): UPDATE photo_url = null.
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: rowWithNullPhoto, error: null }),
        });

      // Storage: DELETE the old file.
      userClientMock.storage.from.mockReturnValue({
        remove: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await service.removeTherapistPhoto(USER_ID, FAKE_JWT, THERAPIST_A_ID);

      expect(result.photoUrl).toBeNull();
    });

    it('throws NotFoundException when therapist not found', async () => {
      userClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      await expect(service.removeTherapistPhoto(USER_ID, FAKE_JWT, THERAPIST_B_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('continues (non-fatal) when Storage delete fails during photo removal', async () => {
      const photoPath = 'therapists/cccccccc-0001-0000-0000-000000000001/old.webp';
      const rowWithPhoto = makeTherapistRow({ photo_url: photoPath });
      const rowWithNullPhoto = makeTherapistRow({ photo_url: null });

      userClientMock.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: rowWithPhoto, error: null }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: rowWithNullPhoto, error: null }),
        });

      // Storage delete FAILS — should be non-fatal.
      userClientMock.storage.from.mockReturnValue({
        remove: jest.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
      });

      // Should NOT throw — non-fatal path.
      const result = await service.removeTherapistPhoto(USER_ID, FAKE_JWT, THERAPIST_A_ID);
      expect(result.photoUrl).toBeNull();
    });
  });
});
