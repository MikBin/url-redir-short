# Performance Testing Guide

This document describes the comprehensive load testing suite for the redir-engine, covering Cuckoo Filter and Radix Tree performance under various stress conditions.

## Overview

The performance testing strategy includes:
1. **Unit-level benchmarks** - Core data structure performance
2. **Integration tests** - Full request flow under load
3. **Real-world simulations** - Traffic patterns and scaling limits

## Running Performance Tests

### Benchmark Tests (Cuckoo Filter & Radix Tree)

Run all performance benchmarks:
```bash
npm run test:perf
```

Watch mode for iterative optimization:
```bash
npm run test:perf:watch
```

Run specific benchmark:
```bash
npx vitest run tests/perf/cuckoo-filter.bench.ts
npx vitest run tests/perf/radix-tree.bench.ts
```

### Load & Integration Tests

Run the full performance E2E test:
```bash
npm run test:e2e:performance
```

Run all E2E tests:
```bash
npm run test:e2e
```

## Benchmark Details

### Cuckoo Filter Benchmarks (`tests/perf/cuckoo-filter.bench.ts`)

Tests the probabilistic data structure used for O(1) rejection of 404 traffic.

#### Insert Operations
- **1K items**: Insert 1,000 items into filter
- **10K items**: Insert 10,000 items (higher load, potential collisions)
- **100K items**: Stress test with 100,000 items

**Goal**: < 1μs per insert

#### Lookup Operations
- **Hit scenarios**: Lookup existing items (best case, tests cache locality)
- **Miss scenarios**: Lookup non-existent items (typical case for 404 rejection)
- **Batch lookups**: 10 lookups in sequence (realistic traffic pattern)

**Goal**: < 100ns per lookup, miss ≈ hit

#### Remove Operations
- **Deletes from varying sizes**: Tests removal efficiency
- **Cascading deletes**: Multiple removes to test refactoring

**Goal**: < 1μs per remove

#### Mixed Workload
- **60% inserts, 30% lookups, 10% removes**: Realistic operation mix
- Tests at both 1K and 10K scale

#### Memory Profiling
- Measures heap usage at different fill factors (50%, 80%)
- Ensures predictable memory footprint

### Radix Tree Benchmarks (`tests/perf/radix-tree.bench.ts`)

Tests the custom Radix Tree implementation for routing rules.

#### Insert Operations
- **Shallow paths** (`/p1`, `/p2`): Sequential inserts at root
- **Medium depth** (`/a/b/c1`): 3-segment paths
- **Deep paths** (`/a/b/c/d/e/f/p1`): 7-segment paths
- **Mixed depth**: Random 1-5 segment paths

**Goal**: < 10μs per insert

#### Lookup Operations
- **Shallow lookups**: Fast path in root-level nodes
- **Deep lookups**: Traverse full path depth
- **Miss detection**: Early termination when path not found
- **Batch lookups**: 100 lookups in 100K-item tree

**Goal**: < 1μs per lookup

#### Deep Path Performance
- Measures lookup time at varying depths (1, 5, 10 segments)
- Critical for deeply nested redirect structures

**Goal**: Linear or sub-linear complexity with depth

#### Delete & Update
- **Selective deletes**: Remove subset of rules
- **Non-existent deletes**: Handle missing paths gracefully
- **Updates**: Overwrite existing rules

**Goal**: < 10μs per delete, O(1) update

#### Mixed Workload
- **50% inserts, 40% lookups, 10% deletes**: Realistic operation mix
- Tests at 1K and 10K scale

#### Real-world Patterns
- **User shortcuts** (`/u{user}/s{shortcut}`): Realistic personal links
- **Campaign URLs** (`/camp{id}/link{id}`): Marketing tracking patterns

**Goal**: Consistent performance across realistic path structures

## Load Testing Details

### E2E Performance Tests (`e2e-suite/specs/T12-performance.test.ts`)

Full integration tests simulating real traffic patterns against a live engine.

#### Routing Table Scaling
Tests system behavior as the redirect table grows:
- **1K redirects**: Small deployment
- **10K redirects**: Medium deployment
- **Measures**: Latency (avg, p95, p99) for random lookups

**Threshold**: 
- 1K: avg < 100ms, p99 < 200ms
- 10K: avg < 150ms, p99 < 300ms

#### Concurrent Request Load
Simulates multiple simultaneous requests:
- **10 parallel**: Light load
- **50 parallel**: Medium load
- **100 parallel**: Heavy load

**Measures**: Per-request latency under concurrency
**Threshold**: avg < 500ms at 100 concurrent

#### 404 Rejection Performance
Validates that Cuckoo Filter provides O(1) rejection:
- Mix of 50% valid and 50% non-existent paths
- Measures latency separately for hits vs. misses
- Validates that misses are faster (rejected early)

