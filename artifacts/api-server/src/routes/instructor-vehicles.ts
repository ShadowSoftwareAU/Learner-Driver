import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, instructorVehiclesTable, instructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

const vehicleBody = z.object({
  vehicleType: z.enum(["car", "motorbike", "mr_truck", "hr_truck", "hc_truck", "mc_truck"]).default("car"),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1950).max(2100).optional(),
  colour: z.string().max(50).optional(),
  rego: z.string().max(20).optional(),
  regoState: z.string().max(10).optional(),
  regoExpiry: z.string().optional(),
  // 'auto' | 'manual'
  transmissionType: z.enum(["auto", "manual"]).default("auto"),
  // 'dual_control' = professionally fitted pedals; 'factory' = standard factory
  controlType: z.enum(["dual_control", "factory"]).default("dual_control"),
  isDualControl: z.boolean().default(false),
  isOwnerOperator: z.boolean().default(true),
  isPrimary: z.boolean().default(false),
  // Object-storage path for the vehicle photo
  photoStorageKey: z.string().max(500).optional(),
  insuranceProvider: z.string().max(200).optional(),
  insurancePolicyNumber: z.string().max(100).optional(),
  insuranceType: z.string().max(100).optional(),
  insuranceExpiry: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().max(2000).optional(),
});

function isAdminOrInstructor(role: string) {
  return ["admin", "school_admin", "super_admin", "instructor"].includes(role);
}

async function resolveInstructorAccess(user: any, instructorId: number): Promise<{ ok: boolean; reason?: string }> {
  if (["admin", "school_admin", "super_admin"].includes(user.role)) return { ok: true };
  if (user.role === "instructor") {
    const [inst] = await db.select({ id: instructorsTable.id }).from(instructorsTable)
      .where(eq(instructorsTable.userId, user.id));
    if (inst?.id === instructorId) return { ok: true };
    return { ok: false, reason: "You can only manage your own vehicles" };
  }
  return { ok: false, reason: "Access denied" };
}

// ─── Self-resolving routes (no instructorId needed) ───────────────────────────
// Must be registered before /:id routes to avoid shadowing.

router.get("/instructor/my-vehicles", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (user.role !== "instructor") { res.status(403).json({ error: "Instructor role required" }); return; }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Instructor profile not found" }); return; }

  const vehicles = await db.select().from(instructorVehiclesTable)
    .where(eq(instructorVehiclesTable.instructorId, instructor.id))
    .orderBy(desc(instructorVehiclesTable.isPrimary), instructorVehiclesTable.createdAt);

  res.json(vehicles.map(formatVehicle));
});

router.post("/instructor/my-vehicles", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (user.role !== "instructor") { res.status(403).json({ error: "Instructor role required" }); return; }

  let [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable)
      .values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" })
      .returning();
  }

  const body = vehicleBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body", issues: body.error.issues }); return; }

  if (body.data.isPrimary) {
    await db.update(instructorVehiclesTable).set({ isPrimary: false })
      .where(eq(instructorVehiclesTable.instructorId, instructor.id));
  }

  const [created] = await db.insert(instructorVehiclesTable).values({
    instructorId: instructor.id,
    ...body.data,
  }).returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "create", resourceType: "instructor_vehicle", resourceId: created.id }, req);
  res.status(201).json(formatVehicle(created));
});

router.patch("/instructor/my-vehicles/:vehicleId", requireAuth, async (req: any, res): Promise<void> => {
  const vehicleId = parseInt(req.params.vehicleId as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (user.role !== "instructor") { res.status(403).json({ error: "Instructor role required" }); return; }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Instructor profile not found" }); return; }

  const [existing] = await db.select().from(instructorVehiclesTable)
    .where(and(eq(instructorVehiclesTable.id, vehicleId), eq(instructorVehiclesTable.instructorId, instructor.id)));
  if (!existing) { res.status(404).json({ error: "Vehicle not found" }); return; }

  const body = vehicleBody.partial().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body", issues: body.error.issues }); return; }

  if (body.data.isPrimary) {
    await db.update(instructorVehiclesTable).set({ isPrimary: false })
      .where(eq(instructorVehiclesTable.instructorId, instructor.id));
  }

  const [updated] = await db.update(instructorVehiclesTable).set(body.data)
    .where(eq(instructorVehiclesTable.id, vehicleId)).returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "update", resourceType: "instructor_vehicle", resourceId: vehicleId }, req);
  res.json(formatVehicle(updated));
});

router.delete("/instructor/my-vehicles/:vehicleId", requireAuth, async (req: any, res): Promise<void> => {
  const vehicleId = parseInt(req.params.vehicleId as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (user.role !== "instructor") { res.status(403).json({ error: "Instructor role required" }); return; }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Instructor profile not found" }); return; }

  await db.delete(instructorVehiclesTable)
    .where(and(eq(instructorVehiclesTable.id, vehicleId), eq(instructorVehiclesTable.instructorId, instructor.id)));

  await logAudit({ actorId: user.id, actorRole: user.role, action: "delete", resourceType: "instructor_vehicle", resourceId: vehicleId }, req);
  res.json({ ok: true });
});

// ─── Admin/school routes (by instructorId) ───────────────────────────────────

router.get("/instructors/:id/vehicles", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isAdminOrInstructor(user.role)) { res.status(403).json({ error: "Access denied" }); return; }

  const access = await resolveInstructorAccess(user, instructorId);
  if (!access.ok) { res.status(403).json({ error: access.reason }); return; }

  const vehicles = await db.select().from(instructorVehiclesTable)
    .where(eq(instructorVehiclesTable.instructorId, instructorId))
    .orderBy(desc(instructorVehiclesTable.isPrimary), instructorVehiclesTable.createdAt);

  res.json(vehicles.map(formatVehicle));
});

