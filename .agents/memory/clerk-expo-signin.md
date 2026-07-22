---
name: Clerk Expo sign-in API
description: How to do email/password sign-in with @clerk/expo 4.x / @clerk/react 6.x
---

Rule: do NOT use `const { signIn, setActive, isLoaded } = useSignIn()` with @clerk/react 6.x — that hook now returns a signals-based `SignInSignalValue` (`{ signIn, errors, fetchStatus }`) with no `isLoaded`/`setActive`. Destructuring the old shape yields undefined and handlers silently no-op (button does nothing, no error).

**Why:** @clerk/expo 4 re-exports the new signals `useSignIn` from @clerk/react 6; the old tutorial pattern fails silently at runtime, and an `as any` cast hides the bug from typecheck.

**How to apply:** use the stable resource API instead:
`const clerk = useClerk();` then `await clerk.client.signIn.create({ identifier, password })`, check `result.status === "complete"`, then `await clerk.setActive({ session: result.createdSessionId })`. Guard on `clerk.loaded`. (A legacy hook also exists at `@clerk/react/legacy` if ever needed.)
