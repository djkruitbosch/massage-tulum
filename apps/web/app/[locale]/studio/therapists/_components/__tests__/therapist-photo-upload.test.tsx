// @vitest-environment jsdom
/**
 * TherapistPhotoUpload component tests.
 *
 * Tests focus on observable behavior:
 *   - Client-side size validation rejects files > 5 MB.
 *   - Client-side mime validation rejects non-image types.
 *   - Shows "Upload photo" when no photo, "Replace photo" when photo exists.
 *   - Shows "Remove photo" button only when photo exists.
 *   - Shows file hint only when no photo.
 *
 * These tests mock the server actions so they don't make real API calls.
 *
 * Ticket: CU-869d8k3yv
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { TherapistPhotoUpload } from '../therapist-photo-upload';

// Mock the server actions.
// Path from _components/ (where the component lives): ../../../../../actions/therapists
// This is the same path the component imports — vitest matches by resolved module ID.
vi.mock('../../../../../../actions/therapists', () => ({
  uploadTherapistPhoto: vi.fn(),
  removeTherapistPhoto: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  therapistRoster: {
    avatar: {
      uploadPhoto: 'Upload photo',
      replacePhoto: 'Replace photo',
      removePhoto: 'Remove photo',
      fileHint: 'PNG, JPG, or WebP. Maximum 2 MB. Square format recommended.',
      fileInput: { label: 'Select therapist photo' },
      uploading: 'Uploading photo...',
      error: {
        fileType: 'Invalid file type. Use PNG, JPG, or WebP.',
        fileSize: 'File is too large. Maximum size is 5 MB.',
        uploadFailed: 'Could not upload the photo. Please try again.',
      },
      undo: {
        title: 'Photo removed',
        description: 'The photo will be removed when you save.',
        action: 'Undo',
      },
    },
  },
};

function renderUpload(props: {
  photoUrl?: string | null;
  onPhotoChange?: (url: string | null) => void;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TherapistPhotoUpload
        therapistId="test-id-123"
        therapistName="Ana Martinez"
        photoUrl={props.photoUrl ?? null}
        onPhotoChange={props.onPhotoChange ?? vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TherapistPhotoUpload', () => {
  describe('initial state (no photo)', () => {
    it('shows "Upload photo" button', () => {
      renderUpload({ photoUrl: null });
      expect(screen.getByRole('button', { name: 'Upload photo' })).toBeInTheDocument();
    });

    it('does not show "Remove photo" button', () => {
      renderUpload({ photoUrl: null });
      expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
    });

    it('shows file hint text', () => {
      renderUpload({ photoUrl: null });
      expect(screen.getByText(/PNG, JPG, or WebP/)).toBeInTheDocument();
    });
  });

  describe('initial state (has photo)', () => {
    it('shows "Replace photo" button', () => {
      renderUpload({ photoUrl: 'https://example.com/photo.jpg' });
      expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
    });

    it('shows "Remove photo" button', () => {
      renderUpload({ photoUrl: 'https://example.com/photo.jpg' });
      expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
    });

    it('does not show file hint text', () => {
      renderUpload({ photoUrl: 'https://example.com/photo.jpg' });
      expect(screen.queryByText(/PNG, JPG, or WebP/)).not.toBeInTheDocument();
    });
  });

  describe('client-side size validation', () => {
    it('shows size error for file > 5 MB', async () => {
      renderUpload({ photoUrl: null });

      const input = screen.getByLabelText('Select therapist photo');
      const oversizeFile = makeFile('photo.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1);

      Object.defineProperty(input, 'files', {
        value: [oversizeFile],
        configurable: true,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/too large/i)).toBeInTheDocument();
      });
    });

    it('does not show an error for file exactly at 5 MB', async () => {
      const { uploadTherapistPhoto } = await import('../../../../../../actions/therapists');
      vi.mocked(uploadTherapistPhoto).mockResolvedValue({
        success: true,
        data: {
          id: 'abc',
          studioId: 'studio-1',
          name: 'Ana Martinez',
          role: 'Therapist',
          phone: null,
          email: null,
          notes: null,
          photoUrl: 'https://example.com/new.jpg',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      renderUpload({ photoUrl: null });
      const input = screen.getByLabelText('Select therapist photo');
      const exactFile = makeFile('photo.jpg', 'image/jpeg', 5 * 1024 * 1024);

      Object.defineProperty(input, 'files', {
        value: [exactFile],
        configurable: true,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.queryByText(/too large/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('client-side type validation', () => {
    it('shows type error for non-image file (PDF)', async () => {
      renderUpload({ photoUrl: null });

      const input = screen.getByLabelText('Select therapist photo');
      const badFile = makeFile('doc.pdf', 'application/pdf', 100);

      Object.defineProperty(input, 'files', {
        value: [badFile],
        configurable: true,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });
    });

    it('shows type error for text/plain file', async () => {
      renderUpload({ photoUrl: null });

      const input = screen.getByLabelText('Select therapist photo');
      const badFile = makeFile('file.txt', 'text/plain', 100);

      Object.defineProperty(input, 'files', {
        value: [badFile],
        configurable: true,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });
    });

    it('accepts image/webp type', async () => {
      const { uploadTherapistPhoto } = await import('../../../../../../actions/therapists');
      vi.mocked(uploadTherapistPhoto).mockResolvedValue({
        success: true,
        data: {
          id: 'abc',
          studioId: 'studio-1',
          name: 'Ana Martinez',
          role: 'Therapist',
          phone: null,
          email: null,
          notes: null,
          photoUrl: 'https://example.com/new.webp',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      renderUpload({ photoUrl: null });
      const input = screen.getByLabelText('Select therapist photo');
      const webpFile = makeFile('photo.webp', 'image/webp', 100);

      Object.defineProperty(input, 'files', {
        value: [webpFile],
        configurable: true,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('hidden file input has an accessible label', () => {
      renderUpload({ photoUrl: null });
      expect(screen.getByLabelText('Select therapist photo')).toBeInTheDocument();
    });

    it('error is announced via role=alert', async () => {
      renderUpload({ photoUrl: null });
      const input = screen.getByLabelText('Select therapist photo');
      const badFile = makeFile('doc.pdf', 'application/pdf', 100);

      Object.defineProperty(input, 'files', {
        value: [badFile],
        configurable: true,
      });
      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
