import { Router } from "express";
import { eq, desc, count, sql, and, gte } from "drizzle-orm";
import { db, studentsTable, instructorsTable, assessmentsTable, maneuverResultsTable, maneuversTable, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

router.get("/dashboard/instructor", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  let instructor = (await db.select().from(instructorsTable).where(eq(instructorsTable.userId, user.id)))[0];
  if (!instructor) {
    [instructor] = await db.insert(instructorsTable).values({ userId: user.id, fullName: user.name ?? "Instructor", email: user.email ?? "" }).returning();
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekStr = oneWeekAgo.toISOString().split("T")[0];

  const allStudents = await db.select().from(studentsTable).where(eq(studentsTable.status, "active"));
  const recentAssessments = await db.select().from(assessmentsTable)
    .where(eq(assessmentsTable.instructorId, instructor.id))
    .orderBy(desc(assessmentsTable.lessonDate)).limit(5);

  const lessonsThisWeek = (await db.select().from(assessmentsTable)
    .where(and(eq(assessmentsTable.instructorId, instructor.id), gte(assessmentsTable.lessonDate, weekStr)))).length;

  const allMyAssessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.instructorId, instructor.id));
  const totalHoursLogged = allMyAssessments.reduce((sum, a) => sum + a.durationMinutes / 60, 0);

  const studentSummaries = await Promise.all(allStudents.slice(0, 10).map(async (s) => {
    const studentAssessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.studentId, s.id)).orderBy(desc(assessmentsTable.lessonDate)).limit(1);
    const rawPercent = Math.min((Number(s.totalHours) / 100) * 100, 100);
    return { id: s.id, fullName: s.fullName, totalHours: s.totalHours, progressPercent: Math.round(rawPercent), lastLessonDate: studentAssessments[0]?.lessonDate ?? null, status: s.status };
  }));

  const enriched = await Promise.all(recentAssessments.map(async (a) => {
    const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, a.studentId));
    return { id: a.id, studentId: a.studentId, instructorId: a.instructorId, studentName: student?.fullName ?? null, instructorName: instructor.fullName, lessonDate: a.lessonDate, durationMinutes: a.durationMinutes, status: a.status, confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt };
  }));

  res.json({ activeStudents: allStudents.length, lessonsThisWeek, totalHoursLogged: Math.round(totalHoursLogged * 10) / 10, recentAssessments: enriched, studentSummaries });
});

router.get("/dashboard/student", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  let student = (await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id)))[0];
  if (!student) {
    [student] = await db.insert(studentsTable).values({ userId: user.id, fullName: user.name ?? "Student", email: user.email ?? "" }).returning();
  }

  const allManeuvers = await db.select().from(maneuversTable);
  const assessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.studentId, student.id)).orderBy(desc(assessmentsTable.lessonDate));
  const assessmentIds = assessments.map(a => a.id);

  let allResults: any[] = [];
  if (assessmentIds.length > 0) {
    allResults = await db.select().from(maneuverResultsTable).where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`);
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
  const progressPercent = allManeuvers.length > 0 ? Math.round((completedManeuvers / allManeuvers.length) * 100) : 0;

  const lastAssessment = assessments[0];
  const nextFocusAreas = lastAssessment?.focusAreasNext ?? null;

  const recentAssessments = assessments.slice(0, 5).map(a => ({ id: a.id, studentId: a.studentId, instructorId: a.instructorId, studentName: student.fullName, instructorName: null, lessonDate: a.lessonDate, durationMinutes: a.durationMinutes, status: a.status, performedByRole: (a as any).performedByRole ?? "instructor", confidenceNote: a.confidenceNote, focusAreasNext: a.focusAreasNext, createdAt: a.createdAt }));

  const instructorHours = Number(student.instructorHours ?? 0);
  const supervisedHours = Number(student.supervisedHours ?? 0);
  const isQLD = student.state === "QLD";
  // QLD: 1 instructor hour = 3 effective hours toward the 100-hour requirement
  const effectiveTotalHours = isQLD
    ? Math.round((instructorHours * 3 + supervisedHours) * 10) / 10
    : Math.round((instructorHours + supervisedHours) * 10) / 10;

  res.json({
    studentId: student.id,
    totalHours: student.totalHours,
    instructorHours: Math.round(instructorHours * 10) / 10,
    supervisedHours: Math.round(supervisedHours * 10) / 10,
    effectiveTotalHours,
    isQLD,
    completedManeuvers,
    totalManeuvers: allManeuvers.length,
    progressPercent,
    nextFocusAreas,
    recentAssessments,
    skillBreakdown,
  });
});

router.get("/dashboard/admin", requireAuth, async (req: any, res): Promise<void> => {
  const [totalStudents] = await db.select({ c: count() }).from(studentsTable);
  const [totalInstructors] = await db.select({ c: count() }).from(instructorsTable);
  const [totalAssessments] = await db.select({ c: count() }).from(assessmentsTable);
  const [activeStudents] = await db.select({ c: count() }).from(studentsTable).where(eq(studentsTable.status, "active"));

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const monthStr = oneMonthAgo.toISOString().split("T")[0];
  const monthAssessments = await db.select().from(assessmentsTable).where(gte(assessmentsTable.lessonDate, monthStr));
  const hoursLoggedThisMonth = monthAssessments.reduce((sum, a) => sum + a.durationMinutes / 60, 0);

  const recentActivity = await db.select({
    id: auditLogsTable.id, actorId: auditLogsTable.actorId, actorName: usersTable.name,
    action: auditLogsTable.action, resourceType: auditLogsTable.resourceType, resourceId: auditLogsTable.resourceId,
    studentId: auditLogsTable.studentId, metadata: auditLogsTable.metadata, createdAt: auditLogsTable.createdAt,
  }).from(auditLogsTable).leftJoin(usersTable, eq(auditLogsTable.actorId, usersTable.id)).orderBy(desc(auditLogsTable.createdAt)).limit(10);

  const instructors = await db.select().from(instructorsTable);
  const instructorStats = await Promise.all(instructors.map(async (i) => {
    const lessons = await db.select().from(assessmentsTable).where(and(eq(assessmentsTable.instructorId, i.id), gte(assessmentsTable.lessonDate, monthStr)));
    const totalLessons = (await db.select({ c: count() }).from(assessmentsTable).where(eq(assessmentsTable.instructorId, i.id)))[0]?.c ?? 0;
    return { id: i.id, fullName: i.fullName, activeStudents: 0, totalLessons, hoursThisMonth: Math.round(lessons.reduce((s, a) => s + a.durationMinutes / 60, 0) * 10) / 10 };
  }));

  res.json({
    totalStudents: totalStudents.c, totalInstructors: totalInstructors.c, totalAssessments: totalAssessments.c,
    activeStudents: activeStudents.c, hoursLoggedThisMonth: Math.round(hoursLoggedThisMonth * 10) / 10,
    recentActivity, instructorStats,
  });
});

export default router;
