# PHASE_2_BUILD_SPEC.md

## Project
DriveTrack, learner-driver assessment and driving school operations platform for Australian learner drivers, instructors, and schools.

## Purpose of this file
This is the implementation brief for **Phase 2**.
It is written for a Replit agent to execute directly against the existing pnpm workspaces monorepo.

This spec assumes:
- Phase 1 is already complete
- existing auth, assessment, handover, booking, availability, zone, and notification flows must be preserved
- new features are added incrementally without breaking current working behaviour

---

# 1. Current Architecture Snapshot

## Monorepo structure
- `artifacts/driving-app/` - React + Vite + Tailwind + Shadcn/ui frontend
- `artifacts/api-server/` - Express 5 API
- `lib/db/` - Drizzle ORM schema and DB package
- `lib/api-spec/openapi.yaml` - source OpenAPI contract
- `lib/api-client-react/` - Orval-generated React client
- `lib/api-zod/` - generated Zod schemas

## Existing roles
Current roles in production code are:
- `student`
- `instructor`
- `admin`
- `unassigned`

Phase 2 extends this to:
- `student`
- `instructor`
- `school_admin` (replaces school-scoped use of current `admin`)
- `viewer`
- `super_admin`
- `unassigned`

## Existing data model relevant to Phase 2
Already present:
- `users`
- `students`
- `instructors`
- `assessments`
- `maneuver_results`
- `handover_notes`
- `audit_logs`
- `bookings`
- `booking_broadcasts`
- `notifications`
- `instructor_availability`
- `instructor_zones`
- `intake`
- `instructor_verifications`
- `verification_documents`
- `terms_acceptances`

## Key implementation constraints
- Existing instructor verification bypass flag exists in `artifacts/driving-app/src/App.tsx`
- Current backend auth relies on Clerk session -> local `users` row mapping
- Current access control is role-based but not yet tenant-aware
- Existing audit trail is minimal and must be expanded, not replaced
- Existing notification system is in-app only and must be upgraded for email and future push

---

# 2. Phase 2 Design Principles

All Phase 2 work must follow these principles.

## 2.1 Lean Six Sigma
For every feature use DMAIC:
- **Define:** what risk, waste, or workflow gap is being solved
- **Measure:** add instrumentation or fields needed to observe usage, failures, and turnaround time
- **Analyze:** surface admin metrics where useful, especially no-shows, moderation flags, and approval delays
- **Improve:** reduce taps, reduce ambiguity, reduce manual follow-up, improve safety visibility
- **Control:** add audit logs, feature flags, and clear state transitions so behaviour stays predictable over time

Implementation expectation:
- each major feature in this spec includes the operational metric to capture
- add admin/super-admin reporting hooks where data already exists

## 2.2 SOC2 posture
Every new capability must align with:
- least privilege access
- immutable audit trail for sensitive events
- encryption at rest for sensitive fields
- HTTPS-only transport assumptions
- session expiry and re-auth expectations
- secure defaults, explicit elevated access

## 2.3 ISO27001 posture
Every new capability must align with:
- documented access control model
- data classification labels on sensitive fields and exports
- incident response hooks for moderation and safeguarding events
- retention rules documented in code comments and spec
- change control via feature flags where rollout risk exists

## 2.4 Mobile-first and in-lesson usability
- minimum 48px tap targets
- no safety-critical information hidden behind extra taps if it affects lesson start
- iPad portrait and landscape layouts must remain usable
- pre-lesson summary should be glanceable within 5 seconds

## 2.5 Child safety and safeguarding first
If safety, safeguarding, privacy, or operational convenience conflict, safety wins.

## 2.6 Manual provisioning for now
SCIM is not available.
Manual role provisioning is performed by the contract owner or platform super-admin.
Do not design Phase 2 around SCIM assumptions.

---

# 3. Recommended Delivery Strategy

Build in the following order.
This order balances safety-critical quick wins first, then infrastructure, then tenancy and monetisation.

1. Pedal control field
2. Medical conditions and allergies
3. Handover enhancement and pre-lesson briefing card
4. No-show tracking and instructor notifications
5. Notification infrastructure foundation
6. Content filtering and moderation quarantine
7. Driving school entity and tenancy model
8. RBAC and access control hardening
9. Viewer role and linking codes
10. Calendar permission hierarchy and approval workflow
11. Stripe subscription skeleton and feature flags
12. Demo mode

---

# 4. Cross-Cutting Technical Rules

## 4.1 Required wiring path for any new field
Every new field must be wired through:
1. Drizzle schema
2. server route validation / DTO handling
3. OpenAPI schema and endpoints
4. Orval codegen regeneration
5. frontend hooks and pages
6. audit logging where applicable

## 4.2 Existing role flow preservation
Do not remove current `admin` behaviour abruptly.
Implement a migration path:
- existing `admin` users map to `school_admin` by default if tied to a school
- platform operator accounts use `super_admin`
- until migration completes, backend should tolerate `admin` as an alias during rollout

## 4.3 Feature flag requirement
Use explicit feature flags for risky or staged features:
- content moderation quarantine hard enforcement
- Stripe payment enforcement
- demo mode reset controls
- session timeout enforcement if frontend inactivity handler rolls out separately
- viewer payment gate enforcement

Suggested config module locations:
- `artifacts/api-server/src/lib/config.ts`
- `artifacts/driving-app/src/lib/config.ts`

## 4.4 Audit standard
Every sensitive read or write must log:
- actor user id
- actor role
- tenant or school id if applicable
- action
- resource type
- resource id
- target student id if applicable
- request surface or route
- IP / user agent metadata when available server-side
- timestamp
- result: success, denied, flagged, quarantined, exported

## 4.5 Data retention standard
For moderation and legal evidence records:
- retain minimum 7 years
- do not hard-delete moderated content
- use soft-delete or archival status only if needed later
- timestamps must be immutable creation records

---

# 5. Foundational Phase 2 Schema Changes

These schema changes support multiple requested features and should be planned together.

## 5.1 `users` table changes
Add columns:
- `role` expand enum-like usage to support `viewer`, `school_admin`, `super_admin`
- `schoolId` nullable FK to `driving_schools.id`
- `lastActiveAt` timestamptz nullable
- `mfaEncouragedAt` timestamptz nullable
- `sessionTimeoutMinutes` integer default `30`
- `notificationPreferencesJson` jsonb nullable or move to dedicated table below

Purpose:
- school scoping
- session inactivity tracking
- notification preferences bootstrap

## 5.2 `students` table changes
Add columns:
- `schoolId` nullable FK to `driving_schools.id`
- `medicalConditionsEncrypted` text nullable
- `allergiesEncrypted` text nullable
- `medicalConditionsPreview` text nullable
- `allergiesPreview` text nullable
- `noShowCount` integer not null default `0`
- `attendanceReliabilityScore` integer nullable
- `pedalControlDefault` text nullable if a per-student default is desired, otherwise omit
- `viewerCode` text unique nullable
- `viewerCodeIssuedAt` timestamptz nullable
- `dataClassification` text not null default `restricted`

