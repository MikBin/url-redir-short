import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as qr from '../server/utils/qr';
import { createEvent, toWebRequest } from 'h3';

// Need to mock globally
import * as h3 from 'h3';

vi.mock('../server/utils/qr', () => ({
  generateQRCode: vi.fn()
}));

// Mock h3 globals manually here since this test needs them before importing the handler
vi.stubGlobal('defineEventHandler', h3.defineEventHandler);
vi.stubGlobal('createError', h3.createError);
vi.stubGlobal('getQuery', h3.getQuery);

// Lazy import to allow global stubs to be set up first
const getHandler = () => import('../server/api/qr.get').then(m => m.default);

describe('QR Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (url: string, user: unknown = { id: 'user1' }) => {
    return {
      node: {
        req: { method: 'GET', url, headers: {} },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: { user },
      path: url
    } as unknown;
  }

  it('should return QR code on success', async () => {
    vi.mocked(qr.generateQRCode).mockResolvedValue('qr-data-url');
    // Note: uses "width" in query, not "size" based on code
    const event = createMockEvent('/api/qr?text=hello&width=200&margin=2');
    const handler = await getHandler();
    const result = await handler(event);

    expect(result).toBe('qr-data-url');
    expect(qr.generateQRCode).toHaveBeenCalledWith('hello', expect.objectContaining({ width: 200, margin: 2 }));
  });

  it('should handle optional styling properties', async () => {
    vi.mocked(qr.generateQRCode).mockResolvedValue('qr-data-url');
    const event = createMockEvent('/api/qr?text=hello&color=%23FF0000&bgcolor=%23000000');
    const handler = await getHandler();
    const result = await handler(event);

    expect(result).toBe('qr-data-url');
    expect(qr.generateQRCode).toHaveBeenCalledWith('hello', expect.objectContaining({ color: { dark: '#FF0000', light: '#000000' } }));
  });

  it('should throw 400 if text is missing', async () => {
    const event = createMockEvent('/api/qr?width=200');
    const handler = await getHandler();
    await expect(handler(event)).rejects.toThrow('Text query parameter is required');
  });

  it('should throw 500 if generation fails', async () => {
    vi.mocked(qr.generateQRCode).mockRejectedValue(new Error('Generation failed'));
    const event = createMockEvent('/api/qr?text=hello');
    const handler = await getHandler();
    await expect(handler(event)).rejects.toThrow('Failed to generate QR code');
  });

  it('should throw 401 if not authenticated', async () => {
    const event = createMockEvent('/api/qr?text=hello', null);
    const handler = await getHandler();
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });
});
