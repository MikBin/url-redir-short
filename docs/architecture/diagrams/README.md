# Diagram Exports

This directory contains static diagram exports generated from the LikeC4 model at [`/likec4/architecture.c4`](../../../likec4/architecture.c4).

Diagrams here are **snapshots** — regenerate them after model changes:

```bash
cd likec4
npx likec4 export png --output ../docs/architecture/diagrams/
```

The source of truth is always the `.c4` model, not the PNGs.
