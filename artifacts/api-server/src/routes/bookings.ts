import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db, bookingsTable, bookingBroadcastsTable, notificationsTable,
  instructorAvailabilityTable, instructorZonesTable, instructorsTable,
  studentsTable, usersTable, instructorVerificationsTable, verificationDocumentsTable,
  studentWalletsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotCoversRequest(slot: { startTime: string; endTime: string; dayOfWeek: number }, date: string, time: string, durationMinutes: number) {
  const d = new Date(date);
  if (d.getDay() !== slot.dayOfWeek) return false;
  const reqStart = timeToMinutes(time);
  const reqEnd = reqStart + durationMinutes;
  const slotStart = timeToMinutes(slot.startTime);
  const slotEnd = timeToMinutes(slot.endTime);
  return slotStart <= reqStart && reqEnd <= slotEnd;
}

// ─── Booking Wizard Summary ───────────────────────────────────────────────────
// Returns lesson cost, wallet balance, and NDIS/post-pay flags for the
// confirmation step of the booking wizard. Must be defined before /bookings/:id
// so Express matches the literal path first.

router.get("/bookings/wizard-summary", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  const instructorId = parseInt(req.query.instructorId as string, 10);
  const durationMinutes = parseInt((req.query.durationMinutes as string) ?? "60", 10);

  if (!instructorId || isNaN(instructorId)) {
    res.status(400).json({ error: "instructorId query param is required" });
    return;
  }

  const [instructor] = await db
    .select()
    .from(instructorsTable)
    .where(eq(instructorsTable.id, instructorId));
  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  // Ensure student record exists (created lazily)
  let [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  if (!student) {
    [student] = await db
      .insert(studentsTable)
      .values({ userId: user.id, fullName: user.name ?? "Student", email: user.email ?? "" })
      .returning();
  }

  // Cost = pro-rata from hourly rate
  const costCents = instructor.hourlyRateCents
    ? Math.round((instructor.hourlyRateCents * durationMinutes) / 60)
    : null;

  // Student wallet balance (0 if no wallet exists yet)
  const [wallet] = await db
    .select()
    .from(studentWalletsTable)
    .where(eq(studentWalletsTable.studentId, student.id));
  const balanceCents = wallet?.balanceCents ?? 0;

  const isNdis = student.isNdis ?? false;
  const postPayArrangement = student.postPayArrangement ?? false;

  res.json({
    costCents,
    balanceCents,
    isNdis,
    postPayArrangement,
    isBypassWallet: isNdis || postPayArrangement,
  });
});

// ─── Student Search ───────────────────────────────────────────────────────────

