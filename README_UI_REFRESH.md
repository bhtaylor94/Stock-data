UI REFRESH PACKAGE
=================

This zip contains the UI-safe adapter + component scaffold to:
• Display Stock decisions
• Display Options + Unusual Activity
• Safely render confidence, evidence, and gates
• Prevent deploy-breaking JSON mismatches

Folders:
- lib/uiSafe       → Safe parsing helpers
- app/components   → Core UI building blocks

How to use:
1. Drop folders into your repo root
2. Import adapters in your page components
3. Wrap existing API responses with adapters before rendering

No backend changes required.