Notes:
- use encrypted columns for full medical/allergy values
- preview fields can hold short masked/plain summary for fast UI display if the team does not want to decrypt on every list render
- `viewerCode` is the unique student linking code used by parents/mentors/viewers

## 5.3 `assessments` table changes
Add columns:
- `pedalOperator` text not null default `student` with allowed values `instructor | student | shared`
- `preLessonBriefingAcknowledgedAt` timestamptz nullable
- `preLessonBriefingAcknowledgedBy` integer nullable FK `users.id`
- `safetyFlagsJson` jsonb nullable

Purpose:
- safety-critical pedal control capture
- acknowledgement that the briefing card was actually seen before lesson start

## 5.4 `bookings` table changes
Add/modify columns:
- `status` expand to include `no_show`
- `schoolId` nullable FK to `driving_schools.id`
- `changeRequestedByUserId` nullable integer FK `users.id`
- `changeRequestStatus` nullable text `pending | approved | denied | none`
- `cancelledAt` timestamptz nullable
- `cancelledByUserId` integer nullable
- `noShowMarkedAt` timestamptz nullable
- `noShowMarkedByUserId` integer nullable
- `statusReason` text nullable
- `requiresSchoolApproval` boolean not null default `false`

Purpose:
- attendance tracking
- approval workflow basis
- better auditability

## 5.5 `notifications` table changes
Current notifications are too minimal for future push.
Add columns:
- `channel` text not null default `in_app` with values `in_app | email | push | sms`
- `deliveryStatus` text not null default `pending` with values `pending | sent | failed | suppressed | quarantined | read`
- `deliveryProvider` text nullable
- `deliveryAttemptedAt` timestamptz nullable
- `deliveredAt` timestamptz nullable
- `readAt` timestamptz nullable
- `schoolId` nullable FK
- `relatedType` text nullable
- `priority` text not null default `normal`
- `metadataJson` jsonb nullable

Keep existing fields for compatibility.

## 5.6 `handover_notes` table changes
Add columns:
- `schoolId` nullable FK
- `isSafetyCritical` boolean not null default `false`
- `contentStatus` text not null default `approved` if content filtering is applied here
- `moderationCaseId` nullable integer FK `moderation_cases.id`

## 5.7 `audit_logs` table changes
Current `metadata` text is too weak.
Expand with:
- `schoolId` integer nullable
- `actorRole` text nullable
- `result` text not null default `success`
- `ipAddress` text nullable
- `userAgent` text nullable
- `route` text nullable
- `metadataJson` jsonb nullable

Migration approach:
- keep old `metadata` during rollout
- prefer `metadataJson` going forward

## 5.8 `instructors` table changes
Add columns:
- `isIndependent` boolean not null default `true`
- `defaultSchoolId` integer nullable FK
- `safeguardingNotes` text nullable, restricted access
- `canSelfManageCalendar` boolean not null default `true`

Purpose:
- differentiate independent instructors from school-managed instructors

---

# 6. New Tables Required in Phase 2

## 6.1 `driving_schools`
Fields:
- `id`
- `name`
- `abn`
- `logoPath`
- `primaryColor`
- `secondaryColor`
- `contractOwnerUserId` FK `users.id`
- `billingContactName`
- `billingContactEmail`
- `billingContactPhone`
- `status` text default `active`
- `seatLimit` integer default `5`
- `studentCountSnapshot` integer nullable
- `subscriptionTier` text nullable
- `createdAt`
- `updatedAt`

Purpose:
- root tenant entity
- branding and billing anchor

## 6.2 `school_instructors`
Many-to-many mapping because instructors may contract for multiple schools.

Fields:
- `id`
- `schoolId` FK
- `instructorId` FK
- `roleWithinSchool` text default `instructor`
- `isPrimary` boolean default `false`
- `status` text default `active`
- `joinedAt`
- `endedAt` nullable
- unique `(schoolId, instructorId)`

## 6.3 `viewer_links`
Links viewers to students.

Fields:
- `id`
- `viewerUserId` FK `users.id`
- `studentId` FK `students.id`
- `schoolId` FK nullable
- `relationshipType` text nullable, examples `parent | guardian | mentor | support_worker | other`
- `linkStatus` text default `active`
- `linkedAt`
- `linkedByUserId` nullable
- unique `(viewerUserId, studentId)`

## 6.4 `viewer_link_requests`
Optional but recommended for traceability.

Fields:
- `id`
- `studentId`
- `viewerUserId`
- `enteredCode`
- `status` text `pending | approved | rejected | expired`
- `requestedAt`
- `resolvedAt`
- `resolvedByUserId` nullable
- `failureReason` nullable

Use if the team wants to keep a record of failed/invalid code attempts.

## 6.5 `notification_preferences`
Dedicated table is cleaner than JSON for querying.

Fields:
- `id`
- `userId` FK unique
- `emailEnabled` boolean default `true`
- `pushEnabled` boolean default `true`
- `inAppEnabled` boolean default `true`- `smsEnabled` boolean default `false`
- `bookingEmails` boolean default `true`
- `bookingPush` boolean default `true`
- `safeguardingAlerts` boolean default `true`
- `marketingEnabled` boolean default `false`
- `updatedAt`

## 6.6 `push_tokens`
Prepare for Expo push / Firebase Cloud Messaging.

Fields:
- `id`
- `userId` FK
- `platform` text `ios | android | web`
- `provider` text `expo | fcm | apns`
- `token` text unique
- `deviceLabel` text nullable
- `lastSeenAt` timestamptz
- `revokedAt` timestamptz nullable
- `createdAt`

## 6.7 `booking_change_requests`
Approval workflow table.

Fields:
- `id`
- `bookingId` FK
- `schoolId` FK
- `requestedByUserId` FK
- `requestType` text `reschedule | cancel | availability_override`
- `requestedPayloadJson` jsonb
- `status` text `pending | approved | denied`
- `reviewedByUserId` nullable
- `reviewedAt` nullable
- `reviewNotes` text nullable
- `createdAt`

## 6.8 `calendar_permissions`
Optional explicit table if logic should not live only in role checks.

Fields:
- `id`
- `schoolId`
- `instructorId`
- `canViewOwnSchedule` boolean default `true`
- `canRequestChanges` boolean default `true`
- `canMarkAvailability` boolean default `true`
- `canCreateAppointments` boolean default `false`
- `canCancelAppointments` boolean default `false`
- `updatedAt`

## 6.9 `subscriptions`
Stripe skeleton without hard enforcement.

Fields:
- `id`
- `schoolId` nullable
- `userId` nullable
- `stripeCustomerId` text nullable
- `stripeSubscriptionId` text nullable
- `planCode` text not null
- `status` text `trialing | active | past_due | cancelled | incomplete | inactive`
- `seatCount` integer nullable
- `renewalAt` timestamptz nullable
- `billingProvider` text default `stripe`
- `createdAt`
- `updatedAt`

## 6.10 `feature_entitlements`
Feature gating table, not enforced yet but ready.

Fields:
- `id`
- `scopeType` text `user | school`
- `scopeId` integer
- `featureKey` text
- `isEnabled` boolean default `false`
- `source` text `plan | promo | manual | default`
- `expiresAt` nullable
- unique `(scopeType, scopeId, featureKey)`

