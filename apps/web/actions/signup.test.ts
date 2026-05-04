/**
 * signup server action tests.
 *
 * Tests the submitSignup action behavior with mocked fetch:
 *   - 201 response returns { success: true }
 *   - 429 response returns { success: false, error: 'rate_limit' }
 *   - 500 response returns { success: false, error: 'generic_error' }
 *   - Network failure returns { success: false, error: 'generic_error' }
 *
 * Ticket: CU-869d4za07
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after stubbing
import { submitSignup } from './signup';

const validPayload = {
  email: 'owner@studio.com',
  studioName: 'Test Studio',
  contactPhone: '+52 984 000 0000',
  description: 'A great massage studio',
  locale: 'en',
};

describe('submitSignup', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns success: true when API responds with 201', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ status: 'pending' }),
    });

    const result = await submitSignup(validPayload);
    expect(result.success).toBe(true);
  });

  it('returns success: true for duplicate emails (BE de-duplication, still 201)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ status: 'pending' }),
    });

    const result = await submitSignup(validPayload);
    expect(result.success).toBe(true);
  });

  it('returns rate_limit error when API responds with 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    const result = await submitSignup(validPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('rate_limit');
    }
  });

  it('returns generic_error when API responds with 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await submitSignup(validPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('returns generic_error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await submitSignup(validPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('sends locale in request body per GATE 2 amendment', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ status: 'pending' }),
    });

    await submitSignup({ ...validPayload, locale: 'es' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const callArgs = mockFetch.mock.calls[0]!;
    const requestBody = JSON.parse(callArgs[1].body as string);
    expect(requestBody.locale).toBe('es');
  });

  it('sends all required fields in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ status: 'pending' }),
    });

    await submitSignup(validPayload);

    const callArgs = mockFetch.mock.calls[0]!;
    const requestBody = JSON.parse(callArgs[1].body as string);
    expect(requestBody.email).toBe('owner@studio.com');
    expect(requestBody.studioName).toBe('Test Studio');
    expect(requestBody.description).toBe('A great massage studio');
  });
});
