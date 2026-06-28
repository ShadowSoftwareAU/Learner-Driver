import { Router } from "express";
import { eq, sql, count, desc, and, inArray, isNotNull, lte } from "drizzle-orm";
import {
  db,
  instructorsTable,
  usersTable,
  studentsTable,
  assessmentsTable,
  instructorVehiclesTable,
  sessionFeedbackTable,
  instructorVerificationsTable,
  verificationDocumentsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// ─── List instructors (with primary vehicle + training categories) ─────────────

router.get("/instructors", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  // Scoping: school_admin sees only their school's instructors; super_admin sees all
  let rows = await db.select().from(instructorsTable).orderBy(instructorsTable.fullName);

  if (["school_admin", "admin"].includes(user.role) && user.schoolId) {
    // Filter to instructors belonging to this school via schoolInstructorsTable is complex;
    // simpler: filter by defaultSchoolId matching user's school
    rows = rows.filter(i => i.defaultSchoolId === user.schoolId || i.isIndependent);
  }

  // Load primary vehicles for all instructors in one query
  const ids = rows.map(r => r.id);
  const vehicles = ids.length > 0
    ? await db.select().from(instructorVehiclesTable)
        .where(and(inArray(instructorVehiclesTable.instructorId, ids), eq(instructorVehiclesTable.isPrimary, true)))
    : [];

  const vehicleMap = new Map(vehicles.map(v => [v.instructorId, v]));

  // Active student count per instructor
  const studentCounts = ids.length > 0
    ? await db.select({
        instructorId: studentsTable.createdByInstructorId,
        c: count(),
      }).from(studentsTable)
        .where(inArray(studentsTable.createdByInstructorId, ids))
        .groupBy(studentsTable.createdByInstructorId)
    : [];
  const countMap = new Map(studentCounts.map(s => [s.instructorId, Number(s.c)]));

  // Compliance status: derive from the latest verification application status
  const allVerifications = ids.length > 0
    ? await db.select({
        id: instructorVerificationsTable.id,
        instructorId: instructorVerificationsTable.instructorId,
        status: instructorVerificationsTable.status,
        createdAt: instructorVerificationsTable.createdAt,
      })
        .from(instructorVerificationsTable)
        .where(inArray(instructorVerificationsTable.instructorId, ids))
        .orderBy(desc(instructorVerificationsTable.createdAt))
    : [];
  // Keep only the latest verification per instructor
  const latestVerifByInstructor = new Map<number, string>();
  for (const v of allVerifications) {
    if (!latestVerifByInstructor.has(v.instructorId)) {
      latestVerifByInstructor.set(v.instructorId, v.status);
    }
  }

  // Check for expiring documents across all verifications
  const verifIdList = allVerifications.map(v => v.id);
  const uploadedDocs = verifIdList.length > 0
    ? await db.select({
        verificationId: verificationDocumentsTable.verificationId,
        docType: verificationDocumentsTable.docType,
        expiresAt: verificationDocumentsTable.expiresAt,
      })
        .from(verificationDocumentsTable)
        .where(inArray(verificationDocumentsTable.verificationId, verifIdList))
    : [];
  const verifByVerifId = new Map(allVerifications.map(v => [v.id, v.instructorId]));
  const expiringByInstructor = new Map<number, boolean>();

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().slice(0, 10);

  for (const doc of uploadedDocs) {
    const iid = verifByVerifId.get(doc.verificationId);
    if (iid !== undefined && doc.expiresAt && doc.expiresAt <= in30DaysStr) {
      expiringByInstructor.set(iid, true);
    }
  }
  const getComplianceStatus = (iid: number): "compliant" | "partial" | "incomplete" => {
    const status = latestVerifByInstructor.get(iid);
    if (status === "approved") return "compliant";
    if (status === "pending" || status === "needs_revision" || status === "rejected") return "partial";
    return "incomplete";
  };

  const trainingCategory = req.query.trainingCategory as string | undefined;

  let result = rows.map(i => ({
    ...formatInstructor(i, countMap.get(i.id) ?? 0, vehicleMap.get(i.id) ?? null),
    complianceStatus: getComplianceStatus(i.id),
    hasExpiringDocs: expiringByInstructor.get(i.id) ?? false,
  }));

  if (trainingCategory) {
    result = result.filter(i => Array.isArray(i.trainingCategories) && i.trainingCategories.includes(trainingCategory));
  }

  res.json(result);
});

// ─── Get instructor detail ────────────────────────────────────────────────────

