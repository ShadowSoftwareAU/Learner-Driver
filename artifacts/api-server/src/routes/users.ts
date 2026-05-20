import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  next();
}

async function getOrCreateUser(clerkId: string, email: string, name?: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(usersTable).values({ clerkId, email, name: name ?? null, role: "unassigned" }).returning();
  return created;
}

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const user = await getOrCreateUser(req.clerkUserId, auth?.sessionClaims?.email as string ?? "", auth?.sessionClaims?.name as string ?? undefined);
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.patch("/users/me/role", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const user = await getOrCreateUser(req.clerkUserId, auth?.sessionClaims?.email as string ?? "", auth?.sessionClaims?.name as string ?? undefined);
  const { role } = req.body;
  if (!["student", "instructor", "admin"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, user.id)).returning();
  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    createdAt: updated.createdAt,
  });
});

export { requireAuth, getOrCreateUser };
export default router;
