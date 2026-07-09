# Replit Agent Handoff Prompt — DriveTrack Phase 2

**Date:** 9 July 2026
**Project:** DriveTrack (Learner Log) — learner-driver assessment and driving school operations platform
**Spec file:** `PHASE_2_BUILD_SPEC.md` (in project root, ~2950 lines, this is the source of truth)

---

## Context

You are building Phase 2 of DriveTrack. Phase 1 is complete and running. The existing app has working instructor assessments, student profiles, handover notes, bookings, availability, zone management, and notifications. You must not break any of that.

Read `PHASE_2_BUILD_SPEC.md` in full before starting. It contains:
- current architecture snapshot (section 1)
- design principles including Lean Six Sigma, SOC2, ISO27001, child safety (section 2)
- delivery wave order (section 3 and section 25.2)
- cross-cutting technical rules for wiring new fields (section 4)
- foundational schema changes (section 5)
- new tables (section 6)
- detailed feature specs (sections 9–20A)
- payment, virtual ledger, and Airwallex payout architecture (section 18.5)
- 9 July 2026 meeting outcomes register (section 20A) — this is the latest and most binding input
- testing and acceptance criteria (sections 26–27)
- identity, duplicate detection, and government validation layer (section 29)
- role hierarchy refinement (section 30)

Also read `replit.md` for stack details, commands, and gotchas.

---

## Execution Order

Build in **five waves**. Complete each wave fully before moving to the next. The app must compile and existing features must keep working after every wave.

### Wave 1 — Bug Fixes, UX Corrections, and Assessment Foundations
This is the immediate priority. These are bugs and missing behaviours reported by the alpha user (Dayv, a driving instructor) on 9 July 2026.

**Files you will change:**
- `artifacts/driving-app/src/pages/instructor/new-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/student-detail.tsx`
- `artifacts/driving-app/src/pages/instructor/handover.tsx`
- `artifacts/driving-app/src/pages/instructor/guided-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/assessment-detail.tsx`
- `artifacts/driving-app/src/pages/admin/verifications.tsx`
- `artifacts/api-server/src/routes/assessments.ts`
- `artifacts/api-server/src/routes/handover.ts`
- `artifacts/api-server/src/routes/students.ts`
- `lib/db/src/schema/assessments.ts`

**Deliverables (section 20A.1 items 1–7, plus item 12):**

1. **Student pre-population in New Assessment.** When navigating from `Students → Student Profile → New Assessment`, pass the student ID through navigation state or URL params. The student selector on the new assessment page must auto-select that student. Do not ask the user to pick the student again.

2. **Duration pre-population from booking.** When an assessment is initiated from a booking context, pull the booking duration (e.g. `120` minutes) into the assessment duration field automatically. Only fall back to manual entry if no booking context exists.

3. **Assessment history on student profile.** The student detail page (`student-detail.tsx`) must query and display completed assessments in the assessment history section. If the query is already there, check the API response and rendering logic — assessments are not appearing. Fix it.

4. **Handover notes persistence.** Notes entered during assessment tasks (too wide, too tight, missed mirror check, forgot indicator) must persist through assessment save and appear in the handover view. Trace the data path from assessment creation through the API to the handover query and fix where it breaks.

5. **Recent assessments clickable.** In the handover or student detail view, recent assessment entries must be clickable. If the logged-in instructor conducted that assessment, clicking opens the full assessment report. If another instructor conducted it, show handover notes only.

6. **Approved instructor queue refresh.** After approving an instructor in the admin verifications page, the approved instructor must disappear from the pending review list without requiring a page refresh. Fix query invalidation or re-fetch.

7. **Report terminology.** Replace all instances of `Mastered` with `Competent` in assessment summaries, reports, and preview components. Reorder the summary display to: `Attempted → Practiced → Competent`.

8. **Pre-drive fitness and safety check.** Add a single tick-box to the pre-drive / safety checks section of the assessment flow. Label: `Student confirms they are well-rested, not stressed, and not affected by any medication, alcohol, or drugs`. This must be acknowledged before the assessment can proceed. Store the acknowledgement timestamp in the assessment record. Display the acknowledgement status in assessment reports.