## 6.11 `moderation_cases`
Core safeguarding and quarantine workflow.

Fields:
- `id`
- `schoolId` nullable
- `reportedBySystem` boolean default `true`
- `status` text `open | under_review | released | escalated | closed`
- `severity` text `low | medium | high | critical`
- `contentType` text `handover_note | assessment_note | booking_note | message | other`
- `contentId` integer nullable
- `actorUserId` integer nullable
- `targetUserId` integer nullable
- `studentId` integer nullable
- `ruleHitsJson` jsonb
- `rawExcerpt` text nullable
- `reviewOutcome` text nullable
- `reviewedByUserId` integer nullable
- `reviewedAt` timestamptz nullable
- `legalHold` boolean default `false`
- `createdAt`
- `updatedAt`

## 6.12 `moderated_content_events`
Immutable event stream per case.

Fields:
- `id`
- `moderationCaseId` FK
- `eventType` text `detected | quarantined | notified | reviewed | released | escalated | exported`
- `payloadJson` jsonb
- `createdAt`

## 6.13 `content_filter_configs`
Optional admin-controlled rule settings.

Fields:
- `id`
- `version` text
- `isActive` boolean default `true`
- `configJson` jsonb
- `createdAt`

## 6.14 `law_enforcement_exports`
Track evidence exports.

Fields:
- `id`
- `requestedByUserId`
- `approvedByUserId`
- `schoolId` nullable
- `caseIdsJson` jsonb
- `reason`
- `exportPath`
- `checksum`
- `createdAt`

## 6.15 `demo_resets`
Demo mode auditability.

Fields:
- `id`
- `triggeredByUserId`
- `notes` text nullable
- `resetScope` text `full_demo | bookings_only | students_only`
- `createdAt`

---

# 7. Security and Compliance Foundations

## 7.1 Sensitive field encryption
Encrypt at rest for:
- student medical conditions
- student allergies
- student licence number
- any safeguarding notes
- any legal export bundle staging metadata that includes sensitive content

Suggested implementation:
- create small server-side crypto helper in `artifacts/api-server/src/lib/crypto.ts`
- use env-backed symmetric key
- store ciphertext in DB
- optionally store short plaintext preview only where justified for operational safety and approved by product owner

If preview text is stored:
- keep it minimal
- do not store full diagnosis detail in preview
- example preview format: `Medical info present`, `Allergy info present`, or first short safe phrase only

## 7.2 Session timeout
Requirement: 30 minutes inactivity.

Implementation:
- frontend inactivity watcher resets on navigation, pointer, key, and touch events
- after 25 minutes show warning modal
- at 30 minutes force Clerk sign-out or session refresh path
- backend updates `users.lastActiveAt` opportunistically on authenticated requests
- document that Clerk remains system of record for authentication, but app-level inactivity timeout is enforced in UI and optionally middleware later

## 7.3 Data classification model
Use four labels:
- `public`
- `internal`
- `confidential`
- `restricted`

Recommended defaults:
- school branding: `internal`
- booking status and availability metadata: `confidential`
- student profile basics: `confidential`
- medical, allergies, licence, safeguarding flags, moderation evidence: `restricted`

## 7.4 PII access logging
Every read of restricted student data must create audit log entries.
This includes:
- student detail page load
- handover load
- pre-lesson briefing card render if it includes medical or pedal data
- moderation dashboard review of flagged content tied to a student
- law-enforcement export generation

---

# 8. RBAC Matrix

This matrix must be implemented and also documented in code comments or a dedicated markdown appendix.

## 8.1 Roles
- `student`
- `instructor`
- `school_admin`
- `viewer`
- `super_admin`
- temporary rollout alias: `admin`

## 8.2 Core access rules

### Student
Can:
- view own dashboard
- view own bookings
- view own assessment summaries
- view own focus areas
- request bookings where enabled

Cannot:
- view instructor private notes
- view moderation dashboard
- view other students
- change school settings

### Instructor
Can:
- view assigned / related students within school scope
- create and edit assessments for related students
- view handover and safety briefing data for related students
- mark availability
- request booking changes
- mark no-show where relationship exists and policy allows

Cannot when school-managed:
- create or cancel appointments unilaterally
- view other school data outside tenant scope
- access super-admin moderation dashboard

### School Admin
Can:
- manage school users and role assignments manually
- approve or deny booking change requests
- view school bookings, students, instructors
- access school-level reports
- manage branding, billing contact, seat usage

Cannot:
- access other schools' data
- access platform-wide moderation settings unless also super-admin

### Viewer
Can:
- view linked student's progress
- view upcoming bookings
- view assessment summaries
- view focus areas

Cannot:
- see instructor private notes
- see moderation internals
- see other students
- edit bookings unless later approved in a future phase

### Super Admin
Can:
- manage all schools
- access moderation dashboard
- review quarantined content
- perform legal exports
- manage feature flags and demo resets

Must be tightly limited and fully audited.

## 8.3 Temporary rollout compatibility
During migration:
- backend `admin` should be treated as `school_admin` for school-scoped endpoints
- a small list of explicitly configured platform operator user ids can be treated as `super_admin` until UI role assignment exists

---

# 9. Item 1, Pedal Control Field

## 9.1 Define
Instructors need immediate visibility into who controls pedals for a learner. This is safety-critical and must be surfaced before any lesson starts.

## 9.2 Measure
Track:
- percentage of assessments with `pedalOperator` populated
- percentage of pre-lesson briefings acknowledged before assessment start
- count of assessments saved without pedal control selection, should trend to zero

## 9.3 Schema changes
### `assessments`
Add:
- `pedalOperator` text not null default `student`

Allowed values:
- `instructor`
- `student`
- `shared`

Optional:
- add DB check constraint if the current migration style supports it

## 9.4 API changes
Update existing endpoints:
- `POST /assessments`
- `PATCH /assessments/:id`
- `GET /assessments`
- `GET /assessments/:id`
- handover payload returned by `GET /handover/:studentId`
- any student detail aggregate endpoint used for profile views

Add OpenAPI schema field:
- `pedalOperator`

If backend summary DTOs exist, include:
- latest assessment pedal operator
- latest pedal operator changed at date if useful

## 9.5 Frontend changes
### Assessment creation flows
Files likely involved:
- `artifacts/driving-app/src/pages/instructor/new-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/guided-assessment.tsx`

Requirements:
- add required segmented control or large radio buttons for pedal control
- place near top of setup flow, before lesson details become secondary
- default visually unselected if product wants explicit confirmation, even if DB defaults to `student`
- block save/start until selected

### Student detail page
- surface latest pedal control status prominently near student header
- if unknown, show `Not recorded yet`

### Handover view
- show pedal control in safety summary near top

### Assessment summary/detail page
- include pedal control in summary card and exported assessment summary view

## 9.6 UX requirements
- use large touch-friendly chips or segmented buttons
- visual treatment should be safety-oriented, not subtle
- suggested label: `Pedal control`
- suggested helper copy: `Confirm who controls the pedals before the lesson starts.`

