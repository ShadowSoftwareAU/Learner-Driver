---
name: Admin staff permission model
description: How the two-tier admin access system works — master tier vs staff, where permissions are stored, and how nav is gated.
---

## Rule
Two tiers of admin access:
- **Master tier**: `users.role = 'admin'` AND `users.adminSubRole IN ('owner', 'manager')`. Full access to everything. No DB lookup needed — derived from profile alone.
- **Staff**: `users.role = 'admin'` without owner/manager subRole. Access limited by `admin_staff_permissions` table flags.

Permission flags: `canViewBilling`, `canManageInstructors`, `canManageCompliance`, `canViewAuditLog`, `canManageBookings`.

**Why:** Owner/Manager are appointed system-wide. Staff are invited with scoped access. Keeping master tier as a profile check (not a DB flag) means it can never be accidentally revoked via the permissions endpoint.

## How to apply
- `GET /admin/permissions/me` returns `{ isMasterTier, can* }`. Master tier returns all `true`.
- `useAdminPermissions()` hook in `artifacts/driving-app/src/hooks/useAdminPermissions.ts`:
  - Returns `FULL_ACCESS` immediately for master tier (no query, derives from profile).
  - Fetches `/admin/permissions/me` only for non-master admins (`enabled: role === 'admin' && !isMasterTier`).
  - Returns `NO_ACCESS` while loading (conservative default).
- `SidebarLayout` uses `useAdminPermissions()` to filter admin nav items dynamically.
- Staff invite flow: `POST /admin/staff/invite` → email with `/admin-join/:token` link → `POST /admin/staff/invite/:token/claim` promotes user to `role='admin'` and inserts permissions row.
- On staff removal: role set back to `'unassigned'`, permissions row deleted.
- Cannot modify or remove owner/manager via the API (returns 400).

## Session storage pattern
`PENDING_ADMIN_JOIN_TOKEN_KEY` exported from `admin-join.tsx`. `HomeRedirect` in `App.tsx` checks this key after sign-in, same pattern as `PENDING_JOIN_TOKEN_KEY` for instructor invites. Checked after instructor token (instructor check returns early).
