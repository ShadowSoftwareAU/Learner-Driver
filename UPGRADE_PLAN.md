# DriveTrack Upgrade Plan

**Generated:** 2026-05-26
**Source:** Client discussion transcript + summary (2026-05-25)
**Status:** Active backlog, prioritised for pre-testing delivery (2026-05-30/31)

---

## Phase 1: Critical Path (Before Testing 2026-05-30)

These items are needed for the end-to-end test and the 3-5 person validation on 2026-05-31.

### 1.1 Assessment UX: Per-Maneuver Notes + Info Button
**Priority:** HIGH | **Effort:** Medium | **Status:** In Progress (code changes submitted)

- **Per-item notes:** Each maneuver in an assessment gets its own notes field (expandable textarea). Notes are saved per maneuver result and automatically rolled up into the lesson-level "Notes from this lesson" section for instructor continuity.
- **Quick-entry pick-lists:** Common comments (e.g. "swings wide", "too tight", "checks mirrors", "forgets indicator") as tap-to-insert chips above the notes field.
- **Info (ℹ️) button/expander:** Per maneuver, shows:
  - QSAFE compliance criteria (e.g. reverse park: max 3 movements, 500mm from kerb)
  - Mastery definition (what "mastered" means for that specific skill)
  - Source: QSAFE manual, TMR Learner Sheet
- **DB changes:** `maneuvers` table gets `compliance_criteria` and `mastery_definition` text columns
- **Initial scope:** Start with reverse parking, three-point turn, U-turn, parallel parking criteria. Expand iteratively.

### 1.2 Region/State Selection on Onboarding
**Priority:** HIGH | **Effort:** Small | **Status:** In Progress (code changes submitted)

- Student selects region (QLD/NSW/VIC/SA/WA/TAS/NT/ACT) and country during onboarding
- Region determines which rules, regulations, and assessment criteria apply
- DB: `students` table gets `region` (text, nullable) and `country` (text, default "AU") columns
- Future: enables interstate and international expansion (different rules per jurisdiction, e.g. VIC hook turns, unit conversions km vs miles)

### 1.3 Guided Lesson Flow (Step-by-Step Mode)
**Priority:** HIGH | **Effort:** Medium | **Status:** In Progress (code changes submitted)

- New `/instructor/assessments/guided` route
- Instructor pre-selects which maneuvers to cover this lesson
- App presents ONE maneuver at a time, full-screen, with large buttons
- Flow: Score it → Add notes → Tap "Next" → Auto-advance to next maneuver
- Summary screen at end before saving
- Big buttons (min 48px touch targets), large text, iPad-optimised
- Accessible via "Start Guided Lesson" button alongside existing "New Assessment"

### 1.4 iPad/Touch-Optimised UI
**Priority:** HIGH | **Effort:** Small | **Status:** In Progress (code changes submitted)

- Larger button heights (h-12 → h-16 minimum)
- Bigger text throughout assessment screens
- More padding on card sections
- Touch-friendly competency level buttons
- Design principle: instructor is supervising a driving student, needs to tap quickly without looking down for long

### 1.5 Fix Teaching Zones Reliability
**Priority:** HIGH | **Effort:** Small | **Status:** TODO

- "Zones isn't working" noted in the discussion
- Debug and fix suburb/postcode zone functionality
- Ensure zone search/filter works correctly for student booking flow

### 1.6 Student Click-Through to Full Profile
**Priority:** HIGH | **Effort:** Small | **Status:** TODO

- Student list → tap → full student profile page
- Profile shows: lesson history, all assessments/markings, notes, prior session details
- Currently noted as "did nothing" in prototype (dummy data not wired)

---

## Phase 2: Post-Testing / Near-Term Build (June 2026)

### 2.1 Verification Gating (Re-enable)
**Priority:** HIGH | **Effort:** Medium | **Status:** TODO (re-enable after testing period)

- Required compliance checks must be completed before instructor can access student data or perform actions
- Verification flow already exists in codebase, needs to be re-enabled and enforced
- Gate: no booking claims, no assessment creation, no student data access until verified

### 2.2 Identity/Compliance Verification
**Priority:** HIGH | **Effort:** Large | **Status:** Research Required

- **Queensland Driver's License validation** via API (TMR or third-party provider)
- **Blue Card / Working With Children Check** verification pathway
- Research: which API providers exist, cost, integration effort
- This is a safeguarding requirement, not optional

### 2.3 Payments + Invoicing (Stripe)
**Priority:** HIGH | **Effort:** Large | **Status:** TODO

- Stripe integration (Apple Pay / PayPal where supported)
- Deposit rules: e.g. 20% non-refundable within cancellation window (24-hour policy)
- Pay-at-booking vs cash vs invoicing options
- Automatic remainder capture on session completion
- Invoice generation suitable for tax/accounting
- **Finance/Payments dashboard:** invoice list, payment status, follow-up buttons (email + SMS)
- Exports: PDF/Excel
- Future: Xero/MYOB integration

### 2.4 Availability Management Upgrade
**Priority:** MEDIUM | **Effort:** Medium | **Status:** TODO

- Multi-day selection (not just individual day slots)
- Date-range unavailable periods (holidays, blocks)
- Calendar integration (Google Calendar / iCal) to prevent double-booking
- Calendar-style UI with clear unavailable indicators
- Currently: basic day-of-week availability slots exist

