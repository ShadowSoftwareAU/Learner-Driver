/**
 * Billing routes — Stripe skeleton.
 * Phase 2: no hard payment enforcement (feature-flagged off by default).
 * Entitlement checks run but pass unless stripePaymentEnforced is true.
 *
 * Stripe customer / subscription creation is stubbed — no live API calls yet.
 * Webhook endpoint is scaffolded for future Stripe event handling.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  subscriptionsTable,
  featureEntitlementsTable,
  auditLogsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { featureFlags, PLAN_CODES, PRICING, FEATURE_KEYS } from "../lib/config";
import { logger } from "../lib/logger";

const router = Router();

// ─── Get my subscription ──────────────────────────────────────────────────────

router.get("/billing/subscription", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  const scopeConditions = user.schoolId
    ? and(eq(subscriptionsTable.schoolId as any, user.schoolId))
    : eq(subscriptionsTable.userId as any, user.id);

  const [subscription] = await db.select().from(subscriptionsTable).where(
    user.schoolId
      ? eq(subscriptionsTable.schoolId as any, user.schoolId)
      : eq(subscriptionsTable.userId as any, user.id)
  ).limit(1);

  if (!subscription) {
    // Return a synthetic "free" plan when no subscription row exists
    res.json({
      planCode: PLAN_CODES.FREE,
      status: "active",
      billingProvider: "none",
      seatCount: null,
      renewalAt: null,
      pricingInfo: {
        viewer: PRICING.VIEWER_MONTHLY,
        independentInstructor: PRICING.INDEPENDENT_INSTRUCTOR_MONTHLY,
        schoolBase: PRICING.SCHOOL_BASE_MONTHLY,
        schoolAdditionalSeat: PRICING.SCHOOL_ADDITIONAL_SEAT_MONTHLY,
      },
      enforcementEnabled: featureFlags.stripePaymentEnforced,
    });
    return;
  }

  res.json({
    ...subscription,
    pricingInfo: {
      viewer: PRICING.VIEWER_MONTHLY,
      independentInstructor: PRICING.INDEPENDENT_INSTRUCTOR_MONTHLY,
      schoolBase: PRICING.SCHOOL_BASE_MONTHLY,
      schoolAdditionalSeat: PRICING.SCHOOL_ADDITIONAL_SEAT_MONTHLY,
    },
    enforcementEnabled: featureFlags.stripePaymentEnforced,
  });
});

// ─── Get my feature entitlements ──────────────────────────────────────────────

router.get("/billing/entitlements", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");

  const userEntitlements = await db.select().from(featureEntitlementsTable)
    .where(and(eq(featureEntitlementsTable.scopeType, "user"), eq(featureEntitlementsTable.scopeId, user.id)));

  const schoolEntitlements = user.schoolId
    ? await db.select().from(featureEntitlementsTable)
        .where(and(eq(featureEntitlementsTable.scopeType, "school"), eq(featureEntitlementsTable.scopeId, user.schoolId)))
    : [];

  // Build merged map: school entitlement overrides user if present
  const allKeys = Object.values(FEATURE_KEYS);
  const merged = allKeys.map(key => {
    const school = schoolEntitlements.find(e => e.featureKey === key);
    const userEnt = userEntitlements.find(e => e.featureKey === key);
    const entitlement = school ?? userEnt;
    // When enforcement is off, gated features default to enabled
    const enabled = featureFlags.stripePaymentEnforced
      ? (entitlement?.isEnabled ?? false)
      : true;
    return { featureKey: key, isEnabled: enabled, source: entitlement?.source ?? "default" };
  });

  res.json(merged);
});

// ─── Create/update subscription (stub) ───────────────────────────────────────

router.post("/billing/subscription", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { planCode, schoolId } = req.body as { planCode: string; schoolId?: number };

  const validPlans = Object.values(PLAN_CODES);
  if (!validPlans.includes(planCode as any)) {
    res.status(400).json({ error: `Invalid planCode. Valid: ${validPlans.join(", ")}` });
    return;
  }

  const existingCondition = schoolId
    ? eq(subscriptionsTable.schoolId as any, schoolId)
    : eq(subscriptionsTable.userId as any, user.id);

  const [existing] = await db.select().from(subscriptionsTable).where(existingCondition).limit(1);

  if (existing) {
    const [updated] = await db.update(subscriptionsTable)
      .set({ planCode, status: "active" })
      .where(eq(subscriptionsTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db.insert(subscriptionsTable).values({
    userId: schoolId ? null : user.id,
    schoolId: schoolId ?? null,
    planCode,
    status: "inactive", // stays inactive until Stripe confirms
    billingProvider: "stripe",
  }).returning();

  await db.insert(auditLogsTable).values({
    actorId: user.id,
    action: "subscription_created",
    resourceType: "subscription",
    resourceId: created.id,
    actorRole: user.role,
    result: "success",
    route: "/billing/subscription",
    metadataJson: { planCode } as any,
  }).catch(() => null);

  res.status(201).json(created);
});

// ─── Stripe webhook (stub) ────────────────────────────────────────────────────
// Signature verification deferred until Stripe keys are configured.

router.post("/billing/webhook", async (req: any, res): Promise<void> => {
  const eventType = req.body?.type as string | undefined;
  logger.info({ event: "stripe_webhook_received", eventType });

  // TODO: verify Stripe-Signature header when STRIPE_WEBHOOK_SECRET is set
  // const sig = req.headers["stripe-signature"];

  if (eventType === "customer.subscription.updated" || eventType === "customer.subscription.deleted") {
    // Update subscription status when implemented
    logger.info({ event: "stripe_subscription_event", eventType });
  }

  res.json({ received: true });
});

export default router;
