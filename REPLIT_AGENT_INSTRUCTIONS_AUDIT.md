# Replit Agent Instructions Audit and Master Prompt Template

## Purpose
This document captures the recurring instructions, methodologies, and preferences used across Jimmy's current GitHub projects and build prompts.

It is intended to help produce a stronger standard prompt template for future Replit agent work.

---

# 1. Repositories Reviewed

Current local Git repos found in workspace:
- `learner-driver`
- `Jarvis`
- `WakeUP-app`
- `hsa`
- `Corner-Cafe`
- `Johnny-Voodoo-Barbershop`

High-signal instruction and prompt files reviewed:
- `/home/ubuntu/.openclaw/workspace/AGENTS.md`
- `/home/ubuntu/.openclaw/workspace/SOUL.md`
- `/home/ubuntu/.openclaw/workspace/USER.md`
- `/home/ubuntu/.openclaw/workspace/Jarvis/REPLIT_BUILD_SPEC.md`
- `/home/ubuntu/.openclaw/workspace/Jarvis/REPLIT_PROMPT_LIFECYCLE_SUBSCRIPTIONS.md`
- `/home/ubuntu/.openclaw/workspace/learner-driver/LEARNERS_UPGRADE_BUILD_SPEC.md`
- `/home/ubuntu/.openclaw/workspace/learner-driver/PHASE_2_BUILD_SPEC.md`
- project memory notes surfaced via memory search

---

# 2. What Standard Instructions Already Exist

## 2.1 Workspace-level operator rules
From `AGENTS.md`, `SOUL.md`, and `USER.md`, the standard operating pattern is already very clear.

### Identity and tone
- Be direct
- Be resourceful
- Figure things out before asking
- Use simple, everyday language
- Sound like a sharp Aussie operator, not a corporate assistant
- Have opinions, do not just agree
- No fluff, no filler
- No en dash or em dash in output

### Behaviour rules
- Read context and memory first
- Write important things down, do not rely on memory alone
- Do not exfiltrate private data
- Ask before destructive or external actions
- Compliance is a blocking step, not optional
- Internal work can be bold, external work must be careful

### Delivery preference
- Jimmy wants outcomes, not hand-holding
- Manual re-entry is considered waste
- Reuse existing systems and integrations where possible
- Automate wherever the source data already exists

## 2.2 Technical stack preferences
Across projects, the common Replit stack is very consistent:
- React
- TypeScript
- Vite
- Express.js
- PostgreSQL or Neon PostgreSQL
- Drizzle ORM
- Tailwind CSS
- Shadcn/ui
- Radix UI
- Lucide icons
- React Hook Form
- Zod
- TanStack Query
- OpenAPI where useful
- Orval-generated client in stronger monorepos

This should absolutely be codified into the base prompt.

## 2.3 Common build philosophy across prompts
Across Jarvis and Learner Log, these repeated instructions show up clearly:
- Build from real-world workflow, not abstract CRUD
- Mobile and tablet friendliness matter
- Minimise typing and taps
- Preserve existing working behaviour
- Extend current auth and role flows rather than replacing them
- Keep schema, API, types, and UI in sync
- Prefer shared service layers when complexity grows
- Avoid manual duplicate data entry
- Build for actual operational use, not demo-only behaviour

## 2.4 Methodologies already appearing repeatedly
These are either explicit or strongly implied across your project work:

### Lean Six Sigma
Most explicit in Learner Log Phase 2.
Recurring principles:
- eliminate waste
- reduce variation
- improve throughput and consistency
- measure outcomes
- design around operational bottlenecks

### Security and compliance by design
Recurring across multiple projects:
- least privilege
- audit trails
- encryption of sensitive fields
- retention and evidence requirements
- moderation and incident response hooks
- access control by role and scope

### Event-driven automation mindset
Most explicit in Jarvis.
Recurring principles:
- if a meaningful action happens, emit an event
- let systems sync automatically where data already exists
- avoid copy-paste loops
- convert integrations into operational leverage

### Human-in-the-loop where risk is high
Also recurring:
- automate low-risk routine work
- gate sensitive, destructive, legal, compliance, or public-facing actions
- use manual review when confidence is low

---

# 3. Jimmy's Strongest Repeated Preferences

These are the patterns that show up over and over and should become default prompt rules.

## 3.1 Build for commercial reality
Jimmy consistently wants:
- something sellable, not just technically impressive
- self-funded pathways where possible
- pricing and monetisation thought through early
- recurring revenue opportunities built into architecture
- systems that reduce human bottlenecks

