# LEARNERS_UPGRADE_BUILD_SPEC.md

## Project
DriveTrack, learner driver and instructor management platform for Australian driving schools.

## Purpose of this file
This is the implementation build spec for the next upgrade cycle.
It is written to be used directly inside Replit as the execution brief.

This file is different from `UPGRADE_PLAN.md`.
- `UPGRADE_PLAN.md` is the strategic roadmap.
- `LEARNERS_UPGRADE_BUILD_SPEC.md` is the practical build spec.

---

# 1. Current State

The repository already includes the following implemented upgrades:

## Already built
1. **Student onboarding region selection**
   - State selector for QLD, NSW, VIC, SA, WA, TAS, NT, ACT
   - Student profile now supports `region` and `country`

2. **Assessment UX upgrade**
   - Per-maneuver notes
   - Expandable maneuver rows
   - Info button for compliance criteria and mastery definition
   - Larger touch-friendly controls

3. **Guided lesson mode**
   - Route: `/instructor/assessments/guided`
   - One maneuver at a time assessment flow
   - Summary before save

4. **Assessment detail enhancements**
   - Per-maneuver notes displayed inline
   - Combined maneuver notes section

5. **Schema/API groundwork**
   - `students.region`
   - `students.country`
   - `maneuvers.compliance_criteria`
   - `maneuvers.mastery_definition`

6. **Compliance seed script scaffold**
   - `scripts/src/seed-compliance-criteria.ts`

## Important note
The remaining requested features from the discussion are **not fully built yet**.
They are to be implemented from this spec.

---

# 2. Product Goals for This Upgrade Cycle

This upgrade cycle should make the app significantly more usable for real-world instructors during active lessons.

The app must support:
- safer in-lesson use
- less typing during lessons
- clearer compliance guidance
- continuity between lessons
- better student history visibility
- stronger scheduling and workflow foundations

Design for actual driving instructors, not office admins.
That means:
- big buttons
- minimal cognitive load
- very few taps
- clear next actions
- mobile/tablet friendly layouts

---

# 3. Implementation Scope

This build should cover **Phase A, Phase B, and Phase C** below.

---

# Phase A, Assessment and Student Continuity

## A1. Carry forward focus areas into next lesson
### Goal
When an instructor starts a new assessment, show the previous lesson's `focusAreasNext` and optionally prefill the current lesson objective.

### Requirements
- On the new assessment screen, when a student is selected:
  - fetch the most recent previous assessment for that student
  - display:
    - previous lesson date
    - previous overall note summary
    - previous `focusAreasNext`
- Add a UI section:
  - title: `Previous Lesson Carry Forward`
  - button: `Use as today's focus`
- If tapped, copy the previous `focusAreasNext` into the current focus area field

### Backend
- Reuse existing assessments endpoint if practical
- If needed, add endpoint:
  - `GET /students/{id}/latest-assessment`

### Acceptance criteria
- Selecting a student on new assessment loads prior lesson context
- Instructor can carry prior focus areas into the new lesson with one tap

---

## A2. Student full profile click-through
### Goal
Student list entries must open a complete student detail view with useful teaching context.

### Requirements
Student detail page must show:
- student core profile
- total hours
- region/state
- lesson history
- past assessments
- latest focus areas
- handover notes
- competency summary by category

### UI sections
- Profile summary card
- Progress summary card
- Assessment history list
- Handover notes list
- Upcoming bookings card

### Acceptance criteria
- Student list row click opens meaningful profile page
- Instructor can review past lessons quickly before starting new one

---

## A3. Quick note chips for per-maneuver comments
### Goal
Reduce typing during lessons.

### Requirements
For each maneuver note area, add quick-entry chips such as:
- too wide
- too tight
- missed mirror check
- forgot indicator
- good control
- needs repetition
- hesitant
- smooth execution

Behavior:
- tapping a chip appends it into the maneuver notes field
- multiple chips can be tapped
- instructor can still type freely

### Acceptance criteria
- Chips are visible in expanded maneuver note areas
- Tapping chips updates notes immediately

