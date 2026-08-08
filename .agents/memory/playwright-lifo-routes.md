---
name: Playwright LIFO route ordering
description: Playwright 1.62 registers routes with unshift() so last-registered = first-matched; specific routes must be registered AFTER the catch-all.
---

# Playwright route ordering is LIFO in v1.62

## The rule
In Playwright 1.62, `page.route()` uses `unshift()` internally — the **last** registered route is **first** to be evaluated. To make specific routes win over a catch-all, register the catch-all **first** and specific routes **after** it.

**Why:** The implementation in playwright-core prepends each new route to the front of the internal list. So registration order in code is the reverse of processing order.

**How to apply:**
```typescript
// ✅ Correct — catch-all first, specifics last (highest priority)
await page.route(/\/api\//, catchAllHandler);          // processed last
await page.route(/\/api\/users\/me$/, specificHandler); // processed first

// ❌ Wrong — catch-all last swallows everything before specifics can match
await page.route(/\/api\/users\/me$/, specificHandler); // processed last (missed)
await page.route(/\/api\//, catchAllHandler);           // processed first (wins)
```

## Also: use RegExp not glob strings for API routes
String globs like `"**/api/terms/status"` can fail to beat `"**/api/**"` even when registered first. RegExp patterns (`/\/api\/terms\/status$/`) are unambiguous and match against the full URL `href`.

## Also: TanStack Query stale-cache on detail pages
After a PATCH mutation (via `useUpdateAssessment` without cache invalidation), TanStack Query serves stale data on subsequent client-side navigations. For E2E tests asserting detail-page content post-save, use `page.goto()` to force a fresh network request rather than relying on the background refetch timing.
