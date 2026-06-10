---
name: Map click + Radix Dialog dismiss race
description: Clicking a Leaflet map to open a Radix Dialog causes the dialog to immediately close — fix and why.
---

## Rule
When a Leaflet map click event triggers `setState` that opens a Radix Dialog, always defer the state update by one tick with `setTimeout(() => setState(...), 0)`.

**Why:** Leaflet fires a `click` event on the map. If that handler synchronously sets state to open a Radix Dialog, Radix mounts the dialog during the same browser event cycle. Radix's outside-click dismiss handler then sees this same click as "outside the dialog" and immediately closes it — before the user ever sees it.

**How to apply:** In any `onMapClick` or Leaflet event handler that opens a Radix Dialog/Sheet/Popover:
```ts
onMapClick={(lat, lng) => {
  setAddMode(false);
  setTimeout(() => setPendingLatLng({ lat, lng }), 0); // defer past click event
}}
```
The `setTimeout(fn, 0)` defers the React state update to the next microtask tick, after the click event has fully propagated and Radix's dismiss listener has already processed it.