router.get("/bookings/search", requireAuth, async (req: any, res): Promise<void> => {
  const { date, time, transmissionType, suburb, postcode, durationMinutes } = req.query as Record<string, string>;
  if (!date || !time) { res.status(400).json({ error: "date and time are required" }); return; }
  const duration = parseInt(durationMinutes ?? "60", 10);

  // Find all active instructors with matching zones
  const zoneFilter: any[] = [];
  if (suburb) zoneFilter.push(eq(instructorZonesTable.suburb, suburb));
  if (postcode) zoneFilter.push(eq(instructorZonesTable.postcode, postcode));

  const zonesQuery = zoneFilter.length > 0
    ? db.select().from(instructorZonesTable).where(and(eq(instructorZonesTable.isActive, true), ...zoneFilter))
    : db.select().from(instructorZonesTable).where(eq(instructorZonesTable.isActive, true));

  const matchingZones = await zonesQuery;
  const instructorIdsInZone = [...new Set(matchingZones.map(z => z.instructorId))];
  if (instructorIdsInZone.length === 0) { res.json([]); return; }

  // Find instructors available at that date/time
  const requestedDay = new Date(date).getDay();
  const availSlots = await db.select().from(instructorAvailabilityTable)
    .where(and(
      eq(instructorAvailabilityTable.isActive, true),
      eq(instructorAvailabilityTable.dayOfWeek, requestedDay),
      sql`${instructorAvailabilityTable.instructorId} = ANY(${sql.raw(`ARRAY[${instructorIdsInZone.join(",")}]::integer[]`)})`
    ));

  const qualifiedInstructorIds = availSlots
    .filter(slot => {
      if (transmissionType && transmissionType !== "either") {
        const types = slot.transmissionTypes.split(",").map(s => s.trim());
        if (!types.includes(transmissionType)) return false;
      }
      return slotCoversRequest(slot, date, time, duration);
    })
    .map(slot => slot.instructorId);

  if (qualifiedInstructorIds.length === 0) { res.json([]); return; }

  const instructors = await db.select().from(instructorsTable)
    .where(sql`${instructorsTable.id} = ANY(${sql.raw(`ARRAY[${qualifiedInstructorIds.join(",")}]::integer[]`)})`);

  const enriched = await Promise.all(instructors.map(async (i) => {
    const zones = await db.select().from(instructorZonesTable)
      .where(and(eq(instructorZonesTable.instructorId, i.id), eq(instructorZonesTable.isActive, true)));
    const slots = await db.select().from(instructorAvailabilityTable)
      .where(and(eq(instructorAvailabilityTable.instructorId, i.id), eq(instructorAvailabilityTable.isActive, true)));
    return {
      id: i.id, fullName: i.fullName, phone: i.phone, vehicleMake: i.vehicleMake,
      vehicleModel: i.vehicleModel, vehicleYear: i.vehicleYear, qualifications: i.qualifications,
      zones: zones.map(z => ({ suburb: z.suburb, postcode: z.postcode, state: z.state })),
      availabilitySlots: slots.map(s => ({
        dayOfWeek: s.dayOfWeek, dayName: DAY_NAMES[s.dayOfWeek],
        startTime: s.startTime, endTime: s.endTime,
        transmissionTypes: s.transmissionTypes.split(",").map((t: string) => t.trim()),
      })),
    };
  }));

  res.json(enriched);
});

// ─── Create Booking (Broadcast) ───────────────────────────────────────────────

