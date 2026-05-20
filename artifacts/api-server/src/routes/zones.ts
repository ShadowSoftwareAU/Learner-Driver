import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, instructorZonesTable, instructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// Get my zones
router.get("/zones/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Not an instructor" }); return; }

  const zones = await db.select().from(instructorZonesTable)
    .where(eq(instructorZonesTable.instructorId, instructor.id));
  res.json(zones);
});

// Add zone
router.post("/zones", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  let [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const { suburb, postcode, state } = req.body;
  if (!suburb || !postcode) { res.status(400).json({ error: "suburb and postcode required" }); return; }

  const [zone] = await db.insert(instructorZonesTable).values({
    instructorId: instructor.id, suburb, postcode, state: state ?? "QLD", isActive: true,
  }).returning();
  res.status(201).json(zone);
});

// Remove zone
router.delete("/zones/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(403).json({ error: "Not an instructor" }); return; }

  await db.delete(instructorZonesTable)
    .where(and(eq(instructorZonesTable.id, id), eq(instructorZonesTable.instructorId, instructor.id)));
  res.status(204).send();
});

export default router;
