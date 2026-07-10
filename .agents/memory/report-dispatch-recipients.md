---
name: Report dispatch recipient model
description: How assessment report approval emails are addressed (guardian, school, instructor) and why a separate email path is needed for non-user recipients.
---

Assessment approval dispatch must reach people who don't have a Learner Log
user account: parent/guardian, an external school's inbox, or a partner
group. The standard notification path (`sendNotification`/`sendEmail`)
requires a `notificationsTable` row with a non-null `userId`, so it cannot be
reused for these recipients as-is.

**Decision:** built a parallel `sendExternalEmail()` path in `emailChannel.ts`
that sends directly via the provider (Resend) without writing to
`notificationsTable`, logging attempts through the shared logger instead of a
DB row.

**Why:** avoids forcing fake/placeholder user rows just to satisfy a
not-null constraint, and keeps the "who has an account" invariant clean.

**How to apply:** any future feature emailing a non-account recipient
(school admins, guardians, agencies) should reuse `sendExternalEmail()`
rather than relaxing `notificationsTable.userId` to nullable.
