---
name: Instructor links hybrid model
description: Schema, API routes, and frontend patterns for the school-admin/instructor hybrid link system.
---

## Key tables
- `school_instructor_links` — links a school_admin USER (not school entity) to an instructor; `status` flow: pending → active | declined | revoked. Has unique constraint on (schoolAdminId, instructorId).
- `instructor_invite_tokens` — single-use UUID tokens for email invite flow; `status`: pending → accepted | expired | cancelled. `claimedByInstructorId` set on acceptance.
- `school_instructors` — legacy table linking a school ENTITY to an instructor; distinct from the above.

## Two link workflows
1. **Link by code** — school admin enters instructor's 6-char `uniqueLinkCode`; creates `active` link immediately (instructor shared code = implicit consent).
2. **Invite by email** — creates `pending` token + sends email via `sendExternalEmail()`; instructor claims via `/join/:token` page → link becomes `active`.

## API route: instructor-links.ts
- `GET /instructor-links` — enriched list (instructor name/email resolved) + pending invites
- `POST /instructor-links/link-by-code` — upserts active link; validates code format `/^[A-Z0-9]{6}$/`
- `POST /instructor-links/invite` — creates token, calls `sendExternalEmail`; body includes `joinBaseUrl` (frontend constructs full URL since server doesn't know the deploy URL)
- `GET /instructor-links/invite/:token` — **no auth** — public preview; used by join page before sign-in
- `POST /instructor-links/invite/:token/claim` — auth required; creates instructor profile if needed, inserts active link, marks token accepted
- `DELETE /instructor-links/:id` and `DELETE /instructor-links/invite/:id` — revoke/cancel

## Join page invite flow (post-auth redirect)
- `/join/:token` stores `pendingJoinToken` in `sessionStorage` when user is signed out
- `HomeRedirect` in `App.tsx` checks `sessionStorage` after sign-in and redirects back to `/join/:token`
- Exported constant `PENDING_JOIN_TOKEN_KEY = "pendingJoinToken"` from `join.tsx`

## Drizzle unique index vs constraint (recurring issue)
- `CREATE UNIQUE INDEX` via raw SQL ≠ `ADD CONSTRAINT ... UNIQUE` in Drizzle's eyes
- Drizzle will re-prompt to add the constraint on every push if only the index exists
- Fix: `DROP INDEX ...; ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (col)`
- Then drizzle-kit push sees the constraint as in-sync

**Why:** Drizzle tracks unique constraints in its schema snapshot separately from plain unique indexes. PostgreSQL allows both but Drizzle only manages the constraint form.

## Frontend
- `school-admin/instructor-management.tsx` — two workflow cards (link by code + invite by email) + active links list + pending invites list
- Sidebar: `UserCog` icon nav item "Instructor Management" added to `school_admin` role
- `join.tsx` — standalone layout (no SidebarLayout); uses `SignUpButton`/`SignInButton` from Clerk with `forceRedirectUrl` set to the join page URL
