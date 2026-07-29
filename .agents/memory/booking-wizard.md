---
name: Student booking wizard
description: Direct-instructor booking flow — how it works end to end.
---

## Rule
`POST /bookings` accepts an optional `instructorId` field. When present:
- Creates booking with `status = "pending"` and `instructorId` pre-set
- Notifies only that instructor (not broadcast to all)
- Returns `broadcastCount: 1`

When absent, the existing broadcast flow runs unchanged.

**Why:** Students arrive at the wizard from `/student/book/:instructorId` (having already chosen an instructor from the search page calendar). They are explicitly booking one instructor, not broadcasting.

**How to apply:** Any future payment/confirmation flow should key off `booking.instructorId` being non-null to mean "direct booking"; null means "broadcast pending claim".

## Calendar endpoint
`GET /availability/instructor/:instructorId/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
Returns `{ instructor: { id, fullName, hourlyRateCents, ... }, days: [{ date, dayOfWeek, windows, bookedSlots }] }`.
Windows come from `instructorAvailabilityTable` (active slots for the instructor).
Booked slots come from `bookingsTable` filtered by status `IN (pending, claimed, confirmed)`.

## Instructor own profile
`GET /instructor/profile` returns the authenticated instructor's own Instructor record (with hourlyRateCents).
Used by the Availability page rate card and any other self-service profile pages.

## Hourly rate
Stored as `hourlyRateCents integer` on `instructorsTable`. Schema pushed.
Saved via `PATCH /instructors/:id`. Displayed on search result cards and in the booking wizard header.

## Route
`/student/book/:instructorId` → `StudentBookWizard` component (React).
"Request Lesson" button on the search results page navigates to this route instead of opening a dialog.
The broadcast dialog is preserved for the "no results" fallback path (`handleBook(null)`).
