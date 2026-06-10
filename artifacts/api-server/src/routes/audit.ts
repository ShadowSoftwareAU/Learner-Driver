import { Router, Request } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { normalizeRole, isSchoolAdmin, isSuperAdmin } from "../lib/config";
import { logger } from "../lib/logger";

const router = Router();

export type AuditEntry = {
  actorId: number;
  actorRole?: string;
  schoolId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: number | null;
  studentId?: number | null;
  metadata?: string;
  result?: "success" | "denied" | "flagged" | "quarantined" | "exported";
  ipAddress?: string;
  userAgent?: string;
  route?: string;
  metadataJson?: Record<string, unknown>;
};

/**
 * Append an audit log entry non-fatally.
 * Every sensitive read or write should call this.
 */
export async function logAudit(entry: AuditEntry, req?: Request): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorId: entry.actorId,
      actorRole: entry.actorRole ?? null,
      schoolId: entry.schoolId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      studentId: entry.studentId ?? null,
      metadata: entry.metadata ?? null,
      result: entry.result ?? "success",
      ipAddress: entry.ipAddress ?? (req ? (req.headers["x-forwarded-for"] as string ?? req.socket.remoteAddress ?? null) : null),
      userAgent: entry.userAgent ?? (req ? (req.headers["user-agent"] ?? null) : null),
      route: entry.route ?? (req ? req.originalUrl : null),
      metadataJson: (entry.metadataJson ?? null) as any,
    });
  } catch (err) {
    // Non-fatal — never block the request, but always emit to structured log
    // so the event is captured even if the DB write fails (compliance fallback).
    logger.warn({ event: "audit_db_failure", entry, err }, "Audit log DB write failed — entry captured in log only");
  }
}

/**
 * Update lastActiveAt for the user on each authenticated request.
 * Called from app.ts middleware.
 */
export async function touchLastActive(userId: number): Promise<void> {
  try {
    await db.update(usersTable)
      .set({ lastActiveAt: new Date() })
      .where(eq(usersTable.id, userId));
  } catch {
    // non-fatal
  }
}

router.get("/audit", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const role = normalizeRole(user.role);

  // Only admins and super_admin can access audit logs
  if (!isSchoolAdmin(user.role) && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
  const studentId = req.query.studentId ? parseInt(req.query.studentId as string, 10) : undefined;

  const baseQuery = db.select({
    id: auditLogsTable.id,
    actorId: auditLogsTable.actorId,
    actorName: usersTable.name,
    actorRole: auditLogsTable.actorRole,
    action: auditLogsTable.action,
    resourceType: auditLogsTable.resourceType,
    resourceId: auditLogsTable.resourceId,
    studentId: auditLogsTable.studentId,
    metadata: auditLogsTable.metadata,
    result: auditLogsTable.result,
    route: auditLogsTable.route,
    createdAt: auditLogsTable.createdAt,
  })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.actorId, usersTable.id));

  const conditions = [];
  if (studentId) conditions.push(eq(auditLogsTable.studentId, studentId));
  // school_admin scoped to their school
  if (isSchoolAdmin(user.role) && !isSuperAdmin(user.role) && user.schoolId) {
    conditions.push(eq(auditLogsTable.schoolId, user.schoolId));
  }

  const rows = conditions.length > 0
    ? await (baseQuery.where(and(...conditions)) as any).orderBy(desc(auditLogsTable.createdAt)).limit(limit)
    : await (baseQuery as any).orderBy(desc(auditLogsTable.createdAt)).limit(limit);

  res.json(rows);
});

export default router;
