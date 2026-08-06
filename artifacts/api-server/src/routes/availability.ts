import { Router } from "express";
import { eq, and, asc, gte, lte, inArray } from "drizzle-orm";
import {
  db, instructorAvailabilityTable, instructorsTable, bookingsTable,
  schoolInstructorLinksTable, usersTable, instructorVehiclesTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// Compare "HH:MM" strings — lexical compare works for zero-padded 24h time
const timeLte = (a: string, b: string) => a <= b;
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd;

// Parse a vehicleIds CSV string to a sorted array of ints
function parseVehicleIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

/**
 * GET /availability/my-contexts
 * Returns the set of contexts the authenticated instructor can assign to slots.
 */
router.get("/availability/my-contexts", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Not an instructor" }); return; }

  const contexts: Array<{ type: string; label: string; schoolAdminId: number | null }> = [];

  if (instructor.isIndependent) {
    contexts.push({ type: "independent", label: "Independent", schoolAdminId: null });
  }

  const links = await db.select().from(schoolInstructorLinksTable)
    .where(and(
      eq(schoolInstructorLinksTable.instructorId, instructor.id),
      eq(schoolInstructorLinksTable.status, "active"),
    ));

  for (const link of links) {
    const [adminUser] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, link.schoolAdminId));
    if (adminUser) {
      contexts.push({
        type: "school",
        label: adminUser.name ?? adminUser.email,
        schoolAdminId: link.schoolAdminId,
      });
    }
  }

  res.json(contexts);
});

// Get my availability slots — sorted by day then start time
router.get("/availability/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(404).json({ error: "Not an instructor" }); return; }

  const slots = await db.select().from(instructorAvailabilityTable)
    .where(eq(instructorAvailabilityTable.instructorId, instructor.id))
    .orderBy(asc(instructorAvailabilityTable.dayOfWeek), asc(instructorAvailabilityTable.startTime));

  res.json(slots.map(s => ({
    ...s,
    vehicleIds: parseVehicleIds(s.vehicleIds),
  })));
});

// Get availability for a specific instructor (public-ish, used by student search)
router.get("/availability/instructor/:instructorId", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(req.params.instructorId as string, 10);
  const slots = await db.select().from(instructorAvailabilityTable)
    .where(and(eq(instructorAvailabilityTable.instructorId, instructorId), eq(instructorAvailabilityTable.isActive, true)));
  res.json(slots.map(s => ({ ...s, vehicleIds: parseVehicleIds(s.vehicleIds) })));
});

/**
 * GET /availability/instructor/:instructorId/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns the instructor's availability windows + existing bookings for a date range.
 * Includes vehicle summaries for each window so the student can select a vehicle.
 */
router.get("/availability/instructor/:instructorId/calendar", requireAuth, async (req: any, res): Promise<void> => {
  const instructorId = parseInt(req.params.instructorId as string, 10);
  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    res.status(400).json({ error: "from and to query params are required (YYYY-MM-DD)" });
    return;
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(from) || !dateRe.test(to)) {
    res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    return;
  }

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, instructorId));
  if (!instructor) { res.status(404).json({ error: "Instructor not found" }); return; }

  // Weekly availability windows
  const slots = await db.select().from(instructorAvailabilityTable)
    .where(and(
      eq(instructorAvailabilityTable.instructorId, instructorId),
      eq(instructorAvailabilityTable.isActive, true),
    ))
    .orderBy(asc(instructorAvailabilityTable.dayOfWeek), asc(instructorAvailabilityTable.startTime));

  // All active vehicles for this instructor (for photo display on booking form)
  const allVehicles = await db.select().from(instructorVehiclesTable)
    .where(and(
      eq(instructorVehiclesTable.instructorId, instructorId),
      eq(instructorVehiclesTable.status, "active"),
    ));

  const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

  // Existing bookings claimed by / confirmed for this instructor in the range
  const bookings = await db.select({
    requestedDate: bookingsTable.requestedDate,
    requestedTime: bookingsTable.requestedTime,
    durationMinutes: bookingsTable.durationMinutes,
    status: bookingsTable.status,
  }).from(bookingsTable)
    .where(and(
      eq(bookingsTable.instructorId, instructorId),
      gte(bookingsTable.requestedDate, from),
      lte(bookingsTable.requestedDate, to),
      inArray(bookingsTable.status, ["pending", "claimed", "confirmed"]),
    ));

  // Expand into a day-by-day structure for the requested range
  const days: Array<{
    date: string;
    dayOfWeek: number;
    windows: Array<{
      startTime: string;
      endTime: string;
      transmissionTypes: string[];
      vehicles: Array<{
        id: number;
        make: string;
        model: string;
        colour: string | null;
        transmissionType: string;
        controlType: string;
        isDualControl: boolean;
        photoStorageKey: string | null;
      }>;
    }>;
    bookedSlots: Array<{ startTime: string; durationMinutes: number | null; status: string }>;
  }> = [];

  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dow = cur.getDay(); // 0=Sun...6=Sat

    const windows = slots
      .filter((s) => s.dayOfWeek === dow)
      .map((s) => {
        const vIds = parseVehicleIds(s.vehicleIds);
        // If no vehicleIds set, all active vehicles are available
        const availableVehicles = vIds.length > 0
          ? vIds.map(id => vehicleMap.get(id)).filter(Boolean) as typeof allVehicles
          : allVehicles;

        return {
          startTime: s.startTime,
          endTime: s.endTime,
          transmissionTypes: String(s.transmissionTypes).split(",").map((t) => t.trim()).filter(Boolean),
          vehicles: availableVehicles.map(v => ({
            id: v.id,
            make: v.make,
            model: v.model,
            colour: v.colour ?? null,
            transmissionType: v.transmissionType ?? "auto",
            controlType: v.controlType ?? "dual_control",
            isDualControl: v.isDualControl,
            photoStorageKey: v.photoStorageKey ?? null,
          })),
        };
      });

    const bookedSlots = bookings
      .filter((b) => b.requestedDate === dateStr)
      .map((b) => ({
        startTime: b.requestedTime,
        durationMinutes: b.durationMinutes,
        status: b.status,
      }));

    days.push({ date: dateStr, dayOfWeek: dow, windows, bookedSlots });
    cur.setDate(cur.getDate() + 1);
  }

  res.json({
    instructor: {
      id: instructor.id,
      fullName: instructor.fullName,
      email: instructor.email,
      phone: instructor.phone ?? null,
      qualifications: instructor.qualifications ?? null,
      hourlyRateCents: instructor.hourlyRateCents ?? null,
      profilePhotoPath: (instructor as any).profilePhotoPath ?? null,
    },
    days,
  });
});