## 9.7 Audit requirements
Log:
- pedal control set on assessment creation
- pedal control changed after creation
- pre-lesson briefing acknowledged

## 9.8 Acceptance criteria
- instructor must select pedal control in standard and guided assessment flows
- latest pedal control is visible on student profile and handover screen without extra tap
- assessment summary shows pedal control clearly
- OpenAPI and generated clients include `pedalOperator`

---

# 10. Item 2, No-Show and Cancellation Tracking

## 10.1 Define
Attendance reliability matters for scheduling efficiency, instructor time protection, and school reporting.

## 10.2 Measure
Track:
- no-show count per student
- cancellation count per student
- no-show rate by school
- average turnaround time from cancellation/no-show event to instructor notification delivery

## 10.3 Schema changes
### `bookings`
Expand `status` values to include:
- `no_show`

Add:
- `cancelledAt`
- `cancelledByUserId`
- `noShowMarkedAt`
- `noShowMarkedByUserId`
- `statusReason`

### `students`
Add:
- `noShowCount` integer default `0`
- `attendanceReliabilityScore` integer nullable

Reliability score can initially be simple:
- start at 100
- subtract weighted points for no-shows and late cancellations
- later evolve into a computed metric if needed

## 10.4 Notification requirements
When a booking becomes `cancelled` or `no_show`:
1. create in-app notification
2. send email to instructor registered email
3. write audit log
4. enqueue future push-compatible notification event

If the actor is the instructor, still notify relevant school admin and optionally student depending on policy.

## 10.5 API changes
Update:
- `PATCH /bookings/:id`
- `GET /bookings`
- `GET /bookings/:id`

Add or extend DTOs with:
- `cancelledAt`
- `cancelledByUserId`
- `noShowMarkedAt`
- `noShowMarkedByUserId`
- `statusReason`
- `attendanceReliabilityScore` in student summaries where useful

Optional endpoints:
- `GET /students/:id/attendance-summary`
- `GET /schools/:id/attendance-metrics`

## 10.6 Backend implementation notes
Current route file:
- `artifacts/api-server/src/routes/bookings.ts`

Refactor required:
- centralise booking status transition handling in a service helper instead of inline route logic
- apply notification fan-out from one place
- prevent invalid transitions where possible

Suggested valid transitions:
- `pending -> claimed`
- `claimed -> confirmed`
- `confirmed -> completed`
- `pending/claimed/confirmed -> cancelled`
- `confirmed -> no_show`

Decide whether `claimed -> no_show` is legal. Recommendation: only allow `confirmed -> no_show` unless school policy requires otherwise.

## 10.7 Frontend changes
### Instructor bookings page
File likely involved:
- `artifacts/driving-app/src/pages/instructor/bookings.tsx`

Requirements:
- include `No show` action for eligible booking states
- include cancellation reason input for cancel/no-show action sheet or modal
- make booking status badges clearer

### Student cards and profile
- show no-show count
- show attendance reliability badge, examples:
  - `Excellent`
  - `Good`
  - `Needs attention`
- badge should be glanceable in student lists and detail view

## 10.8 Email delivery
Phase 2 only needs provider-ready abstraction.
Implement a notification channel service that supports:
- `sendInAppNotification()`
- `sendEmailNotification()`
- `enqueuePushNotification()`

Do not bury email sending inside booking route handlers.

## 10.9 Acceptance criteria
- bookings support `no_show` status end-to-end
- instructor receives in-app and email notification for cancellation and no-show events
- student profile shows no-show count
- student cards show attendance reliability indicator
- booking status changes are audited with actor and timestamp

---

# 11. Item 3, Medical Conditions and Allergies

## 11.1 Define
Instructors must see relevant medical conditions and allergies before starting a lesson. This is safety-critical and restricted data.

## 11.2 Measure
Track:
- percentage of students with medical/allergy data populated
- percentage of lessons where pre-lesson briefing was acknowledged when medical/allergy data exists
- count of access events to restricted medical fields

## 11.3 Schema changes
Preferred location is `students`, not just `intake`, because instructors need operational access later.

Add to `students`:
- `medicalConditionsEncrypted`
- `allergiesEncrypted`
- `medicalConditionsPreview`
- `allergiesPreview`

Keep existing `intake.medicalConditions` during migration, then backfill and treat `students` as source of truth.

## 11.4 API changes
Update:
- student create/update endpoints
- student detail endpoints
- handover aggregate endpoint

Add to OpenAPI student schemas:
- `medicalConditions`
- `allergies`

Important:
- only return full plaintext medical/allergy data to authorised roles
- viewer role can likely see this if explicitly approved by product owner, but because this is highly sensitive, default to visible in pre-lesson safety context for instructors and school admins only unless product confirms viewer access

Recommended viewer behaviour for Phase 2:
- do **not** expose full medical/allergy data to viewers by default
- instead expose a boolean `medicalInfoOnFile` only if needed

## 11.5 Frontend changes
### Student detail page
File likely involved:
- `artifacts/driving-app/src/pages/instructor/student-detail.tsx`

Requirements:
- prominent `Medical and allergy information` card near top
- warning icon if either field populated
- clearly separated from general notes

### Handover view
File likely involved:
- `artifacts/driving-app/src/pages/instructor/handover.tsx`

Requirements:
- show medical conditions and allergies inside pre-lesson safety card
- if populated, card should use high-visibility styling

### Student creation/edit flow
- add fields to create/edit student forms
- support multiline text areas
- if field empty, store null not empty string where possible

## 11.6 Security requirements
- encrypted at rest
- audit log every read by instructor, school admin, or super admin
- do not expose via student list APIs unless a safe summary flag is needed

## 11.7 Acceptance criteria
- student profile stores medical conditions and allergies
- instructors see this prominently on detail and handover views
- restricted field access is logged
- guided and standard pre-lesson flow can surface this before lesson start

---

# 12. Item 4, Handover Enhancement

## 12.1 Define
Handover exists already but safety-critical context needs to be more prominent and consolidated.

## 12.2 Measure
Track:
- handover view usage before lesson starts
- pre-lesson briefing acknowledgement rate
- percentage of students with at least one handover note and visible focus areas

## 12.3 Existing route leverage
Current backend already has:
- `GET /handover/:studentId`
- `POST /handover/:studentId/notes`

Enhance this endpoint rather than building a separate parallel one unless response shape becomes too large.

## 12.4 Backend changes
Extend handover response to include:
- latest pedal control from most recent assessment
- medical conditions summary
- allergies summary
- latest focus areas from latest assessment
- last booking status if relevant
- no-show count
- pre-lesson briefing payload object

Suggested response shape:
- `student`
- `safetyBriefing`
  - `pedalOperator`
  - `medicalConditions`
  - `allergies`
  - `warningFlags`
  - `latestFocusAreas`
  - `noShowCount`
  - `attendanceReliability`
- `notes`
- `recentAssessments`
- `skillBreakdown`

## 12.5 Frontend changes
### Pre-lesson briefing card
Build a reusable component, likely under:
- `artifacts/driving-app/src/components/`

Suggested component name:
- `PreLessonBriefingCard`