**Schema changes for Wave 1:**
- Add `preDriveFitnessConfirmedAt` (timestamptz nullable) to `assessments` table
- Add `preDriveFitnessConfirmedByUserId` (integer nullable FK `users.id`) to `assessments` table
- Wire through Drizzle schema → API route → OpenAPI spec → Orval codegen → frontend

**Validation for Wave 1:**
- Navigate to a student, click New Assessment — student must be pre-selected
- Complete an assessment with task-level notes — notes must appear in handover
- View student profile — assessment history must list completed assessments
- Click a recent assessment by the current instructor — full report must open
- Approve an instructor — they must vanish from the queue immediately
- Assessment summary must read Attempted/Practiced/Competent, not Mastered
- Pre-drive fitness check must block assessment start until ticked

---

### Wave 2 — Assessment Logic and Calendar Enhancements
Builds on Wave 1 fixes with smarter assessment behaviour and calendar improvements.

**Deliverables (section 20A.2 items 8–11, section 20A.4 item 32):**

9. **Assessment type filtering by instructor certification.** Read the instructor's verification record. If they have not ticked `Q-Ride` certification, do not show Q-Ride as an assessment type option. Same for `Heavy Vehicle`. Only show assessment types the instructor is certified for.

10. **Remove pedal control for Q-Ride and Heavy Vehicle.** The pedal control selector must only appear for car/Q-Safe assessments. Q-Ride (motorcycle) and Heavy Vehicle assessments do not have dual pedal controls. Conditionally render based on assessment type.

11. **Conditional notes fields by competency state.** When an instructor marks a maneuver task:
    - `Competent` → hide sub-notes (too wide, too tight, etc.) — they are meeting all criteria
    - `Not Attempted` → hide sub-notes — nothing to comment on
    - `Attempted` or `Not Yet Competent` → show multi-select issue tags plus free text field

12. **Mandatory handover notes.** Every assessment save must require handover notes with minimum 20 characters. No-show scenarios still require a note (e.g. "Student no-show, attempted contact, no response"). Validate on both frontend and backend. Block save if missing or too short.

13. **Calendar buffers and break management.** Add to instructor profile or availability settings:
    - `travelBufferMinutes` (integer, e.g. 30)
    - `breakDurationMinutes` (integer, e.g. 60)
    - `breakFrequency` or `breakTimes` (configurable)
    
    The availability/booking system must respect these buffers. If an instructor has a 30-minute travel buffer configured, a new booking cannot be placed within 30 minutes of an existing one. Break windows must block availability slots.

    **Schema:** Add `travelBufferMinutes` and `breakDurationMinutes` to the `instructors` table or `instructor_availability` configuration.
    
    Wire through: Drizzle → API → OpenAPI → codegen → instructor profile UI → availability query logic.

**Validation for Wave 2:**
- Instructor without Q-Ride cert should not see Q-Ride option
- Q-Ride assessment should not show pedal control
- Marking Competent should hide sub-notes; marking Attempted should show them
- Saving assessment without handover notes (or < 20 chars) must be blocked
- Two bookings within 30 mins of each other must be rejected if travel buffer is 30

---

### Wave 3 — Instructor, Academy, and Viewer Structure
Multi-tenancy, team codes, onboarding workflows, compliance, and parent/mentor access.

**Deliverables (section 20A.3 items 13–19, section 20A.6 items 38–42):**

**Academy and instructor structure:**
- Academy team code system — unique code per academy, instructors join by entering code, multi-academy support, academies cannot see other codes held by an instructor
- Two onboarding workflows: solo trader (ABN + own vehicle + full verification = own team code) vs academy instructor (join via code, school manages compliance)
- ABN validation via ABR Lookup API integration
- PI/PL insurance field added to instructor verification (tick + currency letter upload)
- Instructor hourly rate in profile, displayed in booking flow, feeds payment calculations
- Fleet management — multiple vehicles per instructor/academy, auto vs manual tracking, vehicle counts on dashboard
- Compliance front-end display — green tick indicators for Working with Children, Q-Ride, Heavy Vehicle, NDIS, insurance

**Viewer and mentor access:**
- Student nominates parent/mentor via email in registration or profile
- Notification sent with hyperlink and team code
- Parent/mentor account type: view reports, progress, handover notes, guided lessons
- Mentor role (PCYC etc.) can run supervised practice sessions; parent role is view-only
- Academy credit allocation dashboard for NDIS, school grants

