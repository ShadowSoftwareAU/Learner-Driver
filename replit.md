# DriveTrack

A full-stack driving school assessment platform for Australian learner drivers, supporting three roles: Student, Instructor, and Admin.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- Auth: Clerk (`@clerk/clerk-react` on frontend, `@clerk/express` on server)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/driving-app/` — React + Vite frontend
- `artifacts/api-server/` — Express API server
- `lib/db/src/schema/` — Drizzle ORM table definitions (users, students, instructors, maneuvers, assessments, handover_notes, intake, audit_logs)
- `lib/api-spec/openapi.yaml` — OpenAPI 3.0 contract (source of truth for API)
- `lib/api-client-react/` — generated TanStack Query hooks (Orval)
- `lib/api-zod/` — generated Zod schemas and TypeScript types (Orval)

## Architecture decisions

- Contract-first API: OpenAPI spec drives code generation for both client hooks and server Zod schemas
- Clerk proxy middleware on `/api/__clerk` routes Clerk FAPI through the app domain (for production)
- Maneuver enums (competency levels, roles) are inlined in `artifacts/driving-app/src/lib/enums.ts` rather than imported from server-side `@workspace/api-zod`
- Audit log is appended non-fatally on every significant action (view, create, update)
- Student `total_hours` is maintained by the assessment creation endpoint using raw SQL `UPDATE ... SET total_hours = total_hours + X`

## Product

- **Instructor**: Log assessments against TMR Learner Sheet + QSAFE maneuver categories; view student progress; write handover notes; access previous lesson history
- **Student**: View own progress dashboard, mastered maneuvers, and instructor feedback
- **Admin**: Fleet overview, student/instructor tables, system-wide audit log
- 44 seeded maneuvers across 8 TMR categories + QSAFE compliance criteria

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Use `@clerk/clerk-react` (not `@clerk/react`) for the frontend Clerk package
- `Show` is not exported from `@clerk/clerk-react` — use `SignedIn`/`SignedOut` instead
- `publishableKeyFromHost` is not in `@clerk/clerk-react/internal` — use `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` directly
- Do NOT import `@workspace/api-zod` in the frontend — it's a server-side lib; use `artifacts/driving-app/src/lib/enums.ts` for shared enum values
- After editing routes, restart the API server workflow (esbuild bundles on start)
- Orval regenerates `lib/api-zod/src/index.ts` on every codegen run. Do NOT add `schemas: { path: "generated/types" }` to the zod output config — it causes TS2308 name conflicts. The codegen script post-processes `src/index.ts` to keep only `export * from './generated/api'`
- `lib/object-storage-web` must have `composite: true` in its tsconfig so it can be referenced by `artifacts/driving-app`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