Content:
- pedal control
- medical conditions
- allergies
- latest focus areas
- latest handover note excerpt
- acknowledgement button

Requirements:
- appears at top of handover view
- can also be embedded in assessment start flow
- must be mobile-first and readable at a glance

### Handover notes prominence
- latest handover note should appear above older note history
- use stronger hierarchy and spacing
- show focus areas directly beside note if present

## 12.6 Acceptance criteria
- handover view has a clear top-of-screen safety summary card
- pedal control, medical info, and latest focus areas are visible without scrolling deep
- instructors can acknowledge briefing before lesson start
- existing handover notes remain accessible and not broken

---

# 13. Item 5, Content Filtering and Communication Safeguards

## 13.1 Define
All text content through the platform must be screened for profanity, inappropriate content, grooming indicators, threats, and PII sharing attempts. Potentially harmful content must be quarantined, audited, and reviewable by platform super-admins.

## 13.2 Measure
Track:
- total content items scanned
- flag rate by content type and school
- false-positive release rate
- time to review for high-severity cases
- export count for legal requests

## 13.3 Scope of content to filter in Phase 2
At minimum:
- handover notes
- assessment per-maneuver notes
- assessment confidence notes
- assessment focus areas if free text
- booking `studentNotes`
- booking `instructorNotes`
- any future in-app messages or communications

## 13.4 Quarantine model
On rule breach:
- content is stored
- content is marked `quarantined`
- content is not delivered to recipient or rendered in normal user views
- developer/platform admin gets immediate alert
- audit log entry is written
- moderation case is opened

## 13.5 Backend architecture
Create content filtering service, for example:
- `artifacts/api-server/src/lib/contentFiltering/`

Suggested modules:
- `scanContent.ts`
- `ruleSets.ts`
- `moderationService.ts`
- `notificationSink.ts`

Suggested return shape:
- `status: approved | flagged | quarantined`
- `severity`
- `ruleHits`
- `normalizedText`
- `requiresReview`

## 13.6 Rule categories
Phase 2 can start with deterministic rules and clear heuristics.

Categories:
- profanity
- sexual or inappropriate content
- grooming indicators
- threats / violence
- self-harm / harm indicators if relevant
- personal contact / PII sharing attempts
  - phone numbers
  - emails
  - direct social handles
  - address-like patterns

Important:
- rules should produce explainable hits
- avoid black-box-only moderation in early phase
- allow future provider-based moderation later

## 13.7 Storage model
For each flagged item:
- original content stored with immutable timestamp
- moderation case created
- linked content record updated with `contentStatus`
- event written to `moderated_content_events`

If content is approved after review:
- mark released
- make deliverable/visible if policy allows
- preserve original audit history

## 13.8 Admin notification requirement
Immediate notification target is platform developers / super-admins only.
Do not route serious safeguarding alerts to school admins by default unless policy explicitly allows.

Implement with:
- in-app notification to super-admins
- email alert to configured platform safety inbox

## 13.9 Moderation dashboard
New super-admin-only UI area.
Suggested route:
- `/super-admin/moderation`

Files likely to add:
- `artifacts/driving-app/src/pages/super-admin/moderation.tsx`
- `artifacts/driving-app/src/pages/super-admin/moderation-case.tsx`

Dashboard capabilities:
- list open cases
- filter by severity, school, content type, status
- inspect full content context
- view actor, target, student, timestamps
- release, escalate, close
- export evidence bundle trigger

## 13.10 API endpoints
Suggested endpoints:
- `GET /moderation/cases`
- `GET /moderation/cases/:id`
- `PATCH /moderation/cases/:id`
- `POST /moderation/cases/:id/release`
- `POST /moderation/cases/:id/escalate`
- `POST /moderation/exports`

Also integrate scan calls into existing write endpoints, not only new moderation endpoints.

## 13.11 Export capability for law enforcement
Feature must exist but be tightly restricted.

Suggested export contents:
- case metadata
- content record
- actor/target metadata where legally appropriate
- audit log history
- checksum manifest
- generated zip path in controlled storage

Only `super_admin` may initiate.
Every export must create:
- audit log entry
- `law_enforcement_exports` row
- moderation event `exported`

## 13.12 Retention and immutability
- retain flagged and reviewed content minimum 7 years
- do not mutate original content body after creation
- if a reviewed summary is needed, store as separate moderation note, not overwrite original

## 13.13 Acceptance criteria
- all scoped text content passes through filter before delivery
- flagged content is stored and quarantined, not delivered
- super-admin receives immediate alert
- moderation dashboard exists and is access-controlled
- audit logs include full context for breaches
- export path exists for legal requests

---

# 14. Item 6, Parent / Mentor Viewer Role

## 14.1 Define
Parents, guardians, mentors, and support workers need read-only visibility into a student's progress without exposure to private instructor notes or broader school data.

## 14.2 Measure
Track:
- number of active viewer links
- conversion to paid viewer subscriptions later
- viewer dashboard visits
- invalid code entry attempts

## 14.3 Role model
New role:
- `viewer`

This role should authenticate through existing Clerk flow and then have restricted navigation and API access.

## 14.4 Linking mechanism
Each student gets unique linking code:
- generated server-side
- opaque, non-sequential, human-enterable
- recommend 8 to 12 char alphanumeric without ambiguous characters

Suggested code format:
- `DRV-7KQ9X2`

Requirements:
- regenerate only through authorised admin/instructor action if needed
- log code generation and resets
- consider optional expiry if product wants more control, but not required for initial phase

## 14.5 Schema changes
Already covered:
- `students.viewerCode`
- `viewer_links`
- optional `viewer_link_requests`

## 14.6 API endpoints
Suggested endpoints:
- `POST /viewer-links/request`
- `POST /viewer-links/confirm`
- `GET /viewer/me/students`
- `GET /viewer/students/:id/dashboard`

Alternative simpler flow:
- `POST /students/link-by-code`

Recommendation:
- use dedicated viewer link endpoints for clarity and auditability

## 14.7 Viewer dashboard contents
Must show:
- student progress summary
- upcoming bookings
- assessment summaries
- focus areas

Must not show:
- private instructor notes
- raw moderation flags
- unrelated school records
- other students
- internal audit data

Recommended allowed fields:
- student first name / display name as approved by product owner
- total hours
- mastered vs tracked skills
- latest lesson date
- current focus areas
- upcoming booking date/time/status
- sanitised assessment summaries

## 14.8 Frontend changes
Add viewer route section, likely:
- `/viewer/dashboard`
- `/viewer/students/:id`

Files to add:
- `artifacts/driving-app/src/pages/viewer/dashboard.tsx`
- `artifacts/driving-app/src/pages/viewer/student-detail.tsx`

Update app routing in:
- `artifacts/driving-app/src/App.tsx`

Update onboarding / role selection flow to include viewer role.

## 14.9 Payment gate skeleton
Viewer price:
- `$2/mo`

Phase 2 requirement:
- build Stripe subscription plumbing
- do not hard-enforce payment yet
- feature flag gating only

Implementation:
- create viewer subscription row when onboarding or linking if product wants early billing staging
- entitlement flag `viewer_dashboard_access`
- set enabled by default in non-enforced mode

