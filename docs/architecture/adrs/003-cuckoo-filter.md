# ADR-003: Cuckoo Filter for 404 Rejection

## Status
Accepted

## Context
High-traffic redirectors often face a large volume of requests for non-existent paths (e.g., bots scanning for common vulnerabilities). Checking the Radix Tree or a Database for every 404 request is computationally expensive or adds latency.

## Decision
We implemented a **Cuckoo Filter** as a probabilistic front-gate for all incoming requests.

- If the filter returns `false`, the path definitely does not exist. We can return 404 immediately.
- If the filter returns `true`, the path _likely_ exists, and we proceed to the Radix Tree for a definitive check.

## Rationale
Why Cuckoo Filter instead of a standard Bloom Filter?
1. **Support for Deletions**: When a link is deleted in the Admin Service, we must remove it from the filter. Standard Bloom filters do not support deletion without rebuilding the entire filter. Cuckoo filters support deletion by swapping entries.
2. **Space Efficiency**: For high target false-positive rates, Cuckoo filters can be more space-efficient than Bloom filters.

## Consequences
- **Pros**:
    - Protects the more expensive Radix Tree lookups from junk traffic.
    - O(1) time complexity for 404 rejection.
    - Low memory footprint.
- **Cons**:
    - Potential for false positives (filter says it exists, but Radix Tree says it doesn't). This results in a slightly slower 404, which is acceptable.
    - Complexity of implementation compared to a simple Set.
