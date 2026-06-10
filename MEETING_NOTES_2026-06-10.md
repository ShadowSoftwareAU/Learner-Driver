# Meeting Notes: 10 June 2026

## Context
Weekly meeting between Jimmy (Speaker 2/3, Shadow Software) and Dayv (Speaker 1, driving instructor/partner).
Two recordings: (1) Dayv debriefs demo meeting with Rach's school, (2) commercial viability and funding discussion.

## Demo Meeting Attendees
- Dayv (presenter)
- Rach (driving school owner)
- Tammy (management consultant / accountant)
- Red Bank School representative (P&C head, RSL president, ex-navy)

## What Was Well Received
- Assessment records: loved by all
- Heatmaps: well received by Red Bank School guy
- Reporting: "very, very well received by all parties"
- History of training notes / handover: they love it
- Overall verdict: "We are on the right track"

## Feature Requests / Pain Points

### From Rach (Driving School Owner)
- **No-show tracking**: Record when NDIS/school students don't show up or cancel. Critical for their world.
- **Pedal control flag**: Capture who operates pedals (instructor vs student). Early learners = instructor on pedals, student steers. Handover safety issue.
- **Calendar permission hierarchy**: School owner controls calendar. Instructors should NOT be able to create/cancel appointments. Only request changes. (Rach had a trainer using her password while she was in Vietnam.)
- **Medical conditions / allergies**: Capture in student profile for in-car safety.
- **Online booking**: Some trainers don't have laptops/internet. Need mobile app as well as web.

### From Tammy (Management Consultant)
- Native app alongside web app
- Business profile for driving schools
- Bulk student management

### From Red Bank School Guy
- Reports and record chains
- Mentor access to the system
- Government compliance documentation

## Organisational Hierarchy (Confirmed)

```
Driving School (Admin/Owner - e.g. Rach)
├── Instructor A (external contractor)
├── Instructor B (external contractor)
├── Other Driving Schools (Rach takes bookings for independents)
│   └── Their instructors
└── Students
    ├── Parents/Guardians (viewer, ~$2/mo)
    ├── Mentors (school-based, drive practice only)
    └── Support Workers (NDIS, ~$2/mo)
```

## Government Opportunity (CONFIDENTIAL)
- Red Bank School initiative launching Wednesday
- Ministers and press involved
- QLD Government pushing mentor-in-schools program across multiple schools
- DriveTrack positioned perfectly if feature set covers school + mentor + student + instructor workflows

## Revenue Model

| Tier | Who Pays | Price Point |
|------|----------|-------------|
| Student | Free | $0 |
| Parent/Guardian | Micro-sub for read access | ~$2/mo |
| Mentor/Support Worker | Same as parent | ~$2/mo |
| Instructor (independent) | Subscription | ~$29/mo |
| Driving School | School subscription | ~$99/mo |
| Enterprise/Government | Bulk pricing | Annual banded |

- Each student = 2-4 paying users
- Feature gating by tier (calendar/booking locked to school tier)

## Commercial Context
- Rach's school is cash-poor (doing NDIS work on the side)
- Phil Utheridge (Uther Driving School) pays $100/mo for a Google Forms solution
- Current build worth $4-5k as client project
- AI credits burn ~$100 quickly on backend work
- Need project self-funded ASAP
- Google Play + Apple App Store accounts active under Shadow Software
- TestFlight ready

## Investment Pitch (for Friday meeting)
- Propose: ~$2k upfront from school
- In return: lifetime school-level access
- Individuals underneath still pay their subs
- Government opportunity = separate (larger) funding avenue

## Key Technical Decisions
- Content filtering on all communications (profanity, grooming, PII sharing)
- Developer notification on filter breach (for legal/police investigations)
- Immutable audit trail for all content
- SOC2 and ISO27001 compliance posture
- Contract owner responsible for role provisioning (no SCIM yet)
- Lean Six Sigma methodology for all development
- Mobile/iPad first design

## Action Items
1. Build Phase 2 spec (DONE - see PHASE_2_BUILD_SPEC.md)
2. Implement quick wins for demo (pedal control, medical fields, handover enhancement)
3. Prepare presentation/demo pack for school pitches
4. Friday meeting with Rach/Tammy to discuss funding
5. Consider government funding avenues post-Wednesday announcement

## Competitive Landscape
- Current competitor: Google Forms solution ($100/mo, broken)
- DriveTrack advantage: purpose-built, compliance-ready, multi-role, audit trail, child safety