---

## A4. Category summary on assessment save screen
### Goal
Give instructors a clean overview before final save.

### Requirements
On guided assessment summary and standard assessment completion summary:
- show category breakdown
- count how many maneuvers were:
  - not attempted
  - attempted
  - practiced
  - mastered
- show highlighted items with notes

### Acceptance criteria
- Summary screen shows useful pre-save snapshot
- Instructor can quickly verify lesson record quality

---

# Phase B, Compliance and Safer Workflow

## B1. Seed real compliance criteria into key maneuvers
### Goal
The info button must actually be useful.

### Requirements
Populate compliance criteria and mastery definitions for the initial core maneuvers:
- reverse parallel parking
- three-point turn
- U-turn
- lane changing
- brake control
- steering control
- roundabouts
- hill start
- emergency stop
- hazard perception

### Deliverables
- complete the `seed-compliance-criteria.ts` script
- ensure naming matches actual seeded maneuver names in DB
- safe to run multiple times

### Acceptance criteria
- key maneuver info dialogs display real content
- script runs without duplicating data badly

---

## B2. Mastery guidance in assessment UI
### Goal
Help instructors understand what qualifies as mastered.

### Requirements
When a maneuver is marked `mastered`:
- visually reinforce the mastery definition
- optionally show a subtle confirmation note below the controls
- if no mastery definition exists, show nothing extra

### Acceptance criteria
- mastered state feels deliberate and guided
- no modal spam or annoying interruptions

---

## B3. End-of-lesson prompt system
### Goal
Support real instructor workflow timing.

### Requirements
For lessons 90 minutes or longer:
- show optional prompt at roughly 45 minutes:
  - `Mid-lesson checkpoint`
- show optional prompt near end:
  - `Wrap-up soon. Avoid ending too early if student still needs focus.`

Implementation can be lightweight:
- use client-side timer in guided mode only for now
- no background notification system required yet

### Acceptance criteria
- prompts appear during guided lessons only
- prompts are dismissible
- no complex scheduler needed

---

## B4. Verification gating re-enable plan
### Goal
Restore compliance gate after demo/testing period.

### Requirements
Do not fully enforce it yet if the current testing workflow depends on bypass.
Instead:
- add config constant or feature flag with clear label
- label current state in code clearly:
  - demo bypass on/off
- prepare logic so re-enabling is one small change

### Acceptance criteria
- gate is easy to re-enable later
- code is clearly documented

---

# Phase C, Scheduling, Bookings, and Instructor Operations

## C1. Availability upgrade, date range blocks
### Goal
Let instructors mark unavailable periods properly.

### Requirements
Extend availability system to support:
- unavailable date ranges
- holiday blocks
- one-off unavailable days

### Data model
If needed, add a new table like:
- `instructor_unavailability`
  - id
  - instructor_id
  - start_date
  - end_date
  - reason
  - created_at

### UI
On instructor availability page:
- add `Add unavailable period`
- allow start date, end date, reason
- show list of blocked periods

### Acceptance criteria
- instructor can block holiday dates without hacking weekly schedule

---

## C2. Zones reliability fix and polish
### Goal
Make teaching zones actually trustworthy.

### Requirements
Review and fix zone management so:
- zones save reliably
- suburb/postcode data displays correctly
- instructor zone coverage is easy to read

Add polish:
- sort zones by postcode then suburb
- allow deletion/editing cleanly
- show empty state guidance

### Acceptance criteria
- zone workflow feels stable
- no silent failures

---

## C3. Booking request decision flow polish
### Goal
Make it clearer for instructors to manage booking requests.

### Requirements
On instructor bookings screen:
- split bookings into tabs or sections:
  - pending requests
  - confirmed
  - completed
  - cancelled
- pending requests need strong action buttons:
  - accept
  - decline
- show suburb, postcode, transmission type, requested date/time clearly

### Acceptance criteria
- instructor can process pending bookings quickly
- booking state is obvious

---

## C4. Student dashboard carry-forward surfacing
### Goal
Students should see their progress more clearly.

