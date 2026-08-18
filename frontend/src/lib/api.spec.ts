/**
 * Tests for lib/api.ts
 */

// Save original fetch
const originalFetch = global.fetch;

beforeEach(() => {
  // Reset fetch mock before each test
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// Import after mocking
import { apiGet, apiPost } from './api';

describe('apiGet', () => {
  it('requests JSON resources without credentials or a body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ key: 'three-grid' }]),
    });

    await expect(apiGet('/games/catalog')).resolves.toEqual([{ key: 'three-grid' }]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/games/catalog'),
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
  });
});

describe('apiPost', () => {
  it('should make a POST request with JSON body', async () => {
    const mockResponse = { user: { id: '1' }, token: 'abc' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await apiPost('/auth/guest', { username: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/guest'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test' }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('should throw on non-ok response with server message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid username' }),
    });

    await expect(apiPost('/auth/guest', { username: '' })).rejects.toThrow(
      'Invalid username',
    );
  });

  it('should throw with HTTP status fallback when JSON parse fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(apiPost('/test', {})).rejects.toThrow('Request failed');
  });

  it('should use default API URL when env not set', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiPost('/test', {});

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:8000/test'),
      expect.anything(),
    );
  });
});
