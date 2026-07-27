/**
 * backfill-hours-split.ts — Retroactively classifies existing assessment hours
 * as instructor_hours or supervised_hours on the students table.
 *
 * Background: when the instructor_hours/supervised_hours columns were added,
 * existing total_hours was left as-is with both columns defaulting to 0.
 * This script recalculates the split from assessments.performed_by_role and
 * assessments.duration_minutes for every student.
 *
 * Safe to re-run (idempotent). It always recomputes from the source of truth
 * (the assessments table) so running it again is harmless.
 *
 * Run: pnpm --filter @workspace/scripts run backfill-hours-split
 */

import { db, pool } from "@workspace/db";
import { assessmentsTable, studentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

async function run() {
  console.log("Starting backfill: instructor_hours / supervised_hours split...\n");

  // Pull all students that might need a correction: those where the sum of
  // instructor_hours + supervised_hours doesn't yet account for all their
  // total_hours. We re-derive everything from assessments, so this is fully
  // idempotent regardless of their current state.
  const students = await db.select({ id: studentsTable.id, fullName: studentsTable.fullName }).from(studentsTable);

  console.log(`Found ${students.length} student record(s) to process.\n`);

  let updated = 0;
  let skipped = 0;

  for (const student of students) {
    // Sum minutes by role for this student.
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
      // Any other role value (future proofing) is silently ignored.
    }

    const instructorHours = instructorMinutes / 60;
    const supervisedHours = supervisedMinutes / 60;
    const derivedTotal = instructorHours + supervisedHours;

    // Always write the derived split so the columns are consistent with the
    // assessments table. Also recalculate total_hours from assessments so
    // imported records that may have had total_hours set by other means are
    // aligned.
    await db
      .update(studentsTable)
      .set({
        instructorHours,
        supervisedHours,
        // Recalculate total_hours as the authoritative sum from assessments.
        // This keeps the three columns consistent with each other.
        totalHours: derivedTotal,
      })
      .where(eq(studentsTable.id, student.id));

    console.log(
      `  Student ${student.id} (${student.fullName}): ` +
        `instructor=${instructorHours.toFixed(2)}h, supervised=${supervisedHours.toFixed(2)}h, total=${derivedTotal.toFixed(2)}h`
    );
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await pool.end();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
