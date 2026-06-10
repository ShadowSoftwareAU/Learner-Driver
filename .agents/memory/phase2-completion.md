---
name: Phase 2 completion state
description: What was done in Phase 2, key gaps that existed, and what the build state looked like at completion.
---

## Rule
When starting a new session on this project, run `pnpm --filter @workspace/api-spec run codegen` and `pnpm --filter @workspace/db run push` if any schema or OpenAPI changes were made since last session. Stale generated files silently cause mismatches.

**Why:** Phase 2 work added ~50 new OpenAPI endpoints but codegen wasn't run between sessions, causing a 90-operationId vs 43-hook mismatch that was invisible at typecheck time.

## What was built in Phase 2

All 26 tasks (T001–T026) are complete across 4 waves:

- **Wave 1 (T001–T011):** DB schema (pedal control, medical/allergy encryption, no-show tracking, viewer code, attendance reliability, audit expansion, notification multi-channel, instructor independence flags). Crypto helper, medical routes, content filtering in handover/assessment write routes, PedalControlSelector, PreLessonBriefingCard, AttendanceReliabilityBadge.
- **Wave 2 (T012–T015):** Notification preferences + push tokens (DB + routes + frontend page). Content filtering service (scanContent, ruleSets, moderationService). Super-admin moderation dashboard + case detail.
- **Wave 3 (T016–T021):** driving_schools, school_instructors, viewer_links, subscriptions, feature_entitlements, booking_change_requests schemas. authz policy layer. /schools, /viewer-links routes. School-admin area (dashboard, settings, booking-approvals). Viewer role pages.
- **Wave 4 (T022–T026):** Stripe skeleton + billing routes. Calendar permission hierarchy + booking change request approval flow. Booking approval UI. Demo mode (server + frontend). Billing placeholder pages.

## The one genuine gap

**Session inactivity timeout** — was not implemented anywhere before this session.

Built:
- `artifacts/driving-app/src/hooks/useInactivityTimeout.ts` — tracks idle time via activity event listeners, fires warn at 25min and expire at 30min
- `artifacts/driving-app/src/components/SessionTimeoutWarning.tsx` — countdown modal with "Stay signed in" / "Sign out now" buttons
- `SessionTimeoutManager` component in App.tsx — only activates when `isSignedIn`, uses useInactivityTimeout + renders the warning modal

## How to verify the app is fully wired

```
pnpm --filter @workspace/api-server run typecheck  # should be clean
pnpm --filter @workspace/driving-app run typecheck # should be clean
```

Both pass clean at Phase 2 completion.
