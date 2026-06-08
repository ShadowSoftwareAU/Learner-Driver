import { Router } from "express";
import { eq, sql, and, or } from "drizzle-orm";
import { db, studentsTable, usersTable, assessmentsTable, maneuverResultsTable, maneuversTable, instructorsTable, bookingsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logger } from "../lib/logger";
import { logAudit } from "./audit";

const router = Router();

/**
 * Returns true if the given instructor has ever had an assessment or
 * a claimed/confirmed/completed booking with this student.
 */
async function instructorHasStudent(instructorId: number, studentId: number): Promise<boolean> {
  const [created] = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.createdByInstructorId, instructorId)))
    .limit(1);
  if (created) return true;

  const [assessment] = await db
    .select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(and(eq(assessmentsTable.instructorId, instructorId), eq(assessmentsTable.studentId, studentId)))
    .limit(1);
  if (assessment) return true;

  const [booking] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.instructorId, instructorId), eq(bookingsTable.studentId, studentId)))
    .limit(1);
  return !!booking;
}

/**
 * Returns the instructor record for the authenticated user, or 403 if not found.
 */
async function getInstructor(userId: number, res: any) {
  const [instructor] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, userId));
  if (!instructor) {
    res.status(403).json({ error: "Instructor record not found" });
    return null;
  }
  return instructor;
}

router.get("/students", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  let rows;

  if (user.role === "admin") {
    rows = await db.select().from(studentsTable).orderBy(studentsTable.fullName);
  } else if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;

    // Only return students this instructor has worked with (via assessment or booking)
    const assessed = await db
      .selectDistinct({ studentId: assessmentsTable.studentId })
      .from(assessmentsTable)
      .where(eq(assessmentsTable.instructorId, instructor.id));

    const booked = await db
      .selectDistinct({ studentId: bookingsTable.studentId })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.instructorId, instructor.id)));

    const created = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.createdByInstructorId, instructor.id));

    const studentIds = [...new Set([
      ...assessed.map(r => r.studentId),
      ...booked.map(r => r.studentId),
      ...created.map(r => r.id),
    ])];

    if (studentIds.length === 0) {
      res.json([]);
      return;
    }

    rows = await db
      .select()
      .from(studentsTable)
      .where(sql`${studentsTable.id} = ANY(${sql.raw(`ARRAY[${studentIds.join(",")}]::integer[]`)})`)
      .orderBy(studentsTable.fullName);
  } else {
    rows = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  }

  res.json(rows.map(formatStudent));
});

router.post("/students", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const {
    fullName, email, phone, dateOfBirth, guardianName, guardianPhone,
    guardianEmail, pcycSchoolEmail, licenseNumber, licenceFrontPath,
    licenceBackPath, headshotPath, notes, region, country,
  } = req.body;
  if (!fullName || !email) { res.status(400).json({ error: "fullName and email required" }); return; }

  // A student onboarding themselves links the profile to their own user account.
  // An instructor (or admin) manually creating a profile leaves userId null
  // (the learner has no account yet) and stamps createdByInstructorId so the
  // profile surfaces in that instructor's student list.
  let userId: number | null = null;
  let createdByInstructorId: number | null = null;
  if (user.role === "student") {
    userId = user.id;
  } else if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    createdByInstructorId = instructor.id;
  }

  const [s] = await db.insert(studentsTable).values({
    userId,
    createdByInstructorId,
    fullName,
    email,
    phone: phone ?? null,
    dateOfBirth: dateOfBirth ?? null,
    guardianName: guardianName ?? null,
    guardianPhone: guardianPhone ?? null,
    guardianEmail: guardianEmail ?? null,
    pcycSchoolEmail: pcycSchoolEmail ?? null,
    licenseNumber: licenseNumber ?? null,
    licenceFrontPath: licenceFrontPath ?? null,
    licenceBackPath: licenceBackPath ?? null,
    headshotPath: headshotPath ?? null,
    notes: notes ?? null,
    region: region ?? null,
    country: country ?? null,
  }).returning();
  await logAudit({ actorId: user.id, action: "create_student", resourceType: "student", resourceId: s.id, studentId: s.id });
  res.status(201).json(formatStudent(s));
});

router.get("/students/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, id))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (user.role === "student" && s.userId !== user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await logAudit({ actorId: user.id, action: "view_student", resourceType: "student", resourceId: s.id, studentId: s.id });
  res.json(formatStudent(s));
});

