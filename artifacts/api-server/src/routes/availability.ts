import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, instructorAvailabilityTable, instructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// Get my availability slots
router.get("/availability/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Not an instructor" }); return; }

  const slots = await db.select().from(instructorAvailabilityTable)
    .where(eq(instructorAvailabilityTable.instructorId, instructor.id));
  res.json(slots);
});

// Get availability for a specific instructor (public-ish, used by student search)
router.get("/availability/instructor/:instructorId", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(req.params.instructorId as string, 10);
  const slots = await db.select().from(instructorAvailabilityTable)
    .where(and(eq(instructorAvailabilityTable.instructorId, instructorId), eq(instructorAvailabilityTable.isActive, true)));
  res.json(slots);
});

// Create availability slot
router.post("/availability", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  let [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const { dayOfWeek, startTime, endTime, transmissionTypes } = req.body;
  if (dayOfWeek === undefined || !startTime || !endTime) {
    res.status(400).json({ error: "dayOfWeek, startTime, endTime required" }); return;
  }

  const [slot] = await db.insert(instructorAvailabilityTable).values({
    instructorId: instructor.id, dayOfWeek, startTime, endTime,
    transmissionTypes: Array.isArray(transmissionTypes) ? transmissionTypes.join(",") : (transmissionTypes ?? "auto,manual"),
    isActive: true,
  }).returning();
  res.status(201).json(slot);
});

// Update availability slot
router.patch("/availability/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(403).json({ error: "Not an instructor" }); return; }

  const { dayOfWeek, startTime, endTime, transmissionTypes, isActive } = req.body;
  const updates: any = {};
  if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
  if (startTime) updates.startTime = startTime;
  if (endTime) updates.endTime = endTime;
  if (transmissionTypes !== undefined) updates.transmissionTypes = Array.isArray(transmissionTypes) ? transmissionTypes.join(",") : transmissionTypes;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db.update(instructorAvailabilityTable).set(updates)
    .where(and(eq(instructorAvailabilityTable.id, id), eq(instructorAvailabilityTable.instructorId, instructor.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// Delete availability slot
router.delete("/availability/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(403).json({ error: "Not an instructor" }); return; }

  await db.delete(instructorAvailabilityTable)
    .where(and(eq(instructorAvailabilityTable.id, id), eq(instructorAvailabilityTable.instructorId, instructor.id)));
  res.status(204).send();
});

export default router;