## 14.10 Acceptance criteria
- viewer can link to student using unique code
- viewer sees only linked student's progress, bookings, summaries, and focus areas
- viewer cannot access private instructor notes or other tenant data
- viewer role is available in auth and routing flow
- payment gate scaffolding exists but is not enforced yet

---

# 15. Item 7, Calendar Permission Hierarchy

## 15.1 Define
School-owned instructors must not create or cancel appointments unilaterally. Independent instructors keep full control.

## 15.2 Measure
Track:
- booking change requests submitted
- approval turnaround time
- denied request rate
- unauthorised action attempts blocked by policy

## 15.3 Role logic
### School-managed instructor
Can:
- view own schedule
- request changes
- mark availability

Cannot:
- create appointments unilaterally
- cancel appointments unilaterally

### Independent instructor
Can:
- retain full schedule control

### School admin
Can:
- approve/deny instructor requests
- create/cancel appointments within school scope

## 15.4 Data model
Use:
- `instructors.isIndependent`
- `school_instructors`
- `booking_change_requests`
- optional `calendar_permissions`

## 15.5 Backend changes
Current booking routes in:
- `artifacts/api-server/src/routes/bookings.ts`

Refactor with policy helper, example:
- `canManageBookingDirectly(user, booking)`
- `canRequestBookingChange(user, booking)`
- `requiresSchoolApproval(user, booking)`

Suggested new endpoints:
- `POST /bookings/:id/change-requests`
- `GET /bookings/change-requests`
- `PATCH /bookings/change-requests/:id`

Availability routes also need school-aware policy.
Current route file:
- `artifacts/api-server/src/routes/availability.ts`

## 15.6 Frontend changes
### Instructor bookings page
- if school-managed, replace direct cancel/reschedule actions with `Request change`
- show request status badge

### School admin bookings page
- queue of pending approval requests
- approve / deny actions
- show who requested the change and why

### Availability page
- instructors still manage availability
- if availability changes affect existing bookings, optionally create approval or warning flow

## 15.7 Acceptance criteria
- school-managed instructors cannot directly create/cancel appointments
- independent instructors retain full control
- school admins can approve/deny change requests
- approval state is visible in UI and audited

---

# 16. Item 8, Driving School Entity and Multi-Tenant Architecture

## 16.1 Define
DriveTrack must support multiple driving schools with strict data isolation and school-specific branding, billing, and role provisioning.

## 16.2 Measure
Track:
- school count
- instructors per school
- students per school
- cross-tenant access denials
- branding completeness

## 16.3 Tenant model
Use `driving_schools` as root tenant.

Relationships:
- one school has one contract owner user
- one school has many school admins
- one school has many instructors through `school_instructors`
- instructors can belong to multiple schools
- students belong to one school in Phase 2 for simplicity

Recommended simplification:
- assign each student a single `schoolId`
- if a student works across contractor instructors within same school, that is fine
- avoid cross-school student sharing in Phase 2

## 16.4 Schema migration
Add `schoolId` to:
- `users`
- `students`
- `bookings`
- `handover_notes`
- `notifications`
- `audit_logs`
- potentially `assessments` if you want direct scoping without joining via student/instructor

Recommendation:
- also add `schoolId` to `assessments` for simpler queries and safer tenant filters

## 16.5 Access control strategy
For every school-scoped route:
- derive actor school scope
- enforce schoolId filter in query
- never rely on frontend filtering
- prefer query-time constraints over post-query filtering

High-risk existing routes to review:
- `students.ts`
- `assessments.ts`
- `handover.ts`
- `bookings.ts`
- `availability.ts`
- `zones.ts`
- `dashboard.ts`
- `audit.ts`
- `notifications.ts`

## 16.6 Branding support
School fields:
- logo
- primary color
- secondary color

Frontend requirements:
- school admin settings page
- branding applied to dashboard header / accent usage, but do not overcomplicate theming in Phase 2
- keep white-labeling light and safe

## 16.7 Manual provisioning
Contract owner is responsible for role provisioning within their school.

Required capabilities:
- invite or assign users manually to `school_admin`, `instructor`, `viewer`
- link instructors to school
- create school profile

SCIM deferred.

## 16.8 API endpoints
Suggested endpoints:
- `POST /schools`
- `GET /schools/me`
- `PATCH /schools/:id`
- `POST /schools/:id/instructors`
- `DELETE /schools/:id/instructors/:instructorId`
- `POST /schools/:id/admins`
- `GET /schools/:id/settings`

## 16.9 Frontend changes
Add school admin area:
- school settings
- instructor seat management
- branding settings
- billing/contact page placeholder

Likely routes:
- `/school-admin/dashboard`
- `/school-admin/students`
- `/school-admin/instructors`
- `/school-admin/bookings`
- `/school-admin/settings`

Migration note:
- current `/admin/*` routes can be retained first, then aliased or migrated to school-admin naming

## 16.10 Acceptance criteria
- `driving_schools` exists and is wired into core records
- school data is isolated by tenant
- instructors can belong to multiple schools
- school admins are scoped to their school only
- super-admin remains platform-level

---

# 17. Item 9, Access Control and Compliance

## 17.1 Define
Phase 2 must formalise least privilege, restricted data handling, access logging, session timeout, and field encryption.

## 17.2 Measure
Track:
- denied access attempts
- restricted data read events
- MFA encouragement uptake for school admins
- session timeout events

## 17.3 Backend access policy layer
Create shared policy helpers in API server, example:
- `artifacts/api-server/src/lib/authz/`

Suggested helpers:
- `requireRole()`
- `requireSchoolScope()`
- `canViewStudent()`
- `canEditStudent()`
- `canViewRestrictedMedicalData()`
- `canViewPrivateInstructorNotes()`
- `canManageModeration()`

Do not keep expanding inline role checks inside every route.

## 17.4 Private instructor notes split
This item is implied by viewer restrictions and compliance posture.
If current notes are mixed, add distinction where needed:
- `privateInstructorNotes`
- `shareableSummary`

At minimum for Phase 2:
- ensure viewer APIs never return instructor private notes
- if handover notes are instructor-only, do not expose them to student/viewer endpoints

## 17.5 MFA posture
Clerk handles auth.
Phase 2 requirement is to encourage MFA for school admins.
Implementation can be:
- dashboard banner for `school_admin`
- admin settings reminder
- audit when MFA reminder shown or dismissed if helpful

## 17.6 HTTPS only
Already covered by Replit hosting, but enforce assumptions in app config and docs.
Implementation:
- never generate `http://` callbacks or asset links in app logic
- any webhook config docs should require HTTPS

## 17.7 Acceptance criteria
- RBAC matrix is documented and implemented
- restricted fields are encrypted at rest
- PII access is logged
- inactivity timeout exists at 30 minutes
- viewer and school-admin access is least-privilege by default

---

# 18. Item 10, Subscription Tiers and Feature Gating

## 18.1 Define
Pricing and entitlements need to exist in code structure now, even if payment is not enforced yet.

