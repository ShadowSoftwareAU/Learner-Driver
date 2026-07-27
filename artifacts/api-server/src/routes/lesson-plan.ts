import { Router } from "express";
import { eq, inArray, sql, and } from "drizzle-orm";
import {
  db,
  maneuversTable,
  maneuverResultsTable,
  assessmentsTable,
  lessonTypesTable,
  maneuverLessonTypesTable,
} from "@workspace/db";
import { requireAuth } from "./users";

const router = Router();

const COMPETENCY_SCORE: Record<string, number> = {
  not_attempted: 4,
  attempted: 2,
  practiced: 1,
  mastered: 0,
};

const COMPETENCY_ORDER = ["mastered", "practiced", "attempted", "not_attempted"];

router.get("/students/:id/lesson-plan", requireAuth, async (req: any, res): Promise<void> => {
  const studentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!studentId) { res.status(400).json({ error: "Invalid student id" }); return; }

  // 1. Get instructor-performed assessments only — supervised sessions do not
  //    count toward the lesson plan (they log hours but don't assess skills
  //    to the QSAFE standard required by a licensed instructor).
  const assessments = await db
    .select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(
      and(
        eq(assessmentsTable.studentId, studentId),
        eq(assessmentsTable.performedByRole, "instructor"),
      )
    );

  const assessmentIds = assessments.map((a) => a.id);

  // 2. Get all maneuver results — take best level per maneuver across instructor assessments
  const allResults: { maneuverId: number; competencyLevel: string }[] =
    assessmentIds.length > 0
      ? await db
          .select({
            maneuverId: maneuverResultsTable.maneuverId,
            competencyLevel: maneuverResultsTable.competencyLevel,
          })
          .from(maneuverResultsTable)
          .where(inArray(maneuverResultsTable.assessmentId, assessmentIds))
      : [];

  // Aggregate: best competency level per maneuver (lowest score = more mastered)
  const bestByManeuver = new Map<number, string>();
  for (const r of allResults) {
    const current = bestByManeuver.get(r.maneuverId);
    if (!current) {
      bestByManeuver.set(r.maneuverId, r.competencyLevel);
    } else {
      // Keep the "better" (more mastered) level
      const currentIdx = COMPETENCY_ORDER.indexOf(current);
      const newIdx = COMPETENCY_ORDER.indexOf(r.competencyLevel);
      if (newIdx < currentIdx) {
        bestByManeuver.set(r.maneuverId, r.competencyLevel);
      }
    }
  }

  // 3. Fetch all maneuvers
  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);

  // 4. Fetch all lesson types
  const lessonTypes = await db.select().from(lessonTypesTable).orderBy(lessonTypesTable.sortOrder);

  // 5. Fetch maneuver → lesson type mappings
  const mappings = await db
    .select({
      maneuverId: maneuverLessonTypesTable.maneuverId,
      lessonTypeId: maneuverLessonTypesTable.lessonTypeId,
    })
    .from(maneuverLessonTypesTable);

  // Build reverse map: lessonTypeId → maneuverIds
  const lessonToManeuvers = new Map<number, number[]>();
  for (const m of mappings) {
    if (!lessonToManeuvers.has(m.lessonTypeId)) lessonToManeuvers.set(m.lessonTypeId, []);
    lessonToManeuvers.get(m.lessonTypeId)!.push(m.maneuverId);
  }

  const maneuverById = new Map(allManeuvers.map((m) => [m.id, m]));

  // 6. Score each lesson type
  const focusAreas = lessonTypes
    .map((lt) => {
      const maneuverIds = lessonToManeuvers.get(lt.id) ?? [];
      let score = 0;
      const gapManeuvers: {
        id: number;
        name: string;
        category: string;
        bestLevel: string;
      }[] = [];

      for (const mid of maneuverIds) {
        const bestLevel = bestByManeuver.get(mid) ?? "not_attempted";
        const s = COMPETENCY_SCORE[bestLevel] ?? 4;
        score += s;
        if (s > 0) {
          // Not mastered — include in gap list
          const m = maneuverById.get(mid);
          if (m) {
            gapManeuvers.push({
              id: m.id,
              name: m.name,
              category: m.category,
              bestLevel,
            });
          }
        }
      }

      // Sort gap maneuvers: not_attempted first, then attempted, then practiced
      gapManeuvers.sort(
        (a, b) => COMPETENCY_SCORE[b.bestLevel] - COMPETENCY_SCORE[a.bestLevel]
      );

      const priority =
        score >= maneuverIds.length * 3
          ? "high"
          : score >= maneuverIds.length * 1.5
          ? "medium"
          : "low";

      return {
        lessonType: lt,
        priority,
        score,
        gapCount: gapManeuvers.length,
        maneuvers: gapManeuvers,
      };
    })
    .filter((fa) => fa.gapCount > 0)
    .sort((a, b) => b.score - a.score);

  // 7. Generate a natural-language summary
  const top3 = focusAreas.slice(0, 3);
  let summary = "";
  if (top3.length === 0) {
    summary = "All tracked skills are mastered. Consider booking a QSAFE pre-test assessment.";
  } else if (assessmentIds.length === 0) {
    summary = `No lessons logged yet. Recommend starting with ${top3[0]?.lessonType.name} to build foundational skills.`;
  } else {
    const names = top3.map((f) => f.lessonType.name);
    summary = `Priority areas: ${names.join(", ")}. Focus on the ${top3[0]?.gapCount} unmastered skill${top3[0]?.gapCount !== 1 ? "s" : ""} in ${top3[0]?.lessonType.name} before progressing.`;
  }

  res.json({
    lessonFocus: focusAreas.slice(0, 5),
    summary,
  });
});

export default router;
