---
name: Dialog z-index & Leaflet conflict
description: Radix/shadcn Dialog renders behind Leaflet map controls — root cause and fix.
---

## Rule
Any modal/dialog rendered on a page that contains a Leaflet map must use z-index > 1000.

**Why:** Leaflet's control pane sits at z-index 1000 within the document stacking context, because the `MapContainer` div has no explicit z-index so it doesn't create its own stacking context. The shadcn Dialog uses `z-50` (z-index: 50) by default, which is below Leaflet controls. The dialog panel renders behind the map.

**How to apply:** `artifacts/driving-app/src/components/ui/dialog.tsx` — both `DialogOverlay` and `DialogContent` have been bumped from `z-50` to `z-[2000]`. This is already done. Do not revert it. If a future refactor re-scaffolds dialog.tsx from shadcn CLI, remember to re-apply `z-[2000]`.
