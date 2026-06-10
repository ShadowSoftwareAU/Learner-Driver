import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, notificationsTable, notificationPreferencesTable, pushTokensTable } from "@workspace/db";
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

// ─── Notification Preferences ────────────────────────────────────────────────

router.get("/notifications/preferences", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const [prefs] = await db.select().from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, user.id));
  // Return defaults when no row exists yet
  res.json(prefs ?? {
    userId: user.id,
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    smsEnabled: false,
    bookingEmails: true,
    bookingPush: true,
    safeguardingAlerts: true,
    marketingEnabled: false,
  });
});

router.patch("/notifications/preferences", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const allowed = ["emailEnabled", "pushEnabled", "inAppEnabled", "smsEnabled", "bookingEmails", "bookingPush", "safeguardingAlerts", "marketingEnabled"] as const;
  const updates: Partial<Record<typeof allowed[number], boolean>> = {};
  for (const key of allowed) {
    if (key in req.body && typeof req.body[key] === "boolean") {
      updates[key] = req.body[key];
    }
  }

  const [existing] = await db.select().from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, user.id));

  if (existing) {
    const [updated] = await db.update(notificationPreferencesTable)
      .set(updates)
      .where(eq(notificationPreferencesTable.userId, user.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(notificationPreferencesTable)
      .values({ userId: user.id, ...updates })
      .returning();
    res.json(created);
  }
});

// ─── Push Tokens ─────────────────────────────────────────────────────────────

router.post("/notifications/push-tokens", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { token, platform, provider, deviceLabel } = req.body as {
    token: string; platform: string; provider: string; deviceLabel?: string;
  };
  if (!token || !platform || !provider) {
    res.status(400).json({ error: "token, platform, and provider are required" }); return;
  }

  const validPlatforms = ["ios", "android", "web"];
  const validProviders = ["expo", "fcm", "apns"];
  if (!validPlatforms.includes(platform) || !validProviders.includes(provider)) {
    res.status(400).json({ error: "Invalid platform or provider" }); return;
  }

  const [existing] = await db.select().from(pushTokensTable).where(eq(pushTokensTable.token, token));
  if (existing) {
    const [updated] = await db.update(pushTokensTable)
      .set({ userId: user.id, lastSeenAt: new Date(), revokedAt: null, deviceLabel: deviceLabel ?? existing.deviceLabel })
      .where(eq(pushTokensTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db.insert(pushTokensTable).values({
    userId: user.id,
    token,
    platform,
    provider,
    deviceLabel: deviceLabel ?? null,
    lastSeenAt: new Date(),
  }).returning();
  res.status(201).json(created);
});

router.delete("/notifications/push-tokens/:id", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const id = parseInt(req.params.id as string, 10);
  await db.update(pushTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(pushTokensTable.id, id), eq(pushTokensTable.userId, user.id)));
  res.json({ ok: true });
});

export default router;
