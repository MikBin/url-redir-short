import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../../src/adapters/http/server';
import { HandleRequestUseCase } from '../../../src/use-cases/handle-request';

// Utility to mock handle request use case
const createMockUseCase = (result: unknown = null): HandleRequestUseCase => {
  return {
    execute: vi.fn().mockResolvedValue(result)
  } as unknown as HandleRequestUseCase;
};

// Mock @hono/node-server/conninfo to prevent errors during testing
vi.mock('@hono/node-server/conninfo', () => ({
  getConnInfo: vi.fn(() => ({ remote: { address: '127.0.0.1' } }))
}));

describe('Server Adapter', () => {
  it('should return 405 for methods other than GET, POST, HEAD', async () => {
    const app = createApp(createMockUseCase());
    const req = new Request('http://localhost/', { method: 'PUT' });
    const res = await app.request(req);

    expect(res.status).toBe(405);
    expect(await res.text()).toBe('Method not allowed');
  });

  it('should respond to /health', async () => {
    const app = createApp(createMockUseCase());
    const req = new Request('http://localhost/health');
    const res = await app.request(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('should generate password HTML form on password_required result', async () => {
    const mockUseCase = createMockUseCase({ type: 'password_required', error: true });
    const app = createApp(mockUseCase);

    const req = new Request('http://localhost/protected');
    const res = await app.request(req);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Incorrect password');
    expect(html).toContain('<form method="POST" action="">');
  });

  it('should parse POST body for password when evaluating passwordProvider', async () => {
    // The passwordProvider is passed as a callback to the use case.
    // We will simulate the use case calling it to retrieve the password.
    let capturedProvider: () => Promise<string | undefined>;

    const mockUseCase = {
      execute: vi.fn().mockImplementation((path, headers, ip, url, passwordProvider) => {
        capturedProvider = passwordProvider;
        return null;
      })
    } as unknown as HandleRequestUseCase;

    const app = createApp(mockUseCase);

    const formData = new URLSearchParams();
    formData.append('password', 'secret-pass');

    const req = new Request('http://localhost/protected', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    await app.request(req);

    // Evaluate the captured provider
    const result = await capturedProvider!();
    expect(result).toBe('secret-pass');
  });

  it('should safely ignore unparseable POST body for passwordProvider', async () => {
    let capturedProvider: () => Promise<string | undefined>;

    const mockUseCase = {
      execute: vi.fn().mockImplementation((path, headers, ip, url, passwordProvider) => {
        capturedProvider = passwordProvider;
        return null;
      })
    } as unknown as HandleRequestUseCase;

    const app = createApp(mockUseCase);

    const req = new Request('http://localhost/protected', {
      method: 'POST',
      body: 'invalid-body',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    await app.request(req);

    const result = await capturedProvider!();
    expect(result).toBeUndefined();
  });
});
