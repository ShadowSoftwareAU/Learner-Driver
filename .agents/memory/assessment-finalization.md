---
name: Assessment finalization workflow
description: How the draft→pending_approval→approved→dispatched lifecycle works for assessments
---

## The states
- `draft` — created but not yet submitted (assessments created before this feature existed will show draft)
- `pending_approval` — instructor has saved the assessment and it's awaiting their own review/approval
- `approved` / `dispatched` — instructor approved, dispatch emails recorded (same DB update, dispatched is the terminal state)

## DB columns added (assessmentsTable)
- `finalizationStatus` text NOT NULL default 'draft'
- `approvedAt` timestamp nullable
- `approvedByUserId` integer nullable
- `reportDispatchedAt` timestamp nullable
- `reportDispatchedTo` text nullable (JSON array of email strings)

## API routes
- `POST /assessments/:id/submit` — draft → pending_approval, also sets status='completed'; returns 409 if already submitted
- `POST /assessments/:id/approve` — pending_approval → dispatched; body: `{ dispatchEmails: string[], notes?: string }`; returns 409 if not in pending_approval state
- Both check instructor ownership; both logAudit

## Frontend flow
1. `guided-assessment.tsx` calls `submitForApproval.mutateAsync({ id })` immediately after `saveResults` succeeds
2. `assessment-detail.tsx` reads `finalizationStatus` and shows a coloured banner (amber for pending, teal for dispatched)
3. "Preview Report" button always visible → opens a right Sheet with `<ReportPreview>`
4. "Approve & Dispatch" button visible only when `finalizationStatus === 'pending_approval'` → dialog with email tag input
5. `ReportPreview` is a standalone component in `src/components/ReportPreview.tsx` — also used from the Sheet footer which offers Approve & Dispatch directly

**Why:** Spec (Wave 0.5 from 2026-06-12 meeting) — alpha user Rachael needs to review and approve before report goes to student. Prevents accidental dispatch of incomplete or incorrect notes.
