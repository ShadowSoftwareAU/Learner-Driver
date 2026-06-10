import { Router } from "express";
import { db, publicToiletsTable, usersTable } from "@workspace/db";
import { and, gte, lte, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "./users";

const router = Router();

// ── GET /toilets/gov-nearby ───────────────────────────────────────────────────
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

// ── POST /toilets/submit ──────────────────────────────────────────────────────
const submitSchema = z.object({
  name: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  wheelchairAccessible: z.boolean().optional().default(false),
  paymentRequired: z.boolean().optional().default(false),
  isOpen24h: z.boolean().optional().default(false),
  babyChange: z.boolean().optional().default(false),
  notes: z.string().max(300).optional(),
  unisex: z.boolean().optional().default(true),
  male: z.boolean().optional().default(false),
  female: z.boolean().optional().default(false),
});

router.post("/toilets/submit", requireAuth, async (req: any, res): Promise<void> => {
  const parse = submitSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const d = parse.data;

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkUserId));

  const [toilet] = await db
    .insert(publicToiletsTable)
    .values({
      sourceType: "user",
      submittedByUserId: user?.id ?? null,
      name: d.name,
      lat: d.lat,
      lng: d.lng,
      male: d.male,
      female: d.female,
      unisex: d.unisex,
      wheelchairAccessible: d.wheelchairAccessible,
      isOpen24h: d.isOpen24h,
      paymentRequired: d.paymentRequired,
      mlakRequired: false,
      babyChange: d.babyChange,
      showers: false,
      drinkingWater: false,
      notes: d.notes ?? null,
    })
    .returning();

  res.status(201).json(toilet);
});

export default router;