router.post("/instructors/:id/vehicles", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isAdminOrInstructor(user.role)) { res.status(403).json({ error: "Access denied" }); return; }

  const access = await resolveInstructorAccess(user, instructorId);
  if (!access.ok) { res.status(403).json({ error: access.reason }); return; }

  const body = vehicleBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body", issues: body.error.issues }); return; }

  if (body.data.isPrimary) {
    await db.update(instructorVehiclesTable).set({ isPrimary: false })
      .where(eq(instructorVehiclesTable.instructorId, instructorId));
  }

  const [created] = await db.insert(instructorVehiclesTable).values({
    instructorId,
    ...body.data,
  }).returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "create", resourceType: "instructor_vehicle", resourceId: created.id }, req);
  res.status(201).json(formatVehicle(created));
});

router.patch("/instructors/:id/vehicles/:vehicleId", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const vehicleId = parseInt(Array.isArray(req.params.vehicleId) ? req.params.vehicleId[0] : req.params.vehicleId, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const access = await resolveInstructorAccess(user, instructorId);
  if (!access.ok) { res.status(403).json({ error: access.reason }); return; }

  const [existing] = await db.select().from(instructorVehiclesTable)
    .where(and(eq(instructorVehiclesTable.id, vehicleId), eq(instructorVehiclesTable.instructorId, instructorId)));
  if (!existing) { res.status(404).json({ error: "Vehicle not found" }); return; }

  const body = vehicleBody.partial().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body", issues: body.error.issues }); return; }

  if (body.data.isPrimary) {
    await db.update(instructorVehiclesTable).set({ isPrimary: false })
      .where(eq(instructorVehiclesTable.instructorId, instructorId));
  }

  const [updated] = await db.update(instructorVehiclesTable).set(body.data)
    .where(eq(instructorVehiclesTable.id, vehicleId)).returning();

  await logAudit({ actorId: user.id, actorRole: user.role, action: "update", resourceType: "instructor_vehicle", resourceId: vehicleId }, req);
  res.json(formatVehicle(updated));
});

router.delete("/instructors/:id/vehicles/:vehicleId", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const vehicleId = parseInt(Array.isArray(req.params.vehicleId) ? req.params.vehicleId[0] : req.params.vehicleId, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const access = await resolveInstructorAccess(user, instructorId);
  if (!access.ok) { res.status(403).json({ error: access.reason }); return; }

  await db.delete(instructorVehiclesTable)
    .where(and(eq(instructorVehiclesTable.id, vehicleId), eq(instructorVehiclesTable.instructorId, instructorId)));

  await logAudit({ actorId: user.id, actorRole: user.role, action: "delete", resourceType: "instructor_vehicle", resourceId: vehicleId }, req);
  res.json({ ok: true });
});

// ─── Update training categories ───────────────────────────────────────────────

router.patch("/instructors/:id/training-categories", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const access = await resolveInstructorAccess(user, instructorId);
  if (!access.ok) { res.status(403).json({ error: access.reason }); return; }

  const { trainingCategories } = req.body as { trainingCategories: string[] };
  if (!Array.isArray(trainingCategories)) {
    res.status(400).json({ error: "trainingCategories must be an array" }); return;
  }

  const validCategories = ["car_learner", "car_probationary", "q_ride_re", "q_ride_r", "q_ride_re_to_r", "mr", "hr", "hc", "mc"];
  const cleaned = trainingCategories.filter(c => validCategories.includes(c));

  const [updated] = await db.update(instructorsTable)
    .set({ trainingCategories: cleaned })
    .where(eq(instructorsTable.id, instructorId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Instructor not found" }); return; }

  await logAudit({ actorId: user.id, actorRole: user.role, action: "update", resourceType: "instructor_training_categories", resourceId: instructorId }, req);
  res.json({ trainingCategories: updated.trainingCategories });
});

// ─── Shared formatter ─────────────────────────────────────────────────────────

export function formatVehicle(v: any) {
  return {
    id: v.id,
    instructorId: v.instructorId,
    vehicleType: v.vehicleType,
    make: v.make,
    model: v.model,
    year: v.year ?? null,
    colour: v.colour ?? null,
    rego: v.rego ?? null,
    regoState: v.regoState ?? "QLD",
    regoExpiry: v.regoExpiry ?? null,
    transmissionType: v.transmissionType ?? "auto",
    controlType: v.controlType ?? "dual_control",
    isDualControl: v.isDualControl,
    isOwnerOperator: v.isOwnerOperator,
    isPrimary: v.isPrimary,
    photoStorageKey: v.photoStorageKey ?? null,
    insuranceProvider: v.insuranceProvider ?? null,
    insurancePolicyNumber: v.insurancePolicyNumber ?? null,
    insuranceType: v.insuranceType ?? null,
    insuranceExpiry: v.insuranceExpiry ?? null,
    status: v.status,
    notes: v.notes ?? null,
    createdAt: v.createdAt,
  };
}

export default router;