### 2.5 Student Dashboard + Focus Area Carry-Forward
**Priority:** MEDIUM | **Effort:** Medium | **Status:** TODO

- Student-facing dashboard showing competency summary/trends (e.g. "1 out of 3 competent")
- Auto-carry forward "focus areas for next lesson" from previous assessment into the next session view
- Lesson plan system already exists (`/students/:id/lesson-plan`), needs frontend surfacing and carry-forward logic

### 2.6 Private vs Shareable Notes
**Priority:** MEDIUM | **Effort:** Medium | **Status:** TODO

- Separate private instructor notes from shareable lesson summaries
- Configurable recipient emails per student/program (e.g. parent, guardian, YMCA, PCYs, Juvenile Justice, NDIS provider)
- Automated distribution of shareable summaries after lesson completion
- Private notes: instructor-only, for handover and continuity
- Shareable notes: sanitised lesson summary for stakeholders

### 2.7 Booking Workflow Enhancement
**Priority:** MEDIUM | **Effort:** Small | **Status:** Partially Built

- Student request → instructor schedule → accept/reject flow exists
- Needs polish and testing with real users
- Ensure notifications work correctly for booking claims

---

## Phase 3: Enhanced Features (July+ 2026)

### 3.1 Voice Capture / Dictation
**Priority:** MEDIUM | **Effort:** Medium | **Status:** TODO

- Microphone/dictation input for note fields (Web Speech API or native)
- Voice notes → text conversion
- Post-session "end of day" refinement mode
- AI summarization (e.g. Claude) of voice notes into structured assessment data
- Design: offline capture preferred over live interaction while driving

### 3.2 Session Prompts (Break + End-of-Lesson)
**Priority:** LOW | **Effort:** Small | **Status:** TODO

- Mid-session break reminder (common 1.5-hour pattern)
- End-of-lesson caution: students disengage in last ~10 minutes if praised too early
- Timer-based or instructor-triggered prompts

### 3.3 Vehicle Documentation
**Priority:** LOW | **Effort:** Medium | **Status:** TODO

- Photo/video walkaround before/after lessons (condition documentation)
- Training kilometers tracked separately from commuting
- Vehicle service history and business/personal usage logs
- Accounting/audit context for vehicle expenses

### 3.4 Optional Session Recording
**Priority:** LOW | **Effort:** Medium | **Status:** Research Required

- Audio recording during lessons with explicit consent
- For dispute reduction and safety/audit context
- Research: consent language, retention policies, access controls, privacy obligations
- Storage and privacy implications need legal review

### 3.5 Q-Ride / Motorbike Extension
**Priority:** LOW | **Effort:** Large | **Status:** Future

- Extend beyond car instruction to Q-Ride motorbike training
- Multi-student supervision (4-5+ students) changes UX requirements
- Different assessment criteria and competency frameworks
- Separate onboarding flow for Q-Ride instructors

### 3.6 Analytics + Reporting
**Priority:** MEDIUM | **Effort:** Medium | **Status:** TODO

- Aggregate analytics across all students/instructors (e.g. "20% of learners are on manuals")
- Pie charts, performance metrics, trend data
- Exportable for presentations to ADTA, Transport and Main Roads
- Slide deck / video generation from app data for industry association presentations
- Safety focus area insights from aggregated assessment data

### 3.7 Student Stressors/Triggers + Home Practice Plans
**Priority:** LOW | **Effort:** Medium | **Status:** TODO

- Capture student anxiety triggers (e.g. "cars behind them", "merging")
- Generate structured home practice plans for parents/guardians
- Linked to the private vs shareable notes system

### 3.8 Sidebar/Chapters Navigation
**Priority:** LOW | **Effort:** Small | **Status:** TODO

- Table-of-contents style navigation for fast jumps within assessment (e.g. jump to "Hazard Perception" category)
- Icons for scan-friendly UI
- Useful for longer assessment sessions

---

## Non-App Items (From Discussion, Tracked Separately)

These came up in the conversation but are not DriveTrack code changes:

| Item | Owner | Status |
|------|-------|--------|
| Send NDA via email | Jimmy | TODO |
| Respond to Jimboomba Driving School | Jimmy | TODO |
| Send Replit share link via email | Jimmy | TODO |
| Provide dev database access for testing | Jimmy | TODO (by 2026-05-30) |
| Install Expo Go for on-device testing | Client (instructor) | TODO |

---

## Testing Schedule

| Date | Activity |
|------|----------|
| **2026-05-30** | End-to-end testing with dev database |
| **2026-05-31** | Validation testing with 3-5 people |
| **Post-testing** | Re-enable verification gating |

---

## Design Principles (from the discussion)

1. **Safety first:** Minimal cognitive load during lessons. Big buttons, push-button simplicity.
2. **Instructor reality:** Can't take phone calls, can't scroll through pages while supervising. Device might be thigh-mounted.
3. **Compliance aligned:** Assessment criteria should match QSAFE requirements exactly.
4. **Longitudinal records:** Every student interaction builds a continuous record across instructors and sessions.
5. **Private by default:** Instructor notes are private. Sharing is explicit and configurable.
6. **Region-aware:** Rules change by state/territory. Build for QLD first, but architecture supports expansion.
7. **Speed to market:** First-mover advantage matters. NDA in place, don't disclose platform.
