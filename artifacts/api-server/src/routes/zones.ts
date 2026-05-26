import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, instructorZonesTable, instructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// Normalize zone inputs: trim suburb, uppercase state, strip non-digits from postcode.
function normalizeZone(suburb: string, postcode: string, state: string) {
  return {
    suburb: suburb.trim().replace(/\s+/g, " "),
    postcode: postcode.trim().replace(/[^0-9]/g, ""),
    state: state.trim().toUpperCase(),
  };
}

// Get my zones — sorted by postcode, then suburb
router.get("/zones/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Not an instructor" }); return; }

  const zones = await db.select().from(instructorZonesTable)
    .where(eq(instructorZonesTable.instructorId, instructor.id))
    .orderBy(asc(instructorZonesTable.postcode), asc(instructorZonesTable.suburb));
  res.json(zones);
});

// Add zone — normalizes input, prevents duplicates
router.post("/zones", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  let [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const rawSuburb = typeof req.body?.suburb === "string" ? req.body.suburb : "";
  const rawPostcode = typeof req.body?.postcode === "string" ? req.body.postcode : "";
  const rawState = typeof req.body?.state === "string" ? req.body.state : "QLD";
  const { suburb, postcode, state } = normalizeZone(rawSuburb, rawPostcode, rawState);

  if (!suburb) { res.status(400).json({ error: "Suburb is required" }); return; }
  if (!postcode || postcode.length !== 4) { res.status(400).json({ error: "Postcode must be 4 digits" }); return; }
  if (!state) { res.status(400).json({ error: "State is required" }); return; }

  // Duplicate check (case-insensitive suburb match for same postcode + instructor)
  const existing = await db.select().from(instructorZonesTable)
    .where(and(
      eq(instructorZonesTable.instructorId, instructor.id),
      eq(instructorZonesTable.postcode, postcode),
    ));
  const dup = existing.find(z => z.suburb.toLowerCase() === suburb.toLowerCase());
  if (dup) {
    res.status(409).json({ error: `${suburb} ${postcode} is already in your zones.` });
    return;
  }

  const [zone] = await db.insert(instructorZonesTable).values({
    instructorId: instructor.id, suburb, postcode, state, isActive: true,
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