router.post("/bookings", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  // Ensure student record exists
  let [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  if (!student) {
    [student] = await db.insert(studentsTable).values({ userId: user.id, fullName: user.name ?? "Student", email: user.email ?? "" }).returning();
  }

  const { requestedDate, requestedTime, durationMinutes, transmissionType, suburb, postcode, studentNotes, carType, trainingCategory, instructorId: directInstructorId, paymentMethod, vehicleId } = req.body;
  if (!requestedDate || !requestedTime || !suburb || !postcode) {
    res.status(400).json({ error: "requestedDate, requestedTime, suburb, postcode are required" }); return;
  }

  // ── Direct booking: student picked a specific instructor from their calendar ──
  if (directInstructorId) {
    const [directInstructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, directInstructorId));
    if (!directInstructor) { res.status(404).json({ error: "Instructor not found" }); return; }

    // ── Payment resolution ────────────────────────────────────────────────────
    const isBypassWallet = student.isNdis || student.postPayArrangement;
    const effectiveMethod: string = paymentMethod ?? (isBypassWallet ? "invoice" : "wallet");

    let bookingPaymentStatus = "not_applicable";

    if (effectiveMethod === "invoice") {
      // Security: only NDIS or post-pay students may bypass the wallet
      if (!isBypassWallet) {
        res.status(403).json({ error: "Invoice payment is only available for NDIS or post-pay students." });
        return;
      }
      bookingPaymentStatus = "pending_invoice";
    } else if (effectiveMethod === "wallet" && directInstructor.hourlyRateCents) {
      const costCents = Math.round((directInstructor.hourlyRateCents * (durationMinutes ?? 60)) / 60);
      const [wallet] = await db
        .select()
        .from(studentWalletsTable)
        .where(eq(studentWalletsTable.studentId, student.id));
      const balance = wallet?.balanceCents ?? 0;

      if (balance < costCents) {
        res.status(402).json({
          error: "Insufficient wallet balance",
          balanceCents: balance,
          requiredCents: costCents,
        });
        return;
      }

      // Atomic deduction — record already exists or skip if no wallet (balance was 0, cost 0 edge case)
      if (wallet) {
        await db
          .update(studentWalletsTable)
          .set({ balanceCents: wallet.balanceCents - costCents })
          .where(eq(studentWalletsTable.id, wallet.id));
      }
      bookingPaymentStatus = "wallet_deducted";
    }
    // ─────────────────────────────────────────────────────────────────────────

    const [directBooking] = await db.insert(bookingsTable).values({
      studentId: student.id,
      instructorId: directInstructor.id,
      requestedDate, requestedTime,
      durationMinutes: durationMinutes ?? 60,
      transmissionType: transmissionType ?? "auto",
      suburb, postcode,
      carType: carType ?? "trainer_car",
      trainingCategory: trainingCategory ?? "car_learner",
      studentNotes: studentNotes ?? null,
      status: "pending",
      paymentStatus: bookingPaymentStatus,
      broadcastCount: 1,
      claimedAt: null,
      vehicleId: vehicleId ? Number(vehicleId) : null,
    } as any).returning();

    // Notify instructor of the direct request
    if (directInstructor.userId) {
      await db.insert(notificationsTable).values({
        userId: directInstructor.userId,
        type: "booking_request",
        title: "New direct lesson request",
        body: `${student.fullName} has requested a lesson with you on ${requestedDate} at ${requestedTime}. Accept or decline from your bookings page.`,
        relatedId: directBooking.id,
        isRead: false,
      });
    }
    // Notify student
    await db.insert(notificationsTable).values({
      userId: user.id,
      type: "booking_request",
      title: "Lesson request sent",
      body: `Your lesson request with ${directInstructor.fullName} for ${requestedDate} at ${requestedTime} has been sent.`,
      relatedId: directBooking.id,
      isRead: false,
    });

    await logAudit({ actorId: user.id, actorRole: user.role, action: "create_booking", resourceType: "booking", resourceId: directBooking.id, studentId: student.id }, req);
    res.status(201).json({ ...directBooking, broadcastCount: 1 });
    return;
  }

  // Create the booking (broadcast flow)
  const [booking] = await db.insert(bookingsTable).values({
    studentId: student.id,
    requestedDate, requestedTime,
    durationMinutes: durationMinutes ?? 60,
    transmissionType: transmissionType ?? "auto",
    suburb, postcode,
    carType: carType ?? "trainer_car",
    trainingCategory: trainingCategory ?? "car_learner",
    studentNotes: studentNotes ?? null,
    status: "pending",
    broadcastCount: 0,
  }).returning();

  // Find eligible instructors for broadcast
  const day = new Date(requestedDate).getDay();
  const duration = durationMinutes ?? 60;

  const zoneMatches = await db.select().from(instructorZonesTable)
    .where(and(
      eq(instructorZonesTable.suburb, suburb),
      eq(instructorZonesTable.isActive, true),
    ));
  const postcodeMatches = await db.select().from(instructorZonesTable)
    .where(and(eq(instructorZonesTable.postcode, postcode), eq(instructorZonesTable.isActive, true)));
  const zoneInstructorIds = [...new Set([...zoneMatches, ...postcodeMatches].map(z => z.instructorId))];

  let eligibleInstructorIds: number[] = [];
  if (zoneInstructorIds.length > 0) {
    const availSlots = await db.select().from(instructorAvailabilityTable)
      .where(and(
        eq(instructorAvailabilityTable.isActive, true),
        eq(instructorAvailabilityTable.dayOfWeek, day),
        sql`${instructorAvailabilityTable.instructorId} = ANY(${sql.raw(`ARRAY[${zoneInstructorIds.join(",")}]::integer[]`)})`
      ));
    eligibleInstructorIds = availSlots
      .filter(slot => {
        if (transmissionType && transmissionType !== "either") {
          const types = slot.transmissionTypes.split(",").map((s: string) => s.trim());
          if (!types.includes(transmissionType)) return false;
        }
        return slotCoversRequest(slot, requestedDate, requestedTime, duration);
      })
      .map(slot => slot.instructorId);
  }

  // Create broadcast records + in-app notifications for each instructor
  let broadcastCount = 0;
  for (const instructorId of [...new Set(eligibleInstructorIds)]) {
    await db.insert(bookingBroadcastsTable).values({
      bookingId: booking.id, instructorId, notificationType: "in_app", status: "sent",
    });

    // Get instructor's user_id for notification
    const [inst] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, instructorId));
    if (inst) {
      await db.insert(notificationsTable).values({
        userId: inst.userId,
        type: "booking_request",
        title: "New lesson request",
        body: `${student.fullName} wants a ${transmissionType ?? "auto"} lesson in ${suburb} on ${requestedDate} at ${requestedTime}.`,
        relatedId: booking.id,
        isRead: false,
      });
    }
    broadcastCount++;
  }

  // Update broadcast count
  if (broadcastCount > 0) {
    await db.update(bookingsTable).set({ broadcastCount }).where(eq(bookingsTable.id, booking.id));
  }

  await logAudit({ actorId: user.id, actorRole: user.role, action: "create_booking", resourceType: "booking", resourceId: booking.id, studentId: student.id }, req);

  // Notify the student their request was sent
  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "booking_request",
    title: "Booking request sent",
    body: `Your lesson request for ${requestedDate} at ${requestedTime} has been broadcast to ${broadcastCount} instructor${broadcastCount !== 1 ? "s" : ""}.`,
    relatedId: booking.id,
    isRead: false,
  });

  res.status(201).json({ ...booking, broadcastCount });
});

