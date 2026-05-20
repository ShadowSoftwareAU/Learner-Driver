import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

export async function logAudit(entry: { actorId: number; action: string; resourceType: string; resourceId?: number; studentId?: number; metadata?: string }) {
  try {
    await db.insert(auditLogsTable).values({
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      studentId: entry.studentId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (e) {
    // non-fatal
  }
}

router.get("/audit", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
  const studentId = req.query.studentId ? parseInt(req.query.studentId as string, 10) : undefined;

  let query = db.select({
    id: auditLogsTable.id,
    actorId: auditLogsTable.actorId,
    actorName: usersTable.name,
    action: auditLogsTable.action,
    resourceType: auditLogsTable.resourceType,
    resourceId: auditLogsTable.resourceId,
    studentId: auditLogsTable.studentId,
    metadata: auditLogsTable.metadata,
    createdAt: auditLogsTable.createdAt,
  })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.actorId, usersTable.id));

  const rows = studentId
    ? await (query.where(eq(auditLogsTable.studentId, studentId)) as any).orderBy(desc(auditLogsTable.createdAt)).limit(limit)
    : await (query as any).orderBy(desc(auditLogsTable.createdAt)).limit(limit);

  res.json(rows);
});

export default router;
