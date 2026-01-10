UI Refresh (Phase: UI-Foundation)
================================

This repo includes a small, non-breaking UI foundation to help keep the frontend
stable as API response shapes evolve:

- lib/uiSafe/safe.ts
  Defensive parsing helpers (asNumber/asString/asBool/asArray/pick).

- app/components/core/Card.tsx, Badge.tsx
  Minimal, consistent UI building blocks.

These files are additive and do not change backend logic.

IMPORTANT (GitHub Push)
-----------------------
This repo includes .github/workflows/ci.yml. If you push using a Personal Access Token (PAT),
GitHub may reject the push unless the PAT includes the `workflow` scope. If you hit:

  "refusing to allow a Personal Access Token to create or update workflow"

Then either:
1) Create a new PAT including `workflow` scope, OR
2) Delete .github/workflows/ci.yml before committing/pushing.