router.patch("/students/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  // Only admins and the student themselves can edit student records
  if (user.role === "instructor") {
    res.status(403).json({ error: "Instructors cannot edit student records" });
    return;
  }
  if (user.role === "student") {
    const [s] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, id));
    if (!s || s.userId !== user.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const { fullName, phone, guardianName, guardianPhone, guardianEmail, pcycSchoolEmail, licenseNumber, licenceFrontPath, licenceBackPath, headshotPath, notes, status, region, country } = req.body;
  const updates: any = {};
  if (fullName) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (guardianName !== undefined) updates.guardianName = guardianName;
  if (guardianPhone !== undefined) updates.guardianPhone = guardianPhone;
  if (guardianEmail !== undefined) updates.guardianEmail = guardianEmail;
  if (pcycSchoolEmail !== undefined) updates.pcycSchoolEmail = pcycSchoolEmail;
  if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
  if (licenceFrontPath !== undefined) updates.licenceFrontPath = licenceFrontPath;
  if (licenceBackPath !== undefined) updates.licenceBackPath = licenceBackPath;
  if (headshotPath !== undefined) updates.headshotPath = headshotPath;
  if (notes !== undefined) updates.notes = notes;
  if (region !== undefined) updates.region = region;
  if (country !== undefined) updates.country = country;
  if (status && user.role === "admin") updates.status = status; // only admins can change status
  const [updated] = await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatStudent(updated));
});

router.get("/students/:id/progress", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (user.role === "instructor") {
    const instructor = await getInstructor(user.id, res);
    if (!instructor) return;
    if (!(await instructorHasStudent(instructor.id, studentId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (user.role === "student") {
    const [s] = await db.select({ userId: studentsTable.userId }).from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!s || s.userId !== user.id) { res.status(403).json({ error: "Access denied" }); return; }
  }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student) { res.status(404).json({ error: "Not found" }); return; }

  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);
  const assessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.studentId, studentId)).orderBy(assessmentsTable.lessonDate);

  const assessmentIds = assessments.map(a => a.id);
  let allResults: any[] = [];
  if (assessmentIds.length > 0) {
    allResults = await db.select().from(maneuverResultsTable).where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`) ;
  }

  const bestLevel: Record<number, string> = {};
  const levelOrder = ["not_attempted", "attempted", "practiced", "mastered"];
  for (const r of allResults) {
    const cur = bestLevel[r.maneuverId];
    if (!cur || levelOrder.indexOf(r.competencyLevel) > levelOrder.indexOf(cur)) {
      bestLevel[r.maneuverId] = r.competencyLevel;
    }
  }

  const categories = [...new Set(allManeuvers.map(m => m.category))];
  const skillBreakdown = categories.map(cat => {
    const catManeuvers = allManeuvers.filter(m => m.category === cat);
    const mastered = catManeuvers.filter(m => bestLevel[m.id] === "mastered").length;
    const practicing = catManeuvers.filter(m => bestLevel[m.id] === "practiced" || bestLevel[m.id] === "attempted").length;
    const notStarted = catManeuvers.filter(m => !bestLevel[m.id] || bestLevel[m.id] === "not_attempted").length;
    return { category: cat, total: catManeuvers.length, mastered, practicing, notStarted };
  });

  const completedManeuvers = Object.values(bestLevel).filter(l => l === "mastered").length;

  await logAudit({ actorId: user.id, action: "view_student_progress", resourceType: "student", resourceId: studentId, studentId });

  res.json({
    studentId,
    totalHours: student.totalHours,
    completedManeuvers,
    totalManeuvers: allManeuvers.length,
    skillBreakdown,
    recentAssessments: assessments.slice(-5).reverse().map(formatAssessment),
  });
});

function formatStudent(s: any) {
  return { id: s.id, userId: s.userId, createdByInstructorId: s.createdByInstructorId, fullName: s.fullName, email: s.email, phone: s.phone, dateOfBirth: s.dateOfBirth, guardianName: s.guardianName, guardianPhone: s.guardianPhone, guardianEmail: s.guardianEmail, pcycSchoolEmail: s.pcycSchoolEmail, licenseNumber: s.licenseNumber, licenceFrontPath: s.licenceFrontPath, licenceBackPath: s.licenceBackPath, headshotPath: s.headshotPath, notes: s.notes, region: s.region, country: s.country, totalHours: s.totalHours, status: s.status, createdAt: s.createdAt };
}

function formatAssessment(a: any) {
  return { id: a.id, studentId: a.studentId, instructorId: a.instructorId, studentName: null, instructorName: null, lessonDate: a.lessonDate, durationMinutes: a.durationMinutes, status: a.status, confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt };
}

export default router;