## 18.2 Tiers
- Student: Free
- Viewer: $2/mo
- Independent Instructor: $29/mo
- Driving School: $99/mo includes 5 instructor seats
- Additional school seat: $15/mo each
- Enterprise/Government: custom annual contract, banded by student count

## 18.3 Measure
Track:
- entitlement assignments
- seat usage per school
- users without paid plan but with enabled gated features, during non-enforced mode

## 18.4 Backend model
Use:
- `subscriptions`
- `feature_entitlements`

Feature keys to define now:
- `viewer_dashboard_access`
- `calendar_management`
- `bulk_booking_management`
- `school_branding`
- `school_multi_instructor`
- `demo_mode_reset`
- `moderation_dashboard`

## 18.5 Stripe integration skeleton
Create provider abstraction, example:
- `artifacts/api-server/src/lib/billing/stripe.ts`
- `artifacts/api-server/src/routes/billing.ts`

Phase 2 only needs:
- customer creation helper
- subscription placeholder create/sync hooks
- webhook endpoint scaffold
- plan code mapping constants

Do not fully block app usage yet.

## 18.6 Frontend changes
- billing/settings placeholders for school admin and viewer
- show current plan and seat usage where available
- gated features should display lock state only when feature flags say visible, but enforcement remains off

## 18.7 Apple/Google IAP preparation
Do not implement native IAP now.
Just avoid hard-coding Stripe-only assumptions into entitlement model.
Use generic `billingProvider` and `planCode` fields.

## 18.8 Acceptance criteria
- subscription and entitlement schema exists
- Stripe integration skeleton exists
- pricing tiers are represented in constants/config
- feature flags can enable or disable enforcement separately from entitlement storage

---

# 19. Item 11, Notification Infrastructure

## 19.1 Define
Notifications must work across email, in-app, and future push, with user preferences and delivery tracking.

## 19.2 Measure
Track:
- delivery attempts by channel
- success/failure rate
- unread counts
- preference opt-out usage

## 19.3 Existing system
Current in-app notifications exist in:
- DB `notifications`
- API route `artifacts/api-server/src/routes/notifications.ts`

This must be evolved, not replaced.

## 19.4 Backend architecture
Create notification service layer, example:
- `artifacts/api-server/src/lib/notifications/`

Suggested modules:
- `notificationService.ts`
- `emailChannel.ts`
- `pushChannel.ts`
- `inAppChannel.ts`
- `preferenceService.ts`
- `templates/`

## 19.5 Push preparation
Use `push_tokens` table.
Add endpoints:
- `POST /notifications/push-tokens`
- `DELETE /notifications/push-tokens/:id`
- `GET /notifications/preferences`
- `PATCH /notifications/preferences`

Do not implement live push send unless time permits. Hooks and DB support are enough.

## 19.6 Email notifications in Phase 2
Support at minimum:
- booking confirmation
- booking cancellation
- booking no-show
- moderation breach alerts to platform team

## 19.7 Frontend changes
- notification preferences page for each user role
- update existing bell/dropdown if present to reflect new types/statuses

## 19.8 Acceptance criteria
- notifications support in-app and email in common flows
- push token storage exists for future mobile app packaging
- user preference endpoints and UI exist
- notification records track channel and delivery status

---

# 20. Item 12, Presentation and Demo Mode

## 20.1 Define
DriveTrack needs a clean demo mode for school and government pitches, with sample data, reset capability, and screenshot-safe UI.

## 20.2 Measure
Track:
- demo resets performed
- demo mode sessions started
- sample data freshness if tracked

## 20.3 Requirements
- one-click reset of demo data
- clean sample school, instructors, students, bookings, assessments
- hide noisy dev controls
- use polished navigation and seeded realistic statuses

## 20.4 Backend changes
Create demo reset service, example:
- `artifacts/api-server/src/lib/demo/resetDemoData.ts`

Suggested endpoint:
- `POST /demo/reset`

Access:
- `super_admin` only
- optionally a feature-flagged demo operator account list

Reset behaviour:
- clear and reseed demo tenant records only
- do not touch production tenants
- log every reset in `demo_resets` and audit logs

## 20.5 Frontend changes
- demo mode toggle or banner visible only to authorised operator
- clean screenshot mode can hide technical badges, moderation counters, or admin-only debug affordances

## 20.6 Seed data suggestions
Include:
- one school
- 2 to 3 instructors
- 6 to 10 students
- a mix of assessments with focus areas and pedal control states
- bookings in pending/confirmed/completed/no_show states
- handover notes and safety flags

## 20.7 Acceptance criteria
- demo data can be reset with one action
- reset is scoped and audited
- UI looks clean and pitch-ready
- demo mode does not leak dev-only controls into screenshots

---

# 21. OpenAPI and Codegen Work Required

Every Phase 2 backend change must be mirrored in:
- `lib/api-spec/openapi.yaml`
- regenerated `lib/api-client-react`
- regenerated `lib/api-zod`

## 21.1 New tags likely needed
Add tags such as:
- `schools`
- `viewer`
- `moderation`
- `billing`
- `notifications`

## 21.2 Update existing schemas
Must extend at least:
- `UserProfile`
- `Student`
- `Assessment`
- `Booking`
- `Notification`
- dashboard summary types

## 21.3 New schemas likely needed
- `DrivingSchool`
- `ViewerLink`
- `BookingChangeRequest`
- `NotificationPreferences`
- `PushToken`
- `ModerationCase`
- `ModerationEvent`
- `Subscription`
- `FeatureEntitlement`
- `PreLessonBriefing`

## 21.4 Codegen process
After OpenAPI update:
- run Orval generation for React client
- regenerate Zod package if current workspace scripts support it
- fix compile errors by wiring frontend to latest types, not by bypassing them

---

# 22. Frontend Pages and Components Likely to Change

## Existing files likely to change
- `artifacts/driving-app/src/App.tsx`
- `artifacts/driving-app/src/pages/instructor/new-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/guided-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/student-detail.tsx`
- `artifacts/driving-app/src/pages/instructor/handover.tsx`
- `artifacts/driving-app/src/pages/instructor/bookings.tsx`
- `artifacts/driving-app/src/pages/instructor/availability.tsx`
- existing admin pages, likely transitioning to school-admin semantics

## New frontend pages likely needed
- `artifacts/driving-app/src/pages/viewer/dashboard.tsx`
- `artifacts/driving-app/src/pages/viewer/student-detail.tsx`
- `artifacts/driving-app/src/pages/school-admin/settings.tsx`
- `artifacts/driving-app/src/pages/school-admin/booking-approvals.tsx`
- `artifacts/driving-app/src/pages/super-admin/moderation.tsx`
- `artifacts/driving-app/src/pages/super-admin/moderation-case.tsx`
- `artifacts/driving-app/src/pages/super-admin/demo.tsx`
- `artifacts/driving-app/src/pages/account/notifications.tsx`
- `artifacts/driving-app/src/pages/account/billing.tsx`

## Shared components likely needed
- `PreLessonBriefingCard`
- `PedalControlSelector`
- `MedicalWarningCard`
- `AttendanceReliabilityBadge`
- `NotificationPreferencesForm`
- `ModerationCaseTable`
- `RoleGate`
- `SchoolScopeGate`