**Threshold**: Miss latency ≈ Hit latency (within 10ms)

#### Hot Path Performance
Real-world traffic follows 80/20 rule:
- 80% of requests go to 20% of redirects
- Tests if caching/optimization benefits hot paths

**Threshold**: avg < 150ms, p99 < 300ms

#### Real-world Simulation
Sustained load test:
- **Duration**: 10 seconds
- **Target rate**: 50 requests/second
- **Pattern**: Continuous traffic with random path distribution

**Measures**: 
- Total requests completed
- Batch latency over time
- Consistency and stability

**Threshold**: avg batch < 200ms, p99 < 400ms

## Performance Baselines

These are target baselines for a healthy system:

### Cuckoo Filter
| Operation | Scale | Target | Unit |
|-----------|-------|--------|------|
| Insert | 1K | <1 | μs |
| Insert | 100K | <1 | μs |
| Lookup (hit) | 100K | <100 | ns |
| Lookup (miss) | 100K | <100 | ns |
| Remove | 10K | <1 | μs |

### Radix Tree
| Operation | Scale | Depth | Target | Unit |
|-----------|-------|-------|--------|------|
| Insert | 1K | 1 | <10 | μs |
| Insert | 100K | 1 | <10 | μs |
| Lookup | 100K | 1 | <1 | μs |
| Lookup | 100K | 5 | <5 | μs |
| Lookup | 100K | 10 | <10 | μs |
| Delete | 10K | 1 | <10 | μs |

### System (HTTP)
| Scenario | Load | Target Avg | Target P99 |
|----------|------|-----------|-----------|
| 1K redirects | Random | <100ms | <200ms |
| 10K redirects | Random | <150ms | <300ms |
| 10 concurrent | Random | <200ms | - |
| 50 concurrent | Random | <300ms | - |
| 100 concurrent | Random | <500ms | - |
| 10s sustained @ 50 RPS | Mixed | <200ms | <400ms |

## Interpreting Results

### Memory Growth
- Cuckoo Filter: Should be nearly flat as fill factor increases (O(1) space)
- Radix Tree: Should grow linearly with number of rules

### Latency Distribution
- Looking for normal distribution, not bimodal
- P99 should be < 2x average (indicates good consistency)
- Watch for long-tail latencies (p99.9)

### Concurrency Impact
- Latency should not increase dramatically with concurrency
- If avg latency at 100 concurrent is much > 5x single-threaded, investigate bottlenecks
- Node.js single-threaded nature may show larger increases than multi-threaded systems

### 404 vs 302 Performance
- 404s should be noticeably faster (Cuckoo Filter rejection)
- If 404s are slow, Cuckoo Filter may need tuning
- Measure false positive rate if possible

## Optimization Tips

### For Cuckoo Filter
- Monitor fill factor (target 60-80%)
- If near 100%, increase filter size
- Test different bucket sizes (default 4)
- Consider fingerprint size trade-off (accuracy vs memory)

### For Radix Tree
- Deep paths slower than shallow paths (expected)
- If insertion slows down over time, check memory pressure
- Consider path compression for very deep hierarchies
- Profile memory allocations for frequent updates

### For HTTP Performance
- Check DNS resolution time (use IP addresses in benchmarks)
- Monitor Node.js event loop lag (process.cpuUsage())
- Profile garbage collection pauses
- Consider clustering for multi-core utilization

## Continuous Integration

These benchmarks should be run:
- **Pre-commit**: Quick perf smoke test (1K items only)
- **CI pipeline**: Full benchmark suite + E2E load tests
- **Release**: Extended stress tests (100K+ items)

## Regression Detection

To establish baselines:
```bash
npm run test:perf > baseline.txt
```

Compare new runs:
```bash
npm run test:perf > current.txt
diff baseline.txt current.txt
```

Look for:
- Operations taking > 10% longer
- Memory usage increasing
- Error rates appearing

## Troubleshooting

### High Latency
1. Check system load (`top`, Task Manager)
2. Verify no other processes interfering
3. Profile with Node.js profiler
4. Check for garbage collection pauses

### Inconsistent Results
1. Run multiple times to establish variance
2. Disable CPU frequency scaling
3. Close background applications
4. Run on dedicated hardware if possible

### Memory Issues
1. Check heap snapshot at different scales
2. Look for memory leaks in data structure
3. Profile allocation patterns
4. Consider switching to more efficient library

## Future Enhancements

- [ ] Automated regression detection
- [ ] Performance dashboard with historical data
- [ ] Benchmarking against other routing libraries
- [ ] Multi-core throughput tests
- [ ] Cache hit rate analysis
- [ ] Long-tail latency analysis (p99.9, p99.99)
