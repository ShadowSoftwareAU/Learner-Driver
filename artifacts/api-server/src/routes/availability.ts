import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, instructorAvailabilityTable, instructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// Compare "HH:MM" strings — lexical compare works for zero-padded 24h time
const timeLte = (a: string, b: string) => a <= b;
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd;

// Get my availability slots — sorted by day then start time
router.get("/availability/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Not an instructor" }); return; }

  const slots = await db.select().from(instructorAvailabilityTable)
    .where(eq(instructorAvailabilityTable.instructorId, instructor.id))
    .orderBy(asc(instructorAvailabilityTable.dayOfWeek), asc(instructorAvailabilityTable.startTime));
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
    res.status(400).json({ error: "Day, start time and end time are required" }); return;
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    res.status(400).json({ error: "Day of week must be an integer 0–6" }); return;
  }
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (typeof startTime !== "string" || typeof endTime !== "string" || !timeRe.test(startTime) || !timeRe.test(endTime)) {
    res.status(400).json({ error: "Times must be in HH:MM 24-hour format" }); return;
  }
  if (timeLte(endTime, startTime)) {
    res.status(400).json({ error: "End time must be after start time" }); return;
  }

  // Check overlap with existing slots on the same day
  const sameDay = await db.select().from(instructorAvailabilityTable)
    .where(and(
      eq(instructorAvailabilityTable.instructorId, instructor.id),
      eq(instructorAvailabilityTable.dayOfWeek, dayOfWeek),
    ));
  const conflict = sameDay.find(s => overlaps(startTime, endTime, s.startTime, s.endTime));
  if (conflict) {
    res.status(409).json({ error: `Overlaps with existing slot ${conflict.startTime}–${conflict.endTime}` });
    return;
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