---

# 23. Backend Files Likely to Change

## Existing files likely to change
- `artifacts/api-server/src/routes/users.ts`
- `artifacts/api-server/src/routes/students.ts`
- `artifacts/api-server/src/routes/assessments.ts`
- `artifacts/api-server/src/routes/handover.ts`
- `artifacts/api-server/src/routes/bookings.ts`
- `artifacts/api-server/src/routes/notifications.ts`
- `artifacts/api-server/src/routes/dashboard.ts`
- `artifacts/api-server/src/routes/audit.ts`
- `artifacts/api-server/src/routes/index.ts`

## New backend route files likely needed
- `artifacts/api-server/src/routes/schools.ts`
- `artifacts/api-server/src/routes/viewer-links.ts`
- `artifacts/api-server/src/routes/moderation.ts`
- `artifacts/api-server/src/routes/billing.ts`
- `artifacts/api-server/src/routes/demo.ts`

## New backend service areas likely needed
- `artifacts/api-server/src/lib/authz/`
- `artifacts/api-server/src/lib/notifications/`
- `artifacts/api-server/src/lib/contentFiltering/`
- `artifacts/api-server/src/lib/billing/`
- `artifacts/api-server/src/lib/demo/`
- `artifacts/api-server/src/lib/crypto.ts`

---

# 24. DB Files Likely to Change

## Existing schema files likely to change
- `lib/db/src/schema/users.ts`
- `lib/db/src/schema/students.ts`
- `lib/db/src/schema/assessments.ts`
- `lib/db/src/schema/bookings.ts`
- `lib/db/src/schema/handover.ts`
- `lib/db/src/schema/audit.ts`
- `lib/db/src/schema/instructors.ts`
- `lib/db/src/schema/index.ts`

## New schema files likely needed
- `lib/db/src/schema/driving-schools.ts`
- `lib/db/src/schema/viewers.ts`
- `lib/db/src/schema/moderation.ts`
- `lib/db/src/schema/subscriptions.ts`
- `lib/db/src/schema/permissions.ts`

---

# 25. Migration and Rollout Notes

## 25.1 Backfill tasks
Need data backfills for:
- existing `admin` users -> `school_admin` or `super_admin`
- `students.schoolId` from instructor relationships where possible
- `assessments.schoolId` from student or instructor mapping
- `students.viewerCode` generated for existing students
- `intake.medicalConditions` -> `students.medicalConditionsEncrypted`
- `students.licenseNumber` -> encrypted storage if encryption is introduced via new field

## 25.2 Incremental rollout recommendation
### Wave 1
- pedal control
- medical/allergies
- handover safety card
- no-show tracking

### Wave 2
- notification service
- content filtering and moderation

### Wave 3
- schools and tenant scoping
- RBAC hardening
- viewer role

### Wave 4
- booking approvals
- Stripe skeleton
- demo mode

## 25.3 Compatibility note
Because current routes and UI use `admin`, avoid a big-bang rename.
Prefer:
- backend alias support
- frontend label changes first
- route migration second

---

# 26. Testing and Verification Checklist

## 26.1 Pedal control
- create standard assessment with each pedal control option
- create guided assessment with each pedal control option
- verify selection appears in summary and detail
- verify handover shows latest pedal control

## 26.2 Medical and allergies
- add medical conditions and allergies to student
- verify encrypted persistence path works
- verify instructor can view on student detail and handover
- verify viewer cannot access restricted details unless explicitly allowed
- verify audit log entry on access

## 26.3 No-show and cancellation
- mark booking cancelled
- mark booking no_show
- verify in-app notification created
- verify email path invoked
- verify student no-show count increments only on no_show
- verify reliability indicator changes

## 26.4 Content filtering
- save clean handover note, should pass and display
- save profane or grooming-like content, should quarantine
- verify recipient does not see quarantined content
- verify moderation case created
- verify super-admin alert generated
- verify audit log contains actor, route, student, rule hits

## 26.5 Viewer role
- create viewer account
- link by valid student code
- verify only linked student visible
- verify private instructor notes absent
- verify upcoming bookings, summaries, focus areas visible
- test invalid code path and audit logging

## 26.6 Multi-tenancy
- create School A and School B
- verify school admin A cannot view school B data
- verify shared contractor instructor only sees school-scoped data in correct context
- verify super-admin can view both

## 26.7 Booking approvals
- school-managed instructor requests cancellation
- school admin approves
- booking status changes correctly
- audit trail shows requester and approver
- independent instructor still edits directly

## 26.8 Notifications
- update preferences
- register push token
- send booking event and verify in-app and email records
- verify disabled channels are respected

## 26.9 Demo mode
- run demo reset
- verify sample data restored
- verify reset audit log written
- verify only authorised user can trigger reset

## 26.10 Session timeout
- idle for 25 minutes, warning shows
- idle for 30 minutes, session is ended
- activity before timeout resets timer

---

# 27. Acceptance Criteria Summary by Feature

## Pedal control
- fully wired DB -> API -> OpenAPI -> client -> UI
- visible before lesson start and on summary/profile/handover

## No-show tracking
- `no_show` status exists end-to-end
- notifications fan out to in-app and email
- student reliability indicators update

## Medical and allergies
- full fields exist and are prominent in instructor views
- sensitive access is logged and encrypted at rest

## Handover enhancement
- safety-critical pre-lesson briefing card exists and is prominent

## Content filtering
- all scoped text is scanned before delivery
- flagged content is quarantined and reviewable in moderation dashboard
- export capability exists for legal requests

## Viewer role
- linking by student code works
- viewer sees only allowed student data
- payment gate scaffold exists, not enforced

## Calendar hierarchy
- school-managed instructors request changes, not direct-manage
- independent instructors retain direct control

## Driving school entity
- tenant isolation exists and is enforced on server queries
- school admins are school-scoped, super-admin is platform-scoped

## Access control and compliance
- least privilege applied
- RBAC matrix documented
- session timeout implemented
- sensitive fields encrypted and audited

## Subscription tiers
- plans and entitlements exist in data model and config
- Stripe skeleton exists without forced paywall

## Notification infrastructure
- in-app and email channels operate through shared service layer
- push token groundwork exists

## Demo mode
- seeded demo flow can be reset with one action and is audited

---

# 28. Instruction to Replit Agent

Implement this Phase 2 spec incrementally and keep the app compiling after each major area.

Execution rules:
- do not remove existing working features
- extend current Clerk auth and role flow, do not replace it
- preserve mobile and tablet usability
- prefer service-layer refactors where role and policy complexity is increasing
- always wire new fields through schema, API, OpenAPI, generated client, and UI
- always add audit coverage for sensitive reads and writes
- if a feature requires staged enforcement, ship it behind a clearly named feature flag

If current code conflicts with this spec:
- keep existing working behaviour intact
- adapt the implementation cleanly
- do not break current instructor/student flows while adding school, viewer, and super-admin capabilities

This build will be judged not just on functionality, but on safety posture, auditability, multi-tenant correctness, and real-world usability for driving instructors during active lessons.
