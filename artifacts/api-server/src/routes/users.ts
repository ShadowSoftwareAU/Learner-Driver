import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, instructorsTable, studentsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { touchLastActive } from "./audit";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  // Temporary debug — remove after diagnosing 401s
  const cookieNames = (req.headers?.cookie ?? "").split(";").map((c: string) => c.trim().split("=")[0]).filter(Boolean);
  req.log.info({
    clerkUserId: userId ?? null,
    sessionId: auth?.sessionId ?? null,
    sessionStatus: (auth as any)?.sessionStatus ?? null,
    reason: userId ? null : "no_userId",
    cookieNames,
    hasSecretKey: !!(process.env.CLERK_SECRET_KEY),
    secretKeyPrefix: process.env.CLERK_SECRET_KEY?.slice(0, 8) ?? null,
  }, "requireAuth debug");
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
  // Update lastActiveAt non-fatally on each authenticated request
  touchLastActive(user.id).catch(() => {});
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
    schoolId: user.schoolId ?? null,
    sessionTimeoutMinutes: user.sessionTimeoutMinutes,
    createdAt: user.createdAt,
  });
});

router.patch("/users/me/role", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const user = await getOrCreateUser(req.clerkUserId, auth?.sessionClaims?.email as string ?? "", auth?.sessionClaims?.name as string ?? undefined);
  const { role } = req.body;
  // viewer is a valid self-assignable role (parent/guardian/mentor)
  if (!["student", "instructor", "admin", "school_admin", "viewer"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, user.id)).returning();

  const displayName = updated.name || updated.email || `User ${updated.id}`;
  const emailValue = updated.email || "";
  try {
    if (role === "instructor") {
      const existing = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, updated.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(instructorsTable).values({ userId: updated.id, fullName: displayName, email: emailValue });
        req.log.info({ userId: updated.id }, "Instructor profile created for role assignment");
      }
    } else if (role === "student") {
      const existing = await db.select().from(studentsTable).where(eq(studentsTable.userId, updated.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(studentsTable).values({ userId: updated.id, fullName: displayName, email: emailValue });
        req.log.info({ userId: updated.id }, "Student profile created for role assignment");
      }
    }
    // viewer: no additional profile row needed yet — handled when linking via viewer code
  } catch (err) {
    req.log.error({ err, userId: updated.id, role }, "Failed to create profile row for role");
    res.status(500).json({ error: "Failed to create profile" });
    return;
  }

  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    schoolId: updated.schoolId ?? null,
    createdAt: updated.createdAt,
  });
});

export { requireAuth, getOrCreateUser };
export default router;