router.get("/instructors/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [i] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, id));
  if (!i) { res.status(404).json({ error: "Not found" }); return; }

  // Vehicles
  const vehicles = await db.select().from(instructorVehiclesTable)
    .where(eq(instructorVehiclesTable.instructorId, id))
    .orderBy(desc(instructorVehiclesTable.isPrimary), instructorVehiclesTable.createdAt);

  // Active student count
  const [studentCount] = await db.select({ c: count() }).from(studentsTable)
    .where(eq(studentsTable.createdByInstructorId, id));

  // Recent assessment stats
  const [assessmentStats] = await db.select({ c: count() }).from(assessmentsTable)
    .where(eq(assessmentsTable.instructorId, id));

  const completedStats = await db.select({ c: count() }).from(assessmentsTable)
    .where(and(eq(assessmentsTable.instructorId, id), eq(assessmentsTable.status, "completed")));

  // Feedback summary
  const feedbackRows = await db.select({
    overallRating: sessionFeedbackTable.overallRating,
    communicationRating: sessionFeedbackTable.communicationRating,
    safetyFocusRating: sessionFeedbackTable.safetyFocusRating,
    lessonQualityRating: sessionFeedbackTable.lessonQualityRating,
    wouldRecommend: sessionFeedbackTable.wouldRecommend,
  }).from(sessionFeedbackTable).where(eq(sessionFeedbackTable.instructorId, id));

  const fbCount = feedbackRows.length;
  const avgOverall = fbCount > 0
    ? parseFloat((feedbackRows.reduce((s, r) => s + (r.overallRating ?? 0), 0) / fbCount).toFixed(1))
    : null;
  const recommendRate = fbCount > 0
    ? Math.round((feedbackRows.filter(r => r.wouldRecommend).length / fbCount) * 100)
    : null;

  res.json({
    ...formatInstructor(i, Number(studentCount?.c ?? 0), null),
    vehicles: vehicles.map(v => ({
      id: v.id,
      vehicleType: v.vehicleType,
      make: v.make,
      model: v.model,
      year: v.year,
      colour: v.colour,
      rego: v.rego,
      regoState: v.regoState,
      regoExpiry: v.regoExpiry,
      isDualControl: v.isDualControl,
      isOwnerOperator: v.isOwnerOperator,
      isPrimary: v.isPrimary,
      insuranceProvider: v.insuranceProvider,
      insurancePolicyNumber: v.insurancePolicyNumber,
      insuranceType: v.insuranceType,
      insuranceExpiry: v.insuranceExpiry,
      status: v.status,
      notes: v.notes,
      createdAt: v.createdAt,
    })),
    stats: {
      activeStudents: Number(studentCount?.c ?? 0),
      totalAssessments: Number(assessmentStats?.c ?? 0),
      completedAssessments: Number(completedStats[0]?.c ?? 0),
      totalFeedback: fbCount,
      avgOverall,
      recommendRate,
    },
  });
});

// ─── List verifications for one instructor (admin) ────────────────────────────

async function requireAdmin(req: any, res: any, next: any): Promise<void> {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!["admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get("/instructors/:id/verifications", requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const verifications = await db
    .select({
      id: instructorVerificationsTable.id,
      status: instructorVerificationsTable.status,
      submittedAt: instructorVerificationsTable.submittedAt,
      reviewedAt: instructorVerificationsTable.reviewedAt,
      reviewerNotes: instructorVerificationsTable.reviewerNotes,
      createdAt: instructorVerificationsTable.createdAt,
      instructorId: instructorVerificationsTable.instructorId,
      instructorName: instructorsTable.fullName,
      instructorEmail: instructorsTable.email,
    })
    .from(instructorVerificationsTable)
    .innerJoin(instructorsTable, eq(instructorVerificationsTable.instructorId, instructorsTable.id))
    .where(eq(instructorVerificationsTable.instructorId, id))
    .orderBy(desc(instructorVerificationsTable.createdAt));

  const withDocs = await Promise.all(
    verifications.map(async (v) => {
      const docs = await db
        .select()
        .from(verificationDocumentsTable)
        .where(eq(verificationDocumentsTable.verificationId, v.id));
      return { ...v, documents: docs };
    })
  );

  res.json(withDocs);
});

// ─── Update instructor profile ────────────────────────────────────────────────

router.patch("/instructors/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { fullName, phone, licenseNumber, vehicleMake, vehicleModel, vehicleYear, qualifications, state } = req.body;
  const updates: any = {};
  if (fullName) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
  if (vehicleMake !== undefined) updates.vehicleMake = vehicleMake;
  if (vehicleModel !== undefined) updates.vehicleModel = vehicleModel;
  if (vehicleYear !== undefined) updates.vehicleYear = vehicleYear;
  if (qualifications !== undefined) updates.qualifications = qualifications;
  if (state !== undefined) updates.state = state;
  const [updated] = await db.update(instructorsTable).set(updates).where(eq(instructorsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatInstructor(updated, 0, null));
});

function formatInstructor(i: any, activeStudents: number, primaryVehicle: any | null) {
  return {
    id: i.id,
    userId: i.userId,
    fullName: i.fullName,
    email: i.email,
    phone: i.phone ?? null,
    licenseNumber: i.licenseNumber ?? null,
    vehicleMake: i.vehicleMake ?? null,
    vehicleModel: i.vehicleModel ?? null,
    vehicleYear: i.vehicleYear ?? null,
    qualifications: i.qualifications ?? null,
    trainingCategories: i.trainingCategories ?? [],
    state: i.state ?? null,
    isIndependent: i.isIndependent,
    activeStudents,
    primaryVehicle: primaryVehicle ? {
      id: primaryVehicle.id,
      vehicleType: primaryVehicle.vehicleType,
      make: primaryVehicle.make,
      model: primaryVehicle.model,
      year: primaryVehicle.year ?? null,
      colour: primaryVehicle.colour ?? null,
      rego: primaryVehicle.rego ?? null,
      regoState: primaryVehicle.regoState ?? "QLD",
      isDualControl: primaryVehicle.isDualControl,
    } : null,
    createdAt: i.createdAt,
  };
}

export default router;
