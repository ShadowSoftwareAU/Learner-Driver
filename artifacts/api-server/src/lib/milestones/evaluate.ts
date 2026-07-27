import { db, assessmentsTable, maneuverResultsTable, maneuversTable, studentMilestonesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

/**
 * Evaluate which milestones a student has newly earned and persist them.
 * Called after maneuver results are saved or hours are updated.
 * Returns a list of newly earned milestone ids.
 */
export async function evaluateAndPersistMilestones(studentId: number, totalHours: number): Promise<string[]> {
  // ── Load existing milestones ──────────────────────────────────────────────
  const existing = await db
    .select({ milestoneId: studentMilestonesTable.milestoneId })
    .from(studentMilestonesTable)
    .where(eq(studentMilestonesTable.studentId, studentId));
  const earned = new Set(existing.map(r => r.milestoneId));

  // ── Load student data ─────────────────────────────────────────────────────
  const assessments = await db
    .select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(eq(assessmentsTable.studentId, studentId));

  const assessmentIds = assessments.map(a => a.id);

  let allResults: { maneuverId: number; competencyLevel: string }[] = [];
  let maneuverNames: Record<number, string> = {};
  const totalManeuvers = (await db.select({ id: maneuversTable.id }).from(maneuversTable)).length;

  if (assessmentIds.length > 0) {
    allResults = await db
      .select({ maneuverId: maneuverResultsTable.maneuverId, competencyLevel: maneuverResultsTable.competencyLevel })
      .from(maneuverResultsTable)
      .where(sql`${maneuverResultsTable.assessmentId} = ANY(${sql.raw(`ARRAY[${assessmentIds.join(",")}]::integer[]`)})`);

    // Get maneuver names for practice-count milestones
    const manRows = await db.select({ id: maneuversTable.id, name: maneuversTable.name }).from(maneuversTable);
    for (const m of manRows) maneuverNames[m.id] = m.name.toLowerCase();
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const levelOrder = ["not_attempted", "attempted", "practiced", "mastered"];
  const bestLevel: Record<number, string> = {};
  for (const r of allResults) {
    const cur = bestLevel[r.maneuverId];
    if (!cur || levelOrder.indexOf(r.competencyLevel) > levelOrder.indexOf(cur)) {
      bestLevel[r.maneuverId] = r.competencyLevel;
    }
  }

  const masteredCount = Object.values(bestLevel).filter(l => l === "mastered").length;

  // Practice counts per maneuver (by name, case-insensitive)
  const practiceByName: Record<string, number> = {};
  for (const r of allResults) {
    const name = maneuverNames[r.maneuverId];
    if (name && r.competencyLevel !== "not_attempted") {
      practiceByName[name] = (practiceByName[name] ?? 0) + 1;
    }
  }

  // Count roundabouts and hill starts by matching on name substrings
  const roundaboutCount = Object.entries(practiceByName)
    .filter(([n]) => n.includes("roundabout"))
    .reduce((s, [, c]) => s + c, 0);
  const hillStartCount = Object.entries(practiceByName)
    .filter(([n]) => n.includes("hill"))
    .reduce((s, [, c]) => s + c, 0);
  const parkingCount = Object.entries(practiceByName)
    .filter(([n]) => n.includes("park"))
    .reduce((s, [, c]) => s + c, 0);

  // ── Evaluate candidates ────────────────────────────────────────────────────
  const candidates: string[] = [];

  if (assessments.length >= 1) candidates.push("first_lesson");
  if (totalHours >= 10) candidates.push("hours_10");
  if (totalHours >= 25) candidates.push("hours_25");
  if (totalHours >= 50) candidates.push("hours_50");
  if (totalHours >= 75) candidates.push("hours_75");
  if (totalHours >= 100) candidates.push("hours_100");
  if (masteredCount >= 1) candidates.push("first_maneuver_mastered");
  if (masteredCount >= 5) candidates.push("maneuvers_5");
  if (masteredCount >= 10) candidates.push("maneuvers_10");
  if (masteredCount >= 20) candidates.push("maneuvers_20");
  if (totalManeuvers > 0 && masteredCount >= totalManeuvers) candidates.push("all_maneuvers");
  if (roundaboutCount >= 10) candidates.push("roundabouts_10");
  if (hillStartCount >= 20) candidates.push("hill_starts_20");
  if (parkingCount >= 10) candidates.push("parking_10");

  // ── Insert newly earned milestones ────────────────────────────────────────
  const newlyEarned: string[] = [];
  for (const milestoneId of candidates) {
    if (!earned.has(milestoneId)) {
      await db
        .insert(studentMilestonesTable)
        .values({ studentId, milestoneId, earnedAt: new Date() })
        .onConflictDoNothing();
      newlyEarned.push(milestoneId);
    }
  }

  return newlyEarned;
}