// ─── Claim Booking (first-to-accept) ─────────────────────────────────────────

router.post("/bookings/:id/claim", requireAuth, async (req: any, res): Promise<void> => {
  const bookingId = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(403).json({ error: "Only instructors can claim bookings" }); return; }

  // Compliance check — instructor must have an approved verification with no expired required docs
  const REQUIRED_DOC_TYPES = ["wwcc", "insurance", "license_front", "license_back", "driver_trainer_accreditation"];
  const [latestVerification] = await db
    .select()
    .from(instructorVerificationsTable)
    .where(eq(instructorVerificationsTable.instructorId, instructor.id))
    .orderBy(desc(instructorVerificationsTable.createdAt))
    .limit(1);

  if (!latestVerification || latestVerification.status !== "approved") {
    res.status(403).json({ error: "Your compliance application must be approved before you can accept bookings." });
    return;
  }

  const verificationDocs = await db
    .select()
    .from(verificationDocumentsTable)
    .where(eq(verificationDocumentsTable.verificationId, latestVerification.id));

  const uploadedTypes = new Set(verificationDocs.map((d) => d.docType));
  const missingRequired = REQUIRED_DOC_TYPES.filter((dt) => !uploadedTypes.has(dt));
  if (missingRequired.length > 0) {
    res.status(403).json({ error: "Required compliance documents are missing. Please update your verification before accepting bookings." });
    return;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const expiredDoc = verificationDocs.find((d) => d.expiresAt && d.expiresAt <= todayStr && d.docStatus !== "approved");
  if (expiredDoc) {
    res.status(403).json({ error: `Your ${expiredDoc.docType.replace(/_/g, " ")} has expired. Please resubmit updated documents before accepting bookings.` });
    return;
  }

  // Atomic claim — only succeeds if still pending
  const [claimed] = await db.update(bookingsTable)
    .set({ instructorId: instructor.id, status: "claimed", claimedAt: new Date() })
    .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.status, "pending")))
    .returning();

  if (!claimed) {
    // Already claimed or doesn't exist
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
    if (!existing) { res.status(404).json({ error: "Booking not found" }); return; }
    res.status(409).json({ error: "This booking has already been claimed", booking: formatBooking(existing) });
    return;
  }

  // Notify student
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, claimed.studentId));
  if (student?.userId) {
    await db.insert(notificationsTable).values({
      userId: student.userId,
      type: "booking_claimed",
      title: "Instructor accepted your lesson",
      body: `${instructor.fullName} has accepted your lesson request for ${claimed.requestedDate} at ${claimed.requestedTime}. Contact: ${instructor.phone ?? instructor.email}.`,
      relatedId: claimed.id,
      isRead: false,
    });
  }

  await logAudit({ actorId: user.id, actorRole: user.role, action: "claim_booking", resourceType: "booking", resourceId: bookingId }, req);
  res.json(formatBooking(claimed));
});

