# REPLIT_MASTER_PROMPT_TEMPLATE.md

## Purpose
Use this as the default master template for future Replit agent build prompts.

The goal is to keep prompts commercially sharp, operationally realistic, technically consistent, and aligned with Jimmy's preferences.

---

# [PROJECT NAME] — Replit Build Prompt

## 1. Context
This project is for real-world use, not just a demo.

Primary users:
- [list the core users]

Primary environment:
- [mobile, tablet, desktop, field use, admin office, workshop, vehicle, etc.]

Primary business outcome:
- [revenue, automation, compliance, safety, operational efficiency, reduced admin, etc.]

Project context:
- [one short paragraph on what the app does and why it matters]

Before building:
- pull latest from GitHub if the repo is connected
- preserve existing working behaviour unless this prompt explicitly replaces it
- do not do a big-bang rewrite when an incremental migration will work

---

## 2. Core Product Rules
- Do not break existing working flows
- Extend current auth, role, and data patterns rather than replacing blindly
- Optimise for low friction, low taps, and low typing
- Keep mobile and tablet usability strong
- Use simple, everyday language in UI copy
- Prefer real operator workflows over office-admin assumptions
- Reuse live data and connected systems where possible
- Manual re-entry is waste
- If safety, privacy, or compliance conflicts with convenience, safety wins
- Keep the app commercially useful, not just technically impressive

---

## 3. Methodology and Decision Rules
Apply these principles throughout the build.

### Lean Six Sigma
Use DMAIC thinking where relevant:
- Define the workflow gap or risk
- Measure what matters
- Analyse the source of waste, friction, or failure
- Improve the workflow with practical changes
- Control the outcome with logs, validation, and clear state transitions

### Security and compliance by design
- Use least-privilege access
- Audit sensitive reads and writes
- Encrypt sensitive fields at rest where relevant
- Use explicit role and scope checks server-side
- Prefer explainable rules over black-box behaviour in high-risk workflows
- Route low-confidence decisions to manual review where needed

### Operational realism
- Build for the person actually using the product in the moment
- Reduce duplicated effort
- Design around real bottlenecks
- Prefer automation when source data already exists elsewhere
- Prefer clear workflows over clever abstractions

### Tradeoff order
When tradeoffs appear, prioritise in this order:
1. Safety
2. Data integrity
3. Compliance and auditability
4. Compatibility with current working behaviour
5. Operator speed and usability
6. Technical elegance

---

## 4. Standard Stack Assumptions
Use the standard Shadow Software Replit stack unless the repo already uses a different stack and this prompt says not to change it.

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + Shadcn/ui + Radix UI + Lucide icons
- Forms: React Hook Form + Zod
- Data fetching: TanStack Query
- Backend: Express.js
- Database: PostgreSQL or Neon PostgreSQL
- ORM: Drizzle ORM
- API contract: OpenAPI where already in use
- Client generation: Orval where already in use
- Hosting: Replit

Do not introduce extra frameworks or infrastructure unless there is a strong reason.

---

## 5. Technical Standards
### Required wiring path for new fields or features
Every meaningful new field or feature must be wired through:
1. DB schema
2. migration or schema push handling
3. backend validation and service logic
4. API contract or route payloads
5. generated types or clients where used
6. frontend hooks and pages
7. audit or monitoring coverage where applicable

### Service-layer preference
If logic is reused, sensitive, policy-heavy, or likely to grow, move it into a shared service layer.
Do not bury core business rules in random route handlers or page components.

### Backward compatibility
If roles, enums, status values, or schemas change:
- include migration handling
- preserve compatibility during rollout where practical
- use aliases or tolerance paths if needed
- avoid unnecessary breaking changes

### Feature flags
Put risky or staged features behind clear flags, especially:
- billing enforcement
- moderation hard blocks
- admin-only controls
- session enforcement changes
- rollout-sensitive integrations

---

## 6. Business and User Reality
Design for actual use, not idealised use.

User reality:
- [describe the frontline user context]
- [describe the admin or management context]
- [describe device, timing, and environmental constraints]

Business reality:
- [describe commercial constraints]
- [describe pricing or revenue expectations]
- [describe where automation reduces labour or support burden]

What must not go wrong:
- [list operational or compliance failures that are unacceptable]

---

## 7. Implementation Scope
For each feature below, implement fully and keep the app compiling after each major area.

