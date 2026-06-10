import { Router } from "express";
import { db, toiletRatingsTable } from "@workspace/db";
import { eq, and, avg, count, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "./users";
import { getAuth } from "@clerk/express";

const router = Router();

const RateBodySchema = z.object({
  cleanliness: z.number().int().min(1).max(5),
  comment: z.string().max(200).optional(),
});

async function getToiletSummary(osmNodeId: number, clerkUserId: string) {
  const [agg] = await db
    .select({
      avgCleanliness: sql<string>`ROUND(AVG(${toiletRatingsTable.cleanliness})::numeric, 1)`,
      totalRatings: count(toiletRatingsTable.id),
    })
    .from(toiletRatingsTable)
    .where(eq(toiletRatingsTable.osmNodeId, osmNodeId));

  const [mine] = await db
    .select({ cleanliness: toiletRatingsTable.cleanliness, comment: toiletRatingsTable.comment })
    .from(toiletRatingsTable)
    .where(and(eq(toiletRatingsTable.osmNodeId, osmNodeId), eq(toiletRatingsTable.userId, clerkUserId)))
    .limit(1);

  return {
    osmNodeId,
    avgCleanliness: agg?.avgCleanliness ? parseFloat(agg.avgCleanliness) : null,
    totalRatings: Number(agg?.totalRatings ?? 0),
    myRating: mine ? { cleanliness: mine.cleanliness, comment: mine.comment ?? null } : null,
  };
}

router.get("/toilets/:osmId/summary", requireAuth, async (req: any, res): Promise<void> => {
  const osmId = Number(req.params.osmId);
  if (!Number.isFinite(osmId)) { res.status(400).json({ error: "Invalid osmId" }); return; }

  const summary = await getToiletSummary(osmId, req.clerkUserId);
  res.json(summary);
});

router.post("/toilets/:osmId/rate", requireAuth, async (req: any, res): Promise<void> => {
  const osmId = Number(req.params.osmId);
  if (!Number.isFinite(osmId)) { res.status(400).json({ error: "Invalid osmId" }); return; }

  const parsed = RateBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { cleanliness, comment } = parsed.data;

  await db
    .insert(toiletRatingsTable)
    .values({ osmNodeId: osmId, userId: req.clerkUserId, cleanliness, comment })
    .onConflictDoUpdate({
      target: [toiletRatingsTable.osmNodeId, toiletRatingsTable.userId],
      set: { cleanliness, comment: comment ?? null, updatedAt: new Date() },
    });

  const summary = await getToiletSummary(osmId, req.clerkUserId);
  res.json(summary);
});

export default router;