// ─── List Bookings ────────────────────────────────────────────────────────────

router.get("/bookings", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const status = req.query.status as string | undefined;

  let rows: any[];

  if (user.role === "admin") {
    rows = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
  } else if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor) { res.json([]); return; }
    // Instructors see bookings that were broadcast to them OR that they claimed
    const broadcasts = await db.select().from(bookingBroadcastsTable).where(eq(bookingBroadcastsTable.instructorId, instructor.id));
    const broadcastIds = broadcasts.map(b => b.bookingId);
    const claimedRows = await db.select().from(bookingsTable).where(eq(bookingsTable.instructorId, instructor.id));
    const broadcastRows = broadcastIds.length > 0
      ? await db.select().from(bookingsTable).where(sql`${bookingsTable.id} = ANY(${sql.raw(`ARRAY[${broadcastIds.join(",")}]::integer[]`)})`)
      : [];
    const allIds = new Set([...claimedRows.map(r => r.id), ...broadcastRows.map(r => r.id)]);
    rows = [...claimedRows, ...broadcastRows.filter(r => !claimedRows.find(c => c.id === r.id))];
  } else {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student) { res.json([]); return; }
    rows = await db.select().from(bookingsTable).where(eq(bookingsTable.studentId, student.id)).orderBy(desc(bookingsTable.createdAt));
  }

  if (status) rows = rows.filter(r => r.status === status);

  const enriched = await Promise.all(rows.map(async (b) => {
    const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, b.studentId));
    const instructor = b.instructorId ? (await db.select({ fullName: instructorsTable.fullName, phone: instructorsTable.phone }).from(instructorsTable).where(eq(instructorsTable.id, b.instructorId)))[0] : null;
    return { ...formatBooking(b), studentName: student?.fullName ?? null, instructorName: instructor?.fullName ?? null, instructorPhone: instructor?.phone ?? null };
  }));

  res.json(enriched);
});

// ─── Get Single Booking ───────────────────────────────────────────────────────

router.get("/bookings/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    // Allow if they own it OR were broadcast to it
    const ownedOrClaimed = instructor && booking.instructorId === instructor.id;
    let wasBroadcast = false;
    if (instructor && !ownedOrClaimed) {
      const [bc] = await db.select({ id: bookingBroadcastsTable.id })
        .from(bookingBroadcastsTable)
        .where(and(eq(bookingBroadcastsTable.bookingId, id), eq(bookingBroadcastsTable.instructorId, instructor.id)))
        .limit(1);
      wasBroadcast = !!bc;
    }
    if (!ownedOrClaimed && !wasBroadcast) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student || booking.studentId !== student.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, booking.studentId));
  const instructor = booking.instructorId ? (await db.select({ fullName: instructorsTable.fullName }).from(instructorsTable).where(eq(instructorsTable.id, booking.instructorId)))[0] : null;
  res.json({ ...formatBooking(booking), studentName: student?.fullName ?? null, instructorName: instructor?.fullName ?? null });
});

// ─── Update Booking Status ────────────────────────────────────────────────────

router.patch("/bookings/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || booking.instructorId !== instructor.id) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
    if (!student || booking.studentId !== student.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const { status, instructorNotes } = req.body;
  const updates: any = {};
  if (status) updates.status = status;
  if (instructorNotes !== undefined) updates.instructorNotes = instructorNotes;
  if (status === "confirmed") updates.confirmedAt = new Date();

  const [updated] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  // Notify relevant parties on cancellation
  if (status === "cancelled") {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, updated.studentId));
    if (student?.userId) {
      await db.insert(notificationsTable).values({
        userId: student.userId, type: "booking_cancelled",
        title: "Booking cancelled",
        body: `Your lesson booking for ${updated.requestedDate} at ${updated.requestedTime} has been cancelled.`,
        relatedId: updated.id, isRead: false,
      });
    }
  }

  await logAudit({ actorId: user.id, actorRole: user.role, action: `update_booking_${status ?? "notes"}`, resourceType: "booking", resourceId: id }, req);
  res.json(formatBooking(updated));
});

