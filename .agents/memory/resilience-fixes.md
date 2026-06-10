---
name: Resilience & poka-yoke fixes
description: Key type changes and patterns from the 5 architectural vulnerability fixes — needed for consistency in future work.
---

## moderationService / scanContent — discriminated union

`OpenCaseResult` (moderationService.ts) is now a discriminated union:
- `{ ok: true; caseId: number | null; status: "approved" | "quarantined" | "flagged" }`
- `{ ok: false; caseId: null; status: "scan_error" }`

`ContentScanDecision.moderationCaseId` (scanContent.ts) is now `number | null` — NOT `number`.

**Why:** The old failure path returned `{ caseId: 0, status: "flagged" }` which was indistinguishable from a real flagged case. Callers couldn't detect infrastructure failures.

**How to apply:** Any route that receives a `ContentScanDecision` must use `scan.moderationCaseId ?? null` (not `scan.moderationCaseId > 0 ? ... : null` — that fails TS on `null`). The `contentStatus` union now also includes `"scan_error"`.

## Error boundaries — 3-level hierarchy

- Root: `main.tsx` wraps `<App />` with `<ErrorBoundary level="root">` → full-page refresh prompt
- Page: `App.tsx` wraps `<Switch>` with `<ErrorBoundary level="page">` → page-level fallback, sidebar survives
- Widget: individual high-risk components (heatmap Leaflet map) wrapped with `<ErrorBoundary level="widget">` → inline fallback, rest of page survives

Component at `artifacts/driving-app/src/components/ErrorBoundary.tsx`.

**Why:** Zero boundaries previously — one crashing component white-screened the entire app.

## useLessonDraft — IndexedDB WAL for guided lessons

Hook at `artifacts/driving-app/src/hooks/useLessonDraft.ts`. Exports `{ saveDraft, loadDraft, clearDraft }`.

- GPS interval (every 5 s) calls `saveDraft` using `currentStateRef` to avoid stale closures.
- `currentStateRef` is kept in sync with all reactive state via a `useEffect`.
- On mount, `loadDraft()` checks for a <24h draft and shows a recovery banner.
- On successful server save, `clearDraft()` removes the IndexedDB entry.

**Why:** GPS route points and maneuver results were RAM-only; a single network failure at save time lost 60+ minutes of lesson data.

## Mutation retry — queryClient

`queryClient.ts` now has `mutations.retry: (failureCount, error) => !isAuthError && failureCount < 3` with exponential backoff (`retryDelay: min(1000 * 2^n, 15000)`). Previously mutations had zero retries.

## Zod validation — server mutation routes

All mutation routes now use `safeParse` before DB writes:
- `POST /assessments`, `PATCH /assessments/:id`, `POST /assessments/:id/results` — assessments.ts
- `PUT /intake/:studentId` — intake.ts
- `PATCH /students/:id/medical` — students.ts (10 KB / 5 KB size limits before encryption)

## Audit log fallback

`logAudit()` catch block now calls `logger.warn({ event: "audit_db_failure", entry, err })` before silently swallowing the error. Guarantees forensic traceability via structured log even when the DB write fails.