**Key schema:** See sections 5, 6, 20A.3, 20A.6, 29, and 30 of the build spec for full table and column definitions. The `driving_schools`, `school_instructors`, `viewer_links`, and `organisation_accounts` tables are the core of this wave.

**Validation for Wave 3:**
- Create academy with team code, join as instructor using that code
- Solo trader onboarding requires ABN validation
- Parent links to student via viewer code, sees progress but not private instructor notes
- Academy dashboard shows fleet, compliance ticks, and credit allocation

---

### Wave 4 — Payment System, Virtual Ledger, and Payouts
This is the financial backbone. Read section 18.5 of the build spec carefully — it defines the full architecture.

**Core principle:** Stripe is pay-in only. The virtual ledger is the internal source of truth. Airwallex handles outbound payouts. Reschedules are ledger updates, not Stripe refunds.

**Deliverables (section 20A.4 items 20–31, section 18.5):**

**Booking and payment flow:**
- Booking request flow with push + email notifications and hourly reminders
- Unassigned job board for academy-level requests
- Teaching zone filtering for availability and job board
- Favourite instructor feature
- Cashless-only enforcement — no cash, all through platform
- 50% deposit at booking, remaining 50% auto-charged 2 hours before lesson
- Pay-in-full option at booking
- Payment verification check when instructor starts New Assessment
- Cancellation within 24hrs = deposit forfeited or converted to platform credit
- Pre-paid credit balances from parents, NDIS, schools — ring-fenced per student

**Virtual ledger and wallet:**
- `wallet_accounts` — balances by owner and account type
- `wallet_transactions` — user-facing wallet events
- `wallet_reservations` — booking-linked reserved amounts
- `ledger_entries` — immutable double-entry accounting rows
- Student wallet funded via Stripe Checkout → webhook → ledger credit
- Booking reserves 50% or 100% from wallet → ledger locks funds
- Reschedule = ledger entry moves reservation, no Stripe refund
- Lesson completion = settlement → funds become payout-eligible

**Payout system:**
- `payout_recipients` — bank details stored securely in profile
- `payouts` — individual payout records with status tracking
- `payout_batches` — grouped payout runs
- `academy_payout_rules` — split/arrangement configuration
- `lesson_financial_settlements` — maps completed lessons to earned balances
- Airwallex integration for programmatic bank transfers
- Two payout pathways: direct-to-instructor OR academy-first with optional auto-split
- Zero-friction onboarding: instructors/academies just provide bank details in profile

**Required profile fields for payout recipients:**
- Account holder name, BSB, account number, business name, ABN
- Recipient type, payout preference (manual/automatic), payout schedule

**Service areas to create:**
- `artifacts/api-server/src/lib/billing/ledger/`
- `artifacts/api-server/src/lib/billing/wallet/`
- `artifacts/api-server/src/lib/billing/payouts/`
- `artifacts/api-server/src/lib/billing/stripe.ts`
- `artifacts/api-server/src/lib/billing/airwallex.ts`

**API endpoints to add:**
- `POST /wallets/checkout-session`
- `POST /wallets/webhooks/stripe`
- `GET /wallets/me`
- `GET /wallets/:studentId/transactions`
- `POST /bookings/:id/reserve-funds`
- `POST /bookings/:id/reallocate-credit`
- `POST /bookings/:id/financial-settlement`
- `GET /payouts/me`
- `POST /payouts/run`
- `POST /payouts/webhooks/airwallex`
- `PATCH /academy-payout-rules/:id`

**Validation for Wave 4:**
- Fund a student wallet through Stripe Checkout test mode
- Webhook creates wallet credit and ledger entries
- Book a lesson with 50% deposit — reservation locks in ledger
- Reschedule booking — credit moves by ledger update only, no Stripe refund
- Complete lesson — settlement creates payout-eligible balance
- Independent instructor payout target = instructor's bank details
- Academy instructor payout target = academy's bank details by default
- Academy can configure split rules for downstream instructor payouts

---

### Wave 5 — Reporting, Compliance, Content Filtering, and Demo Mode
Polish, safety net, and presentation readiness.

