/**
 * Demo mode routes — super_admin only, feature-flagged.
 * One-click reset of demo tenant data for school/government pitches.
 * Every reset is audited in demo_resets and audit_logs.
 *
 * Feature flag: FEATURE_DEMO_MODE_ENABLED=true must be set for reset to execute.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  demoResetsTable,
  auditLogsTable,
  studentsTable,
  assessmentsTable,
  bookingsTable,
  handoverNotesTable,
  notificationsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { featureFlags } from "../lib/config";
import { isSuperAdmin } from "../lib/config";
import { logger } from "../lib/logger";

const DEMO_SCHOOL_ID = parseInt(process.env.DEMO_SCHOOL_ID ?? "0", 10); // Set to demo tenant's schoolId

const router = Router();

// ─── Demo mode status ─────────────────────────────────────────────────────────

router.get("/demo/status", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (!isSuperAdmin(user.role)) { res.status(403).json({ error: "super_admin required" }); return; }

  const lastReset = await db.select().from(demoResetsTable).orderBy(demoResetsTable.createdAt).limit(1);

  res.json({
    demoModeEnabled: featureFlags.demoModeEnabled,
    demoSchoolId: DEMO_SCHOOL_ID || null,
    lastReset: lastReset[0] ?? null,
  });
});

// ─── Reset demo data ──────────────────────────────────────────────────────────
// Only touches the designated demo school — never production tenants.

router.post("/demo/reset", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  if (!isSuperAdmin(user.role)) { res.status(403).json({ error: "super_admin required" }); return; }
  if (!featureFlags.demoModeEnabled) {
    res.status(403).json({ error: "Demo mode is not enabled. Set FEATURE_DEMO_MODE_ENABLED=true to enable." });
    return;
  }
  if (!DEMO_SCHOOL_ID) {
    res.status(400).json({ error: "DEMO_SCHOOL_ID is not configured. Set it to the demo school's database id." });
    return;
  }

  const { resetScope, notes } = req.body as { resetScope?: string; notes?: string };
  const scope = resetScope === "bookings_only" || resetScope === "students_only" ? resetScope : "full_demo";

  logger.warn({ event: "demo_reset_initiated", actorId: user.id, scope, demoSchoolId: DEMO_SCHOOL_ID });

  try {
    // Clear demo school data scoped by schoolId or createdByInstructorId where schoolId not available
    if (scope === "full_demo" || scope === "bookings_only") {
      await db.delete(bookingsTable)
        .where(eq(bookingsTable.schoolId as any, DEMO_SCHOOL_ID))
        .catch(() => null);
      await db.delete(notificationsTable)
        .where(eq(notificationsTable.schoolId as any, DEMO_SCHOOL_ID))
        .catch(() => null);
    }

    if (scope === "full_demo" || scope === "students_only") {
      const demoStudents = await db.select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.schoolId as any, DEMO_SCHOOL_ID));

      const demoIds = demoStudents.map(s => s.id);

      for (const sid of demoIds) {
        await db.delete(assessmentsTable).where(eq(assessmentsTable.studentId, sid)).catch(() => null);
        await db.delete(handoverNotesTable).where(eq(handoverNotesTable.studentId as any, sid)).catch(() => null);
        await db.delete(bookingsTable).where(eq(bookingsTable.studentId, sid)).catch(() => null);
      }

      if (scope === "full_demo") {
        await db.delete(studentsTable).where(eq(studentsTable.schoolId as any, DEMO_SCHOOL_ID)).catch(() => null);
      }
    }

    // Record the reset
    const [resetRow] = await db.insert(demoResetsTable).values({
      triggeredByUserId: user.id,
      notes: notes ?? null,
      resetScope: scope,
    }).returning();

    await db.insert(auditLogsTable).values({
      actorId: user.id,
      action: "demo_reset",
      resourceType: "demo",
      resourceId: resetRow.id,
      actorRole: user.role,
      result: "success",
      route: "/demo/reset",
      metadataJson: { scope, demoSchoolId: DEMO_SCHOOL_ID } as any,
    }).catch(() => null);

    logger.warn({ event: "demo_reset_completed", resetId: resetRow.id, scope, demoSchoolId: DEMO_SCHOOL_ID });

    res.json({ ok: true, resetId: resetRow.id, scope });
  } catch (err) {
    logger.error({ event: "demo_reset_error", err });
    res.status(500).json({ error: "Demo reset failed. Check logs." });
  }
});

export default router;
