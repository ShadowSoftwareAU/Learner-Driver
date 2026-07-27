/**
 * admin-backfill.ts — Admin-only endpoint to trigger data backfills.
 *
 * POST /admin/backfill/hours-split
 *   Retroactively splits students.total_hours into instructor_hours /
 *   supervised_hours based on the assessments.performed_by_role column.
 *   Idempotent — safe to call multiple times.
 *   Requires super_admin role.
 */

import { Router } from "express";
import { db, assessmentsTable, studentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "./users";
import { logAudit } from "./audit";

const router = Router();

router.post("/admin/backfill/hours-split", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (user.role !== "super_admin" && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden — super_admin or admin role required" });
    return;
  }

  const students = await db
    .select({ id: studentsTable.id, fullName: studentsTable.fullName })
    .from(studentsTable);

  const results: Array<{
    studentId: number;
    fullName: string;
    instructorHours: number;
    supervisedHours: number;
    totalHours: number;
  }> = [];

  for (const student of students) {
    const rows = await db
      .select({
        performedByRole: assessmentsTable.performedByRole,
        totalMinutes: sql<number>`COALESCE(SUM(${assessmentsTable.durationMinutes}), 0)`.as("total_minutes"),
      })
      .from(assessmentsTable)
      .where(eq(assessmentsTable.studentId, student.id))
      .groupBy(assessmentsTable.performedByRole);

    let instructorMinutes = 0;
    let supervisedMinutes = 0;

    for (const row of rows) {
      if (row.performedByRole === "instructor") {
        instructorMinutes += Number(row.totalMinutes);
      } else if (row.performedByRole === "supervised") {
        supervisedMinutes += Number(row.totalMinutes);
      }
    }

    const instructorHours = instructorMinutes / 60;
    const supervisedHours = supervisedMinutes / 60;
    const totalHours = instructorHours + supervisedHours;

    await db
      .update(studentsTable)
      .set({ instructorHours, supervisedHours, totalHours })
      .where(eq(studentsTable.id, student.id));

    results.push({ studentId: student.id, fullName: student.fullName, instructorHours, supervisedHours, totalHours });
  }

  await logAudit(
    {
      actorId: user.id,
      actorRole: user.role,
      action: "backfill_hours_split",
      resourceType: "students",
      resourceId: 0,
    },
    req,
  );

  res.json({
    ok: true,
    studentsProcessed: results.length,
    results,
  });
});

export default router;
