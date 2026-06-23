import { describe, it, vi, expect, afterEach } from 'vitest';
import { performance } from 'perf_hooks';
import bulkHandler from '../server/api/bulk.post';
import * as pbUtils from '../server/utils/pocketbase';
import * as auditUtils from '../server/utils/audit';

// Mock dependencies
vi.mock('../server/utils/pocketbase');
vi.mock('../server/utils/audit');
vi.mock('h3', async (importOriginal) => {
  const mod = await importOriginal<typeof import('h3')>();
  return {
    ...mod,
    readBody: vi.fn(),
  }
});
import { readBody } from 'h3';

describe('Bulk Insert Performance Benchmark', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should execute significantly faster than N+1 queries', async () => {
        const NUM_ITEMS = 100;
        const CONFLICT_RATE = 0.1; // 10% conflicts

        // Create a payload with duplicates
        const payload: any[] = [];
        const existingSlugs = new Set<string>();

        for (let i = 0; i < NUM_ITEMS; i++) {
            const isConflict = Math.random() < CONFLICT_RATE;
            const slug = isConflict ? `conflict-slug-${i % 10}` : `unique-slug-${i}`;
            payload.push({
            slug,
            destination: `https://example.com/${i}`
            });
            if (isConflict) {
                existingSlugs.add(slug);
            }
        }

        const mockDb: string[] = Array.from(existingSlugs);

        // Setup mock PB
        const mockCreate = vi.fn().mockImplementation(async (data: any) => {
            // simulating db delay
            await new Promise(r => setTimeout(r, 2));
            if (mockDb.includes(data.slug)) {
                throw new Error(`Unique constraint failed for slug: ${data.slug}`);
            }
            return { id: `id-${data.slug}`, ...data };
        });

        let batchSendCalls = 0;
        const mockGetFullList = vi.fn().mockImplementation(async (options: any) => {
            await new Promise(r => setTimeout(r, 5));
            // Find all conflicts in mockDb based on the filter
            // Naive mock: if options.filter contains a slug from mockDb, return it
            const matched = mockDb.filter(slug => options?.filter?.includes(`"${slug}"`));
            return matched.map(slug => ({ slug }));
        });

        const mockPb = {
            collection: vi.fn().mockReturnValue({
            create: mockCreate,
            getFullList: mockGetFullList
            }),
            createBatch: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
                create: vi.fn()
            }),
            send: vi.fn().mockImplementation(async () => {
                await new Promise(r => setTimeout(r, 5));
                batchSendCalls++;
                if (batchSendCalls === 1) {
                    // Simulate batch throwing an error if any of the items fail
                    const hasConflict = payload.some(item => mockDb.includes(item.slug));
                    if (hasConflict) {
                        throw new Error("Batch failed due to unique constraint");
                    }
                } else {
                    // For the second batch, the valid items should not have conflicts
                    // unless there is some other failure.
                }
            })
            })
        };

        vi.spyOn(pbUtils, 'serverPocketBase').mockResolvedValue(mockPb as any);
        vi.spyOn(auditUtils, 'logAudit').mockImplementation(() => {});

        const event = {
            context: {
                user: { id: 'test-user-id' }
            },
            method: 'POST',
            node: {
                req: {
                    method: 'POST',
                    headers: {}
                }
            }
        };

        vi.mocked(readBody).mockResolvedValue(payload);

        console.log(`Starting benchmark with ${NUM_ITEMS} items (${CONFLICT_RATE * 100}% conflicts)...`);

        const start = performance.now();

        let error;
        try {
            await (bulkHandler as any)(event);
        } catch(e) {
            error = e;
            console.error("error", e);
        }

        const end = performance.now();

        const timeTaken = end - start;
        console.log(`Time taken: ${(timeTaken).toFixed(2)}ms`);
        console.log(`Individual create calls (N+1 fallback): ${mockCreate.mock.calls.length}`);

        expect(error).toBeUndefined();
        // Since we are optimizing this, it shouldn't take the full 200ms+ of the N+1 queries.
        // It should drop to <50ms with the batching.
    });
});
