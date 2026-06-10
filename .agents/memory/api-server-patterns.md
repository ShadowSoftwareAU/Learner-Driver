---
name: API server patterns
description: Recurring patterns and gotchas in artifacts/api-server route code
---

## getOrCreateUser call pattern
Signature: `getOrCreateUser(clerkId: string, email: string, name?: string)`
Call it as: `getOrCreateUser(req.clerkUserId, "")` — not `getOrCreateUser(req)`.

**Why:** The function is not a middleware helper that takes a Request; it resolves the DB user by clerkId.

## Zod in api-server
`zod` is NOT automatically available in `api-server` — it has no direct zod dependency by default.
- Add it: `pnpm --filter @workspace/api-server add zod`
- Import as: `import { z } from "zod"` (NOT `zod/v4` — that subpath does not exist in this workspace)
- `zod/v4` subpath throws "Cannot find module 'zod/v4'" at typecheck time.

## drizzle-orm and() with dynamic conditions
`and()` requires ≥2 arguments at the type level. When building a dynamic condition array, use:
```ts
const conditions = [];
// push conditions...
.where(conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions as Parameters<typeof and>))
```

**Why:** `and(singleCondition)` typechecks as "Expected 2-3 arguments, got 1".

## schoolInstructorsTable columns
Actual columns: `id`, `schoolId`, `instructorId`, `roleWithinSchool`, `isPrimary`, `status` ("active"|"inactive"|"pending"), `joinedAt`, `endedAt`.
- No `userId` column — join through instructorsTable to reach userId.
- No `isActive` boolean — use `eq(status, "active")` instead.
