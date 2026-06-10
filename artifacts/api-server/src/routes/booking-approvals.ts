import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, bookingChangeRequestsTable, bookingsTable, schoolInstructorsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

// ─── List change requests ────────────────────────────────────────────────────

router.get("/bookings/change-requests", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { status } = req.query as Record<string, string>;

  const conditions = [];
  if (status) conditions.push(eq(bookingChangeRequestsTable.status, status));

  if (user.role === "instructor") {
    conditions.push(eq(bookingChangeRequestsTable.requestedByUserId, user.id));
  } else if (user.role === "school_admin") {
    const membership = await db.select().from(schoolInstructorsTable)
      .where(and(
        eq(schoolInstructorsTable.instructorId, user.id),
        eq(schoolInstructorsTable.status, "active"),
      ))
      .limit(1);
    if (!membership[0]) { res.json([]); return; }
    conditions.push(eq(bookingChangeRequestsTable.schoolId, membership[0].schoolId));
  } else if (!["admin", "super_admin"].includes(user.role)) {
    conditions.push(eq(bookingChangeRequestsTable.requestedByUserId, user.id));
  }

  const requests = await db.select().from(bookingChangeRequestsTable)
    .where(conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions as Parameters<typeof and>))
    .orderBy(desc(bookingChangeRequestsTable.createdAt))
    .limit(100);

  res.json(requests);
});

// ─── Submit a change request ──────────────────────────────────────────────────

const createSchema = z.object({
  requestType: z.enum(["cancel", "reschedule", "availability_override"]),
  requestedPayloadJson: z.record(z.string(), z.unknown()).optional(),
});

router.post("/bookings/:id/change-requests", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const bookingId = parseInt(req.params.id, 10);

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const body = parsed.data;

  const [request] = await db.insert(bookingChangeRequestsTable).values({
    bookingId,
    schoolId: booking.schoolId ?? null,
    requestedByUserId: user.id,
    requestType: body.requestType,
    requestedPayloadJson: body.requestedPayloadJson ?? null,
    status: "pending",
  }).returning();

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: "booking_change_request_created",
    resourceType: "booking_change_request",
    resourceId: request.id,
    metadataJson: { bookingId, requestType: body.requestType },
  });

  res.status(201).json(request);
});

// ─── Review a change request ──────────────────────────────────────────────────

const reviewSchema = z.object({
  decision: z.enum(["approved", "denied"]),
  reviewNotes: z.string().optional(),
});

router.patch("/bookings/change-requests/:id/review", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const requestId = parseInt(req.params.id, 10);

  if (!["school_admin", "admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Only school admins can review booking change requests" });
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const body = parsed.data;

  const [existing] = await db.select().from(bookingChangeRequestsTable)
    .where(eq(bookingChangeRequestsTable.id, requestId)).limit(1);
  if (!existing) { res.status(404).json({ error: "Change request not found" }); return; }
  if (existing.status !== "pending") {
    res.status(409).json({ error: "Change request is no longer pending" });
    return;
  }

  const [updated] = await db.update(bookingChangeRequestsTable)
    .set({
      status: body.decision,
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes ?? null,
    })
    .where(eq(bookingChangeRequestsTable.id, requestId))
    .returning();

  await logAudit({
    actorId: user.id,
    actorRole: user.role,
    action: `booking_change_request_${body.decision}`,
    resourceType: "booking_change_request",
    resourceId: requestId,
    metadataJson: { decision: body.decision, reviewNotes: body.reviewNotes },
  });

  res.json(updated);
});

export default router;