## 3.2 Build for actual operators
Repeated preference:
- tools should work in the field
- mobile first matters
- large touch targets matter
- low cognitive load matters
- office-admin assumptions are usually wrong for frontline users

## 3.3 Reuse live systems instead of re-keying
Repeated rule from Jarvis and elsewhere:
- if Stripe, GitHub, Replit, Plaud, registrar, or another connected system already has the data, pull it
- manual re-entry is waste

## 3.4 Do not break the current app to add sophistication
Repeated across upgrade prompts:
- preserve working flows
- migrate incrementally
- allow aliases or compatibility paths where roles or states change
- avoid big-bang rewrites

## 3.5 Compliance matters early when trust is involved
Especially strong in Learner Log and government-ready projects:
- role boundaries matter
- PI and CI exposure must be limited
- auditability matters
- legal defensibility matters
- safeguarding controls matter

## 3.6 Prefer practical clarity over vague cleverness
Your prompts tend to work best when they specify:
- exact files likely to change
- exact endpoints to add or modify
- exact schema fields
- exact UI behaviours
- acceptance criteria
- rollout order

That is a huge clue for the master template.

---

# 4. Gaps in the Current Prompting Pattern

You have a strong style already, but there are a few gaps worth tightening.

## 4.1 Some prompts specify what to build, but not how to decide tradeoffs
Add a standard tradeoff policy:
- safety over convenience
- data integrity over speed
- compatibility over flashy rewrites
- automation over manual re-entry
- explainable heuristics over black-box AI for sensitive workflows

## 4.2 Some prompts do not explicitly require migration planning
This should become standard:
- if enums, roles, or schemas change, include migration and backward compatibility handling

## 4.3 Some prompts imply testing, but do not force verification structure
Standardise this:
- schema change verification
- API verification
- type or build verification
- UI flow verification
- acceptance checklist before handoff

## 4.4 Some prompts mention compliance, but not deployment posture
For stronger builds, standardise:
- feature flags for risky features
- staged rollout
- audit logging for restricted actions
- manual review queue for low-confidence decisions

---

# 5. Recommended Standard Prompt Template Structure

This is the shape I recommend for future Replit prompts.

## 5.1 Header
- Project name
- What this build is
- Current repo branch or pull-latest instruction
- High-level goal in one paragraph

## 5.2 Non-negotiable product rules
- do not break existing working flows
- extend current auth and permissions rather than replacing blindly
- mobile and tablet friendly by default
- low typing, low taps, low cognitive load
- use simple everyday language in UI copy
- preserve backward compatibility where practical
- no fake seed data if real integrations already exist

## 5.3 Methodology block
- Lean Six Sigma or other relevant methodology
- safety and compliance priorities
- event-driven automation rules
- least privilege and audit requirements

## 5.4 Technical standards block
- required stack
- schema to API to type to UI wiring requirement
- service-layer preference for complexity
- OpenAPI and codegen requirement where applicable
- feature flag requirement for risky rollouts

## 5.5 Business and operator context
- who uses it
- where they use it
- what is painful today
- what cannot go wrong
- what revenue or efficiency outcome this feature supports

## 5.6 Detailed implementation scope
Per feature:
- goal
- why it matters
- backend changes
- schema changes
- frontend changes
- security or compliance notes
- acceptance criteria

## 5.7 Migration and rollout
- data migration rules
- compatibility behaviour
- rollout waves
- manual review requirements

## 5.8 Verification
- exact tests or checks to run
- exact workflows to verify manually
- signoff checklist

## 5.9 Files likely to change
This helps the Replit agent orient faster and reduce wander.

---

# 6. Recommended Master Prompt Template

Use this as the starting template for future Replit agent jobs.