### Feature A: [name]
Goal:
- [what this solves]

Why it matters:
- [operational, commercial, safety, or compliance reason]

Backend:
- [routes, services, policies, integrations]

Schema:
- [tables, fields, constraints, indexes]

Frontend:
- [pages, components, flows, UI behaviours]

Security or compliance notes:
- [audit, access control, encryption, moderation, retention, etc.]

Acceptance criteria:
- [clear success conditions]

### Feature B: [name]
Goal:
- [what this solves]

Why it matters:
- [operational, commercial, safety, or compliance reason]

Backend:
- [routes, services, policies, integrations]

Schema:
- [tables, fields, constraints, indexes]

Frontend:
- [pages, components, flows, UI behaviours]

Security or compliance notes:
- [audit, access control, encryption, moderation, retention, etc.]

Acceptance criteria:
- [clear success conditions]

Repeat as needed.

---

## 8. Migration and Rollout Plan
If this build changes live behaviour, include:
- migration rules for existing data
- backward compatibility handling
- phased rollout order
- manual review queues for low-confidence decisions
- any safe fallback behaviour

Preferred rollout pattern:
- quick wins first
- infrastructure second
- permissions and compliance hardening third
- monetisation or optimisation after the foundations are stable

---

## 9. Verification Requirements
Before handoff, verify the work properly.

Minimum expectations:
- app compiles
- changed flows work end-to-end
- schema and API remain in sync
- generated types or clients are updated where required
- no obvious regression to existing working features
- acceptance criteria are satisfied

If relevant, also verify:
- role-based access
- audit log creation
- feature flag behaviour
- migration safety
- mobile or tablet usability
- notification or integration behaviour

---

## 10. Files Likely to Change
List likely files or directories up front so the Replit agent can orient faster.

Examples:
- `artifacts/app/src/pages/...`
- `artifacts/api-server/src/routes/...`
- `artifacts/api-server/src/lib/...`
- `lib/db/src/schema/...`
- `lib/api-spec/openapi.yaml`
- `lib/api-client-react/...`

---

## 11. Delivery Rules
- Keep changes focused
- Do not gold-plate
- Do not add complexity for its own sake
- Keep naming and structure consistent with the repo
- Prefer practical implementation over theoretical perfection
- If a rule conflict appears, choose safety, data integrity, and compatibility first
- If source systems already hold the truth, integrate instead of duplicating manually

---

# Optional Add-On Blocks

## Add-On A: Compliance-Heavy Project
Use this block when the project involves children, health, finance, legal risk, or sensitive identity.

Add these rules:
- all sensitive reads and writes must be auditable
- restricted data must be encrypted at rest where appropriate
- permission boundaries must be enforced server-side
- moderation or incident pathways must support evidence retention
- low-confidence identity or risk outcomes go to manual review
- avoid unsupported compliance certification claims, but design in alignment with strong governance principles

## Add-On B: Revenue-First Product
Use this block when the product needs to self-fund or monetise quickly.

Add these rules:
- pricing tiers should be reflected in the data model early
- feature gating can be scaffolded before enforcement
- recurring revenue opportunities should be surfaced where natural
- avoid features that create heavy manual support burden unless commercially justified
- build for operational leverage, not just feature count

## Add-On C: Field-Operator or Mobile-First Product
Use this block when users are on the move, in vehicles, on worksites, or in hospitality environments.

Add these rules:
- large touch targets
- very short paths to common actions
- reduce typing wherever possible
- keep critical info visible without deep navigation
- design for interruption, glare, movement, or partial attention

## Add-On D: Automation-Centric Product
Use this block when the system should reduce admin and sync from other sources.

Add these rules:
- if source data already exists elsewhere, pull it automatically where feasible
- every meaningful action should emit an event if downstream automation depends on it
- avoid copy-paste workflows where structured sync is possible
- store source references so events and automations remain traceable

---

# Quick Summary Version
Use this when you need a shorter lead-in before the detailed scope.

Build practical, commercially useful software for real operators using the standard Shadow Software Replit stack. Preserve what already works, minimise manual re-entry, automate from real data sources, design mobile-first, keep the UI simple, and treat compliance, privacy, auditability, and role boundaries seriously anywhere trust is involved. Use explicit schemas, clear API contracts, service-layer logic, staged rollouts, and strong acceptance criteria. Prefer real-world usability and revenue leverage over overengineered theory.