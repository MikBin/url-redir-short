# LikeC4 Architecture Model

This directory contains the **C4 architecture-as-code model** for the Universal Redirector System, built with [LikeC4](https://likec4.dev/).

> **Looking for architecture documentation?**
> → Full arc42 document: [`../arc42/arc42.md`](../arc42/arc42.md)
> → ADRs: [`../adrs/`](../adrs/)
> → Static diagram exports: [`../diagrams/`](../diagrams/)

---

## Quickstart

```bash
# From this directory
cd docs/architecture/likec4

# Start local interactive viewer
npm start
# → Open http://localhost:6422

# Export PNGs into docs/architecture/diagrams/
npm run export
```

---

## What this model captures

| View | Description |
|------|-------------|
| **System Context** | Actors (Admin User, End User) and top-level containers |
| **Admin Service Components** | Nitro API routes, Realtime plugin, SSE Broadcaster, CF KV Publisher, Transformer |
| **Engine (Node) — Hexagonal** | Ports (IRedirectStore, ISyncManager), InMemoryStore, SSESyncAdapter, RadixTree, CuckooFilter, use cases |
| **Engine (CF Worker) — Hexagonal** | CloudflareKVStore, NoOpSyncAdapter, same use cases with different adapters |
| **Deployment** | VPS/Docker (Node engine + Admin) vs Cloudflare Workers (Worker engine) |

---

## Maintaining the model

Update `architecture.c4` alongside significant code changes:
- New adapters or ports
- Changed container relationships
- Deployment topology changes

After updating, re-export static PNGs:

```bash
npm run export
```

Commit the `.c4` model and regenerated PNGs together.