```md
# [PROJECT NAME] — Replit Build Prompt

## 1. Context
This project is built for real-world use, not just a technical demo.
Primary users: [who]
Primary environment: [mobile, tablet, desktop, field, admin office, etc.]
Primary business outcome: [revenue, automation, safety, compliance, speed, etc.]

Pull latest from GitHub before starting if this repo is connected.
Do not overwrite or regress existing working features.

## 2. Core Product Rules
- Preserve existing working behaviour unless this prompt explicitly replaces it
- Extend current auth, role, and data flows rather than doing blind rewrites
- Optimise for low friction, low taps, and low typing
- Keep mobile and tablet usability strong
- Use simple, everyday language in UI copy
- Reuse connected systems and live data where possible
- Manual re-entry is waste
- If safety, privacy, or compliance conflicts with convenience, safety wins

## 3. Methodology
Apply these principles throughout:
- Lean Six Sigma: define, measure, analyse, improve, control
- Least privilege access control
- Auditability for sensitive actions and data access
- Encryption for sensitive fields at rest where relevant
- Explainable rules for high-risk workflows
- Feature flags for risky or staged rollouts
- Manual review for low-confidence decisions

## 4. Technical Standards
Stack:
- React + TypeScript + Vite
- Tailwind + Shadcn/ui + Radix + Lucide
- Express.js API
- PostgreSQL + Drizzle ORM
- React Hook Form + Zod
- TanStack Query
- OpenAPI and generated clients where already used in repo

Required wiring path for new fields or features:
1. DB schema
2. migrations or schema push handling
3. backend validation and service logic
4. API contract
5. generated types or client
6. frontend hooks and pages
7. audit coverage where applicable

Prefer shared service layers when logic is reused or sensitive.
Do not bury business-critical logic inside page components.

## 5. Business and User Reality
Design for actual users:
- [describe frontline user reality]
- [describe admin or compliance reality]
- [describe time, device, and workflow constraints]

Non-functional priorities:
- speed
- clarity
- safe defaults
- recoverable workflows
- minimal duplicate entry

## 6. Implementation Scope
For each feature below, implement fully and keep the app compiling after each major step.

### Feature A: [name]
Goal:
Why it matters:
Backend:
Schema:
Frontend:
Compliance or security notes:
Acceptance criteria:

### Feature B: [name]
Goal:
Why it matters:
Backend:
Schema:
Frontend:
Compliance or security notes:
Acceptance criteria:

## 7. Migration and Compatibility
If roles, enums, or schemas change:
- include migration handling
- support backward compatibility during rollout
- avoid big-bang renames when aliases can bridge safely

## 8. Verification Requirements
Before handoff, verify:
- app compiles
- touched flows work end-to-end
- schema and API stay in sync
- no obvious regressions in existing working flows
- acceptance criteria are met

## 9. Files Likely to Change
- [list likely backend files]
- [list likely frontend files]
- [list likely schema files]
- [list likely spec files]

## 10. Delivery Rules
- Keep changes focused
- Do not add unnecessary complexity
- Prefer practical implementation over theoretical perfection
- If a rule conflict appears, choose safety, data integrity, and compatibility first
```

---

# 7. Custom Add-On Blocks You Should Reuse Often

## 7.1 Compliance-heavy block
Use when projects involve children, health, finance, or legal risk.

Add:
- all sensitive reads and writes must be auditable
- restricted fields must be encrypted at rest
- permission boundaries must be enforced server-side
- content or workflow breaches must support alerting and evidence retention
- low-confidence identity or moderation outcomes go to manual review

## 7.2 Revenue-first block
Use when product must self-fund quickly.

Add:
- pricing tiers must be reflected in data model early
- feature gating can be scaffolded before enforcement
- recurring revenue opportunities should be surfaced where natural
- avoid operational features that create ongoing manual support burden unless commercially justified

## 7.3 Field-operator block
Use when app is used in cars, worksites, venues, or on the move.

Add:
- large touch targets
- offline resilience if feasible
- short paths to common actions
- reduce typing wherever possible
- never hide safety-critical info behind multiple taps

---

# 8. Best Summary of Your Current Default Prompt Style

If I had to compress your established Replit-agent style into one paragraph, it would be this:

Build practical, commercially useful software for real operators using the standard Shadow Software Replit stack. Preserve what already works, minimise manual re-entry, automate from real data sources, design mobile-first, keep the UI simple, and treat compliance, privacy, auditability, and role boundaries seriously anywhere trust is involved. Use explicit schemas, clear API contracts, service-layer logic, staged rollouts, and strong acceptance criteria. Favour real-world usability and revenue leverage over overengineered theory.

---

# 9. My Recommendation

Your next step should be to create one canonical file in the workspace, something like:
- `/home/ubuntu/.openclaw/workspace/REPLIT_MASTER_PROMPT_TEMPLATE.md`

That file should hold:
- the master template
- optional add-on blocks
- your stack defaults
- your methodology defaults
- your recurring red lines

Then each new project prompt can be:
1. master template
2. project-specific context
3. feature-specific scope

That will make your Replit prompts tighter, more consistent, and easier to scale across projects.