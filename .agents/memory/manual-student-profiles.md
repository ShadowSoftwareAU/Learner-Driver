---
name: Manual student profiles & instructor ownership
description: How instructor-created (account-less) students work and the invariants to preserve across the codebase
---

# Manual / instructor-created student profiles

DriveTrack supports two kinds of student records:
- self-onboarded students, where `students.userId` points at their `users` row
- instructor-created manual profiles, where `students.userId` is NULL and `students.createdByInstructorId` points at the creating instructor

## Invariants

- `students.userId` is **nullable** (Postgres allows multiple NULLs even though the column is `unique()`). Never assume a student has a `userId`.
  - **Why:** instructor-created learners have no auth account. Code that inserts notifications, looks up the owning user, etc. must guard with `student?.userId` or it crashes / fails typecheck.
  - **How to apply:** any new code touching `studentsTable.userId` must handle null (e.g. skip notification delivery when null).

- Instructor → student ownership is determined by THREE signals, in this order: `createdByInstructorId` match, an assessment, or a booking.
  - **Why:** there are **two** separate `instructorHasStudent()` implementations — one in `routes/students.ts`, one in `routes/handover.ts`. They drifted once (handover omitted the `createdByInstructorId` case, 403ing instructors on students they created).
  - **How to apply:** when you change the ownership rule, update BOTH copies in lockstep (or extract a shared predicate).

## Private object storage serves PII

- `GET /storage/objects/*` and `POST /storage/uploads/request-url` (`routes/storage.ts`) now require auth (`requireAuth`).
  - **Why:** these serve/issue URLs for sensitive PII (licence front/back photos, headshots, including minors). `requireAuth` uses Clerk `getAuth`, which reads the `__session` cookie, so same-origin `<img src>` requests still load in production. Cross-site dev-preview iframe cookies are blocked — images may 401 there; test in a real tab.
  - **How to apply:** there is still no per-object ACL (any authenticated user can fetch any object path). If stricter isolation is needed, wire `canAccessObjectEntity` with the Clerk user id.