// Create availability slot
router.post("/availability", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  let [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const { dayOfWeek, startTime, endTime, transmissionTypes, contextType, schoolAdminId, vehicleIds } = req.body;
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

  // Validate context
  const resolvedContextType: "independent" | "school" = contextType === "school" ? "school" : "independent";
  const resolvedSchoolAdminId: number | null =
    resolvedContextType === "school" && typeof schoolAdminId === "number" ? schoolAdminId : null;
  if (resolvedContextType === "school") {
    if (!resolvedSchoolAdminId) {
      res.status(400).json({ error: "schoolAdminId is required when contextType is 'school'" }); return;
    }
    const [link] = await db.select().from(schoolInstructorLinksTable)
      .where(and(
        eq(schoolInstructorLinksTable.instructorId, instructor.id),
        eq(schoolInstructorLinksTable.schoolAdminId, resolvedSchoolAdminId),
        eq(schoolInstructorLinksTable.status, "active"),
      ));
    if (!link) {
      res.status(403).json({ error: "No active link to this school admin" }); return;
    }
  }

  // Normalise vehicleIds to CSV string (null = all vehicles)
  const resolvedVehicleIds: string | null = Array.isArray(vehicleIds) && vehicleIds.length > 0
    ? vehicleIds.map(Number).filter(n => !isNaN(n)).join(",")
    : null;

  // Check overlap
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
    contextType: resolvedContextType,
    schoolAdminId: resolvedSchoolAdminId,
    vehicleIds: resolvedVehicleIds,
  } as any).returning();
  res.status(201).json({ ...slot, vehicleIds: parseVehicleIds(slot.vehicleIds) });
});

// Update availability slot
router.patch("/availability/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(403).json({ error: "Not an instructor" }); return; }

  const { dayOfWeek, startTime, endTime, transmissionTypes, isActive, contextType, schoolAdminId, vehicleIds } = req.body;
  const updates: any = {};
  if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
  if (startTime) updates.startTime = startTime;
  if (endTime) updates.endTime = endTime;
  if (transmissionTypes !== undefined) updates.transmissionTypes = Array.isArray(transmissionTypes) ? transmissionTypes.join(",") : transmissionTypes;
  if (isActive !== undefined) updates.isActive = isActive;
  if (contextType !== undefined) updates.contextType = contextType;
  if (schoolAdminId !== undefined) updates.schoolAdminId = schoolAdminId ?? null;
  if (vehicleIds !== undefined) {
    updates.vehicleIds = Array.isArray(vehicleIds) && vehicleIds.length > 0
      ? vehicleIds.map(Number).filter((n: number) => !isNaN(n)).join(",")
      : null;
  }

  const [updated] = await db.update(instructorAvailabilityTable).set(updates)
    .where(and(eq(instructorAvailabilityTable.id, id), eq(instructorAvailabilityTable.instructorId, instructor.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...updated, vehicleIds: parseVehicleIds(updated.vehicleIds) });
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
