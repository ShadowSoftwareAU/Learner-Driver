import { Router } from "express";
import { db, maneuversTable } from "@workspace/db";
import { requireAuth } from "./users";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/maneuvers", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(maneuversTable).orderBy(asc(maneuversTable.sortOrder), asc(maneuversTable.name));
  res.json(rows);
});

export default router;
