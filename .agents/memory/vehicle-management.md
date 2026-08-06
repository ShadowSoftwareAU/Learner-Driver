---
name: Vehicle management feature
description: Full vehicle management system added — schema, API routes, frontend page, availability integration, booking wizard integration.
---

## What was built

### Schema additions (pushed to DB)
- `instructor_vehicles`: added `transmissionType` (auto|manual), `controlType` (dual_control|factory), `photoStorageKey` (text, nullable)
- `instructor_availability`: added `vehicleIds` (text, CSV of IDs, nullable — null means all active vehicles)
- `bookings`: added `vehicleId` (integer, nullable — selected vehicle for the lesson)
- `instructors`: has `profilePhotoPath` (nullable) field already in schema

### API routes added/updated
- `GET/POST /instructor/my-vehicles` — self-resolving (no instructorId needed)
- `PATCH/DELETE /instructor/my-vehicles/:vehicleId` — self-resolving
- `GET /availability/instructor/:id/calendar` — now returns `vehicles` array per window (joined from instructor_vehicles where vehicleId is in the slot's vehicleIds CSV, or all active vehicles if vehicleIds is null)
- `POST /availability` and `PATCH /availability/:id` — now accept `vehicleIds` (array → stored as CSV)
- `GET /availability/me` — now parses vehicleIds CSV back to array
- `POST /bookings` — now accepts `vehicleId`
- `formatVehicle()` in instructor-vehicles.ts is now exported (named export)

### OpenAPI + codegen
- Added transmissionType, controlType, photoStorageKey to `InstructorVehicle` and `InstructorVehicleInput` schemas
- Added vehicleId to `CreateBooking` schema
- Added new paths: `/instructor/my-vehicles`, `/instructor/my-vehicles/{vehicleId}`
- Codegen run: 34 new hooks generated in api-client-react

### Frontend
- `artifacts/driving-app/src/pages/instructor/vehicles.tsx` — full CRUD page with photo upload (presigned URL pattern), card grid, rego expiry warnings, primary flag, active/inactive status
- SidebarLayout: "My Vehicles" nav item added for instructor (after Availability, before Teaching Zones)
- App.tsx: `/instructor/vehicles` route added
- Availability page: vehicle multi-select in the "Add Slot" form; fetches own vehicles via direct fetch (not codegen hook) since it predates the codegen run
- Booking wizard: instructor profile photo shown in header; vehicle picker shown in step 2 when carType === "trainer_car" and the selected time slot has vehicles linked; vehicleId passed to POST /bookings

## What is NOT yet done
- **Instructor profile photo upload UI** — `profilePhotoPath` is in the schema and shown in the booking wizard, but there is no upload UI on the instructor profile settings page.
- **School admin "Manage Vehicles" button** — the school admin instructor management page (`/school-admin/instructor-management`) does not yet link to vehicle management for each instructor.
- **Vehicle display in booking summary (step 3)** — the confirmed vehicle name is not shown in the step 3 summary/confirmation UI.

## Why: key design decisions
- `vehicleIds` stored as CSV text in the DB (not a junction table) — simpler for the current scale; a junction table is overkill for a handful of vehicles per slot.
- Self-resolving `/instructor/my-vehicles` routes avoid the frontend needing to know the instructor's numeric DB ID.
- Calendar endpoint returns full vehicle objects (not just IDs) so the student booking wizard can show make/model/photo without an extra request.
- Vehicle photos use private storage (`/api/storage/objects/…`) — students are authenticated when booking so they can see them.
