import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

// Get my notifications
router.get("/notifications", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const limit = Math.min(parseInt((req.query.limit as string) ?? "30", 10), 100);
  const unreadOnly = req.query.unread === "true";

  const query = unreadOnly
    ? db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false))).orderBy(desc(notificationsTable.createdAt)).limit(limit)
    : db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.id)).orderBy(desc(notificationsTable.createdAt)).limit(limit);

  const rows = await query;
  res.json(rows);
});

// Get unread count
router.get("/notifications/unread-count", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const rows = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false)));
  res.json({ count: rows.length });
});

// Mark notification as read
router.patch("/notifications/:id/read", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const user = await getOrCreateUser(req.clerkUserId, "");
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)));
  res.json({ ok: true });
});

// Mark all as read
router.post("/notifications/mark-all-read", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false)));
  res.json({ ok: true });
});

export default router;
