---
name: GPS route recording & maneuver heatmap
description: How GPS tracking is recorded during guided assessments and surfaced as a heatmap for instructors
---

# GPS route recording & maneuver heatmap

## Schema
- `assessments.route_path` — `jsonb` nullable, stores `{lat, lng, ts}[]` breadcrumbs captured during the assess step (every 5 seconds via `watchPosition` + `setInterval`)
- `maneuver_results.lat` / `.lng` — `doublePrecision` nullable, captured at the moment the instructor taps a competency level button

## Express routing
- `GET /assessments/heatmap` must be declared **before** `GET /assessments/:id` in the Express router or "heatmap" gets matched as `:id`.
- **Why:** Express matches routes in declaration order; literal path segments beat parameterised ones only if declared first.

## Orval-generated hook options
- Passing `{ query: { enabled: false } }` alone fails TypeScript because `UseQueryOptions` requires `queryKey`.
- Always pair `enabled` with `queryKey`: `{ query: { enabled: !!id, queryKey: getGet<X>QueryKey(params) } }`
- **Why:** TanStack Query v5 makes `queryKey` required in `UseQueryOptions`; Orval exposes the `getGet<X>QueryKey()` helper to satisfy this.

## Frontend GPS tracking
- Geolocation is started in a `useEffect` that fires when `step === "assess"` and cleaned up when leaving that step.
- `routePointsRef` and `currentPositionRef` are `useRef` (not state) to avoid re-renders on every GPS tick.
- The accumulated `routePointsRef.current` array is sent as `routePath` when the assessment is saved (only if non-empty).

## Heatmap visualisation
- Uses overlapping `CircleMarker` components (radius 18, opacity 0.35) from react-leaflet — no extra package needed.
- Density effect comes from transparency stacking: many overlapping circles create visually brighter/darker zones.
- Colour-coded by competency level (green=mastered, yellow=practiced, red=attempted, gray=not_attempted).
- Instructors see their own data only; admins see school-wide data (enforced server-side by role).