// ─── No-show ──────────────────────────────────────────────────────────────────

router.post("/bookings/:id/no-show", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) { res.status(404).json({ error: "Not found" }); return; }

  // Only the assigned instructor or an admin can mark no-show
  if (user.role === "instructor") {
    const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
    if (!instructor || booking.instructorId !== instructor.id) { res.status(403).json({ error: "Access denied" }); return; }
  } else if (user.role === "student") {
    res.status(403).json({ error: "Students cannot mark no-show" }); return;
  }

  const [updated] = await db.update(bookingsTable).set({
    status: "no_show",
    noShowMarkedAt: new Date(),
    noShowMarkedByUserId: user.id,
    statusReason: (req.body.reason as string | undefined) ?? null,
  }).where(eq(bookingsTable.id, id)).returning();

  // Increment student no-show count and recalculate reliability score
  const [student] = await db.select({ id: studentsTable.id, noShowCount: studentsTable.noShowCount, userId: studentsTable.userId })
    .from(studentsTable).where(eq(studentsTable.id, booking.studentId));

  if (student) {
    const newNoShowCount = (student.noShowCount ?? 0) + 1;
    // Simple reliability score: starts at 100, -10 per no-show, floor 0
    const score = Math.max(0, 100 - newNoShowCount * 10);
    await db.update(studentsTable).set({ noShowCount: newNoShowCount, attendanceReliabilityScore: score })
      .where(eq(studentsTable.id, student.id));

    // Notify student if they have an account
    if (student.userId) {
      await db.insert(notificationsTable).values({
        userId: student.userId,
        type: "booking_no_show",
        title: "Lesson marked as no-show",
        body: `Your lesson on ${booking.requestedDate} at ${booking.requestedTime} was marked as no-show.`,
        relatedId: id,
        relatedType: "booking",
        channel: "in_app",
        deliveryStatus: "sent",
        deliveredAt: new Date(),
        isRead: false,
      });
    }
  }

  await logAudit({ actorId: user.id, actorRole: user.role, action: "mark_no_show", resourceType: "booking", resourceId: id, studentId: booking.studentId }, req);
  res.json(formatBooking(updated));
});

// ─── Decline Booking (instructor declines a broadcast) ───────────────────────

router.post("/bookings/:id/decline", requireAuth, async (req: any, res): Promise<void> => {
  const bookingId = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id));
  if (!instructor) { res.status(403).json({ error: "Only instructors can decline bookings" }); return; }

  await db.update(bookingBroadcastsTable)
    .set({ status: "declined" })
    .where(and(eq(bookingBroadcastsTable.bookingId, bookingId), eq(bookingBroadcastsTable.instructorId, instructor.id)));

  res.json({ ok: true });
});

function formatBooking(b: any) {
  return {
    id: b.id, studentId: b.studentId, instructorId: b.instructorId,
    requestedDate: b.requestedDate, requestedTime: b.requestedTime,
    durationMinutes: b.durationMinutes, transmissionType: b.transmissionType,
    suburb: b.suburb, postcode: b.postcode, status: b.status,
    paymentStatus: b.paymentStatus ?? "not_applicable",
    carType: b.carType ?? "trainer_car",
    trainingCategory: b.trainingCategory ?? "car_learner",
    studentNotes: b.studentNotes, instructorNotes: b.instructorNotes,
    broadcastCount: b.broadcastCount, claimedAt: b.claimedAt,
    confirmedAt: b.confirmedAt, cancelledAt: b.cancelledAt,
    noShowMarkedAt: b.noShowMarkedAt, statusReason: b.statusReason,
    createdAt: b.createdAt,
    studentName: null, instructorName: null,
  };
}

export default router;
