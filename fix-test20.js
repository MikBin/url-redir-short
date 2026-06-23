const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', 'utf8');

file = file.split("  it('filters by action query parameter correctly', async () => {")[0];
file += `  it('filters by action query parameter correctly', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ action: 'create' })

    // First query: fetch link
    const mockSingleSelect1 = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect1 = vi.fn(() => ({ single: mockSingleSelect1 }));
    const mockSelect1 = vi.fn(() => ({ eq: mockEqSelect1 }));

    // Second query: fetch log
    const mockRange = vi.fn().mockResolvedValue({ data: [{ action: 'create' }], count: 1, error: null });
    const mockEqAction = vi.fn(() => ({ range: mockRange }));
    const mockOrder = vi.fn(() => ({ eq: mockEqAction, range: mockRange })); // the code calls order(), then optionally eq()
    const mockEqLinkId = vi.fn(() => ({ order: mockOrder }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEqLinkId }));

    const mockDb = {
      from: vi.fn((table) => {
         if (table === 'links') {
            return { select: mockSelect1 }
         } else {
            return { select: mockSelect2 }
         }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result.entries).toEqual([{ action: 'create' }])
    expect(mockEqAction).toHaveBeenCalledWith('action', 'create')
  })
})
`;

fs.writeFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', file);
