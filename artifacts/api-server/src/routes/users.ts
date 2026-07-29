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
    adminSubRole: user.adminSubRole ?? null,
    schoolId: user.schoolId ?? null,
    sessionTimeoutMinutes: user.sessionTimeoutMinutes,
    createdAt: user.createdAt,
  });
});

// ─── Update own display name ──────────────────────────────────────────────────

router.patch("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { name } = req.body as { name?: string };
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "name must be at least 2 characters" });
    return;
  }
  const trimmed = name.trim();
  const [updated] = await db.update(usersTable).set({ name: trimmed }).where(eq(usersTable.id, user.id)).returning();
  res.json({
    id: updated.id,
    clerkId: updated.clerkId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    adminSubRole: updated.adminSubRole ?? null,
    schoolId: updated.schoolId ?? null,
    sessionTimeoutMinutes: updated.sessionTimeoutMinutes,
    createdAt: updated.createdAt,
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

// ─── Admin sub-role (super_admin only) ───────────────────────────────────────

router.patch("/users/:id/admin-sub-role", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "super_admin required" }); return;
  }
  const targetId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { adminSubRole } = req.body as { adminSubRole?: string | null };
  const valid = [null, "owner", "manager", "coordinator"];
  if (!valid.includes(adminSubRole ?? null)) {
    res.status(400).json({ error: "adminSubRole must be owner, manager, coordinator, or null" }); return;
  }
  await db.update(usersTable).set({ adminSubRole: adminSubRole ?? null }).where(eq(usersTable.id, targetId));
  res.json({ ok: true });
});

export { requireAuth, getOrCreateUser };
export default router;