**Deliverables (section 20A.5 items 33–37, sections 13, 20):**

**Reporting and compliance:**
- Assessment report includes GPS route map showing area traversed during lesson only
- Audit log enhanced with search/filter by instructor and student name, sorted by timestamp, tracking who viewed which student record
- Student feedback system — push + email 1 hour post-lesson, follow-up next day if not submitted, no follow-up if already submitted
- Academy handover audit dashboard — all handover notes across instructors
- Compliance expiry notifications — automated alerts for document renewals

**Content filtering (section 13):**
- All free-text content (handover notes, assessment notes, booking notes) passes through content filter before delivery
- Flagged content is quarantined, not delivered
- Super-admin moderation dashboard with case review, release, escalate, close
- Law enforcement export capability
- Immutable moderation audit trail with 7-year retention

**Demo mode (section 20):**
- One-click demo data reset for pitches
- Seeded sample school, instructors, students, assessments, bookings
- Scoped to demo tenant only — never touches production data
- Reset action fully audited

**Validation for Wave 5:**
- Completed assessment shows GPS route map
- Audit log is searchable by instructor and student name
- Profane handover note gets quarantined, not delivered
- Super-admin can review and release quarantined content
- Demo reset restores clean sample data

---

## Critical Rules (Apply to Every Wave)

1. **Do not remove existing working features.** Phase 1 must keep working throughout.

2. **Wire every new field end-to-end.** For every new database column:
   - Drizzle schema (`lib/db/src/schema/`)
   - API route validation and response (`artifacts/api-server/src/routes/`)
   - OpenAPI spec (`lib/api-spec/openapi.yaml`)
   - Orval codegen regeneration (`pnpm --filter @workspace/api-spec run codegen`)
   - Frontend hooks and components (`artifacts/driving-app/`)
   - Audit logging where the field involves sensitive or safety-critical data

3. **Preserve mobile-first usability.** Minimum 48px tap targets. iPad portrait and landscape must work. Pre-lesson safety summary must be glanceable in 5 seconds.

4. **Audit everything sensitive.** Every read of restricted student data (medical, licence, safeguarding) must create an audit log entry with actor, role, tenant, action, resource, IP, timestamp, and result.

5. **Use feature flags for staged rollout.** Content moderation enforcement, payment enforcement, viewer payment gate — all behind feature flags. Ship the code, enforce later.

6. **Keep the app compiling.** After every major area within a wave, the app must compile cleanly. Run `pnpm run build` and fix any errors before continuing.

7. **Clerk auth stays.** Extend current Clerk authentication and role flow. Do not replace it.

8. **Role compatibility.** Current `admin` role must continue to work as alias for `school_admin` during migration. Do not break existing admin users.

9. **Encrypted storage for sensitive fields.** Medical conditions, allergies, licence numbers, safeguarding notes — encrypt at rest using env-backed symmetric key. Create helper at `artifacts/api-server/src/lib/crypto.ts`.

10. **Terminology.** The word `Mastered` no longer exists in this product. It is `Competent`. The word is used in assessment summaries, reports, previews, and any UI copy. Find and replace globally.

---

## Commands Reference

```bash
# Run the API server
pnpm --filter @workspace/api-server run dev

# Full typecheck
pnpm run typecheck

# Build all
pnpm run build

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push
```

---

## Gotchas (from replit.md — do not ignore these)

- Use `@clerk/clerk-react` not `@clerk/react`
- Do NOT import `@workspace/api-zod` in the frontend — use `artifacts/driving-app/src/lib/enums.ts`
- After editing routes, restart the API server workflow
- Orval regenerates `lib/api-zod/src/index.ts` on every codegen run — do not add `schemas: { path: "generated/types" }` to zod output config
- `students.userId` is nullable — guard before using
- Instructor-student ownership is checked in TWO places (`routes/students.ts` and `routes/handover.ts`) — keep both in sync
- Storage endpoints require auth — no per-object ACL yet

---

## Start

Read `PHASE_2_BUILD_SPEC.md` in full first.
Then start with Wave 1, item 1: student pre-population in New Assessment.
Work through each item sequentially. Compile after each item. Move to the next wave only when all items in the current wave pass validation.
