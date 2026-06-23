const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/analytics/collect.test.ts', 'utf8');

file = file.replace(/      }\n   }\)\n\n/g, ""); // Attempting to fix syntax error

// Just truncate and rewrite the last test
file = file.split("  it('handles caching logic including errors and cache hits', async () => {")[0];

file += `  it('handles caching logic including errors and cache hits', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true } as any)
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ path: 'path', destination: 'https://example.com', status: 200 })

    const mockDb = {
      from: vi.fn(() => ({
         insert: vi.fn().mockResolvedValue({ error: null })
      })),
      rpc: vi.fn().mockResolvedValue({ error: null })
    }
    vi.mocked(serverSupabaseServiceRole).mockReturnValue(mockDb as any)

    // Test cache miss and setex error
    const getMock = vi.fn().mockRejectedValueOnce(new Error('redis get error')).mockResolvedValueOnce('link-123')
    const setexMock = vi.fn().mockRejectedValue(new Error('redis set error'))
    const { useValkey } = await import('../../../../server/utils/storage')
    vi.mocked(useValkey).mockReturnValue({ get: getMock, setex: setexMock } as any)

    const waitUntil = vi.fn(async (task) => { await task; });

    let result = await handler({ node: { req: { headers: {}, socket: {} } }, waitUntil } as any)
    expect(result.success).toBe(true)
    await waitUntil.mock.results[0].value;

    result = await handler({ node: { req: { headers: {}, socket: {} } }, waitUntil } as any)
    expect(result.success).toBe(true)
    await waitUntil.mock.results[1].value;
  })

  it('handles background ingestion task crash if error in waitUntil catch', async () => {
     vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true } as any)
     vi.mocked((globalThis as any).readBody).mockResolvedValue({ path: 'path', destination: 'https://example.com', status: 200 })

     const mockDb = {
        from: vi.fn(() => { throw new Error('critical error') }) // throw synchronously to fail task
     }
     vi.mocked(serverSupabaseServiceRole).mockReturnValue(mockDb as any)

     const result = await handler({ node: { req: { headers: {}, socket: {} } } } as any)
     expect(result.success).toBe(true)
     await new Promise(r => setTimeout(r, 10));
  })
})
`;

fs.writeFileSync('admin-service/supabase/tests/unit/api/analytics/collect.test.ts', file);