### Requirements
On student dashboard:
- show latest lesson summary
- show current focus areas for next lesson
- show top skills needing work
- show mastered count vs total tracked skills

### Acceptance criteria
- student dashboard feels alive and useful, not just static numbers

---

# 4. Nice-to-Have if Time Permits

These are optional if the core scope above is complete.

## D1. Dictation-ready note input placeholder
- Add microphone icon placeholder in lesson note areas
- no actual speech-to-text required yet
- clicking can show `Voice dictation coming soon`

## D2. Assessment chapter navigation
- Add category jump navigation on standard assessment screen
- helpful for longer checklists

## D3. Better visual progress in guided mode
- category progress
- completed count
- notes entered count

---

# 5. Files Likely to Change

## Frontend
- `artifacts/driving-app/src/pages/instructor/new-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/guided-assessment.tsx`
- `artifacts/driving-app/src/pages/instructor/student-detail.tsx`
- `artifacts/driving-app/src/pages/instructor/bookings.tsx`
- `artifacts/driving-app/src/pages/instructor/availability.tsx`
- `artifacts/driving-app/src/pages/student/dashboard.tsx`
- possibly shared UI components under `artifacts/driving-app/src/components/`

## Backend
- `artifacts/api-server/src/routes/assessments.ts`
- `artifacts/api-server/src/routes/students.ts`
- `artifacts/api-server/src/routes/availability.ts`
- `artifacts/api-server/src/routes/bookings.ts`
- possibly a new route for latest assessment carry-forward

## DB
- `lib/db/src/schema/availability.ts`
- possibly new schema file for unavailability blocks
- related exports in `lib/db/src/schema/index.ts`

## API contract
- `lib/api-spec/openapi.yaml`
- generated files:
  - `lib/api-client-react/src/generated/api.schemas.ts`
  - `lib/api-zod/src/generated/api.ts`

## Scripts
- `scripts/src/seed-compliance-criteria.ts`

---

# 6. Implementation Rules

1. Do not remove existing working features.
2. Preserve current auth and role flows.
3. Keep mobile and tablet friendliness high.
4. Prefer simple clear UI over clever UI.
5. Keep naming consistent with current codebase.
6. If adding DB fields or tables, wire them through schema, API, and UI properly.
7. Any new feature should feel usable by an instructor in a real lesson, not just technically complete.

---

# 7. Testing Checklist

## Assessment flow
- create standard assessment
- create guided assessment
- save maneuver notes
- open info dialogs
- confirm notes appear on assessment detail screen
- confirm combined notes appear

## Carry-forward
- previous assessment loads when student is selected
- previous focus area can be copied into new lesson

## Student profile
- student detail loads correctly
- history and notes are visible

## Availability
- unavailable range can be created and shown

## Zones
- add zone
- edit zone if supported
- delete zone if supported
- verify display order and persistence

## Student dashboard
- latest lesson summary visible
- focus area visible
- mastered count visible

---

# 8. Final Output Expected From Replit Build

When this spec is implemented, the app should feel like this:
- instructor selects student
- immediately sees previous lesson context
- can start standard or guided lesson
- can score with big buttons
- can tap quick note chips instead of typing everything
- can check compliance info quickly
- can save a clean structured lesson record
- can review full student context before the next lesson
- can manage bookings, zones, and availability with less friction

That is the target state for this build cycle.

---

# 9. Recommended Build Order

Build in this order:
1. A1 carry-forward focus areas
2. A2 student full profile improvements
3. A3 quick note chips
4. B1 compliance seed completion
5. C2 zones reliability fix
6. C1 unavailability/date range blocks
7. C3 booking flow polish
8. C4 student dashboard improvements
9. B3 lesson prompts
10. D items if time remains

---

# 10. Instruction to Replit Agent

Implement this spec incrementally.
After each major section:
- keep the app compiling
- keep UX consistent
- avoid breaking existing role routes
- prefer visible working progress over hidden incomplete plumbing

If something in the current codebase conflicts with this spec, preserve existing working behaviour and adapt the implementation cleanly.
