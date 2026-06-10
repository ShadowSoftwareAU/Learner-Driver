import { Router } from "express";
import { db, publicToiletsTable } from "@workspace/db";
import { and, gte, lte } from "drizzle-orm";
import { requireAuth } from "./users";

const router = Router();

router.get("/toilets/gov-nearby", requireAuth, async (req: any, res): Promise<void> => {
  const { s, w, n, e } = req.query as Record<string, string>;
  const south = parseFloat(s), west = parseFloat(w), north = parseFloat(n), east = parseFloat(e);

  if ([south, west, north, east].some(v => !Number.isFinite(v))) {
    res.status(400).json({ error: "s, w, n, e must be finite numbers" });
    return;
  }

  const toilets = await db
    .select()
    .from(publicToiletsTable)
    .where(
      and(
        gte(publicToiletsTable.lat, south),
        lte(publicToiletsTable.lat, north),
        gte(publicToiletsTable.lng, west),
        lte(publicToiletsTable.lng, east),
      )
    )
    .limit(500);

  res.json(toilets);
});

export default router;
