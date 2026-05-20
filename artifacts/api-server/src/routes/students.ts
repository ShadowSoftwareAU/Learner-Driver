import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, studentsTable, usersTable, assessmentsTable, maneuverResultsTable, maneuversTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { logger } from "../lib/logger";
import { logAudit } from "./audit";

const router = Router();

router.get("/students", requireAuth, async (req: any, res): Promise<void> => {
  const auth = req.clerkUserId;
  const user = await getOrCreateUser(auth, "");
  let rows;
  if (user.role === "admin") {
    rows = await db.select().from(studentsTable).orderBy(studentsTable.fullName);
  } else if (user.role === "instructor") {
    rows = await db.select().from(studentsTable).orderBy(studentsTable.fullName);
  } else {
    rows = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id));
  }
  res.json(rows.map(formatStudent));
});

router.post("/students", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { fullName, email, phone, dateOfBirth, guardianName, guardianPhone, licenseNumber } = req.body;
  if (!fullName || !email) { res.status(400).json({ error: "fullName and email required" }); return; }
  const [s] = await db.insert(studentsTable).values({ userId: user.id, fullName, email, phone: phone ?? null, dateOfBirth: dateOfBirth ?? null, guardianName: guardianName ?? null, guardianPhone: guardianPhone ?? null, licenseNumber: licenseNumber ?? null }).returning();
  await logAudit({ actorId: user.id, action: "create_student", resourceType: "student", resourceId: s.id, studentId: s.id });
  res.status(201).json(formatStudent(s));
});

router.get("/students/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [s] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit({ actorId: user.id, action: "view_student", resourceType: "student", resourceId: s.id, studentId: s.id });
  res.json(formatStudent(s));
});

router.patch("/students/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { fullName, phone, guardianName, guardianPhone, licenseNumber, status } = req.body;
  const updates: any = {};
  if (fullName) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (guardianName !== undefined) updates.guardianName = guardianName;
  if (guardianPhone !== undefined) updates.guardianPhone = guardianPhone;
  if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
  if (status) updates.status = status;
  const [updated] = await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatStudent(updated));
});

router.get("/students/:id/progress", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
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
  return { id: s.id, userId: s.userId, fullName: s.fullName, email: s.email, phone: s.phone, dateOfBirth: s.dateOfBirth, guardianName: s.guardianName, guardianPhone: s.guardianPhone, licenseNumber: s.licenseNumber, totalHours: s.totalHours, status: s.status, createdAt: s.createdAt };
}

function formatAssessment(a: any) {
  return { id: a.id, studentId: a.studentId, instructorId: a.instructorId, studentName: null, instructorName: null, lessonDate: a.lessonDate, durationMinutes: a.durationMinutes, status: a.status, confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt };
}

export default router;
