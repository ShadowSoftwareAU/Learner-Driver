import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, termsAcceptancesTable } from "@workspace/db";

const router = Router();

const CURRENT_TERMS_VERSION = "1.0";

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = auth.userId;
  next();
}

async function getDbUser(clerkId: string) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return rows[0] ?? null;
}

/**
 * GET /terms/status
 * Returns whether the authenticated user has accepted the current terms version.
 */
router.get("/terms/status", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getDbUser(req.clerkUserId);
  if (!user) {
    res.json({ accepted: false, version: CURRENT_TERMS_VERSION });
    return;
  }

  const rows = await db
    .select()
    .from(termsAcceptancesTable)
    .where(eq(termsAcceptancesTable.userId, user.id))
    .limit(1);

  if (rows.length === 0) {
    res.json({ accepted: false, version: CURRENT_TERMS_VERSION, acceptedAt: null });
    return;
  }

  const acceptance = rows[0];
  res.json({
    accepted: acceptance.version === CURRENT_TERMS_VERSION,
    version: CURRENT_TERMS_VERSION,
    acceptedAt: acceptance.acceptedAt,
  });
});

/**
 * POST /terms/accept
 * Records acceptance of the current terms version for the authenticated user.
 */
router.post("/terms/accept", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const user = await getDbUser(req.clerkUserId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existing = await db
    .select()
    .from(termsAcceptancesTable)
    .where(eq(termsAcceptancesTable.userId, user.id))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(termsAcceptancesTable)
      .set({ version: CURRENT_TERMS_VERSION, acceptedAt: new Date() })
      .where(eq(termsAcceptancesTable.userId, user.id))
      .returning();
    res.json({ accepted: true, version: updated.version, acceptedAt: updated.acceptedAt });
    return;
  }

  const [created] = await db
    .insert(termsAcceptancesTable)
    .values({ userId: user.id, version: CURRENT_TERMS_VERSION })
    .returning();

  req.log.info({ userId: user.id }, "Terms accepted");
  res.status(201).json({ accepted: true, version: created.version, acceptedAt: created.acceptedAt });
});

export default router;
