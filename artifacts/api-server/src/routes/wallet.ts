/**
 * Guardian wallet routes — parents/guardians top up credits via Stripe Checkout
 * and use them to pay for their linked student's bookings.
 */
import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  guardianWalletsTable,
  walletTransactionsTable,
  viewerLinksTable,
  bookingsTable,
} from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";
import { getStripeClient, getStripeWebhookSecret } from "../lib/stripeClient";
import { WALLET } from "../lib/config";
import { logAudit } from "./audit";
import { logger } from "../lib/logger";

const router = Router();

async function getOrCreateWallet(viewerUserId: number) {
  const [existing] = await db.select().from(guardianWalletsTable).where(eq(guardianWalletsTable.viewerUserId, viewerUserId));
  if (existing) return existing;
  const [created] = await db.insert(guardianWalletsTable).values({ viewerUserId, balanceCents: 0 }).returning();
  return created;
}

// ─── Get my wallet ──────────────────────────────────────────────────────────

router.get("/wallet", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const wallet = await getOrCreateWallet(user.id);

  const transactions = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.viewerUserId, user.id))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(50);

  res.json({
    balanceCents: wallet.balanceCents,
    lessonPriceCents: WALLET.STANDARD_LESSON_PRICE_CENTS,
    creditPackOptionsCents: WALLET.CREDIT_PACKS_CENTS,
    transactions,
  });
});

// ─── Create a Stripe Checkout session to top up credits ──────────────────────

router.post("/wallet/checkout", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const { packCents } = req.body as { packCents: number };

  if (!WALLET.CREDIT_PACKS_CENTS.includes(packCents as any)) {
    res.status(400).json({ error: `Invalid pack. Valid options (cents): ${WALLET.CREDIT_PACKS_CENTS.join(", ")}` });
    return;
  }

  const baseUrl = (process.env.APP_BASE_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`).replace(/\/$/, "");

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            unit_amount: packCents,
            product_data: {
              name: `Learner Log credits — $${(packCents / 100).toFixed(2)}`,
              description: "Prepaid credits for driving lesson bookings",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        viewerUserId: String(user.id),
        packCents: String(packCents),
      },
      success_url: `${baseUrl}/viewer/dashboard?walletTopup=success`,
      cancel_url: `${baseUrl}/viewer/dashboard?walletTopup=cancelled`,
    });

    await getOrCreateWallet(user.id);
    await db.insert(walletTransactionsTable).values({
      viewerUserId: user.id,
      type: "topup",
      amountCents: packCents,
      stripeCheckoutSessionId: session.id,
      status: "pending",
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    logger.error({ event: "wallet_checkout_failed", err });
    res.status(502).json({ error: "Could not start checkout with Stripe" });
  }
});

// ─── Pay for a booking using wallet credits ──────────────────────────────────

router.post("/wallet/pay-booking/:bookingId", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.clerkUserId, "");
  const bookingId = parseInt(req.params.bookingId as string, 10);

  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const [link] = await db.select().from(viewerLinksTable)
    .where(and(eq(viewerLinksTable.viewerUserId, user.id), eq(viewerLinksTable.studentId, booking.studentId), eq(viewerLinksTable.linkStatus, "active")));
  if (!link) { res.status(403).json({ error: "No active viewer link for this student" }); return; }

  const [existingPayment] = await db.select().from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.bookingId, bookingId), eq(walletTransactionsTable.type, "booking_payment"), eq(walletTransactionsTable.status, "completed")));
  if (existingPayment) { res.status(409).json({ error: "This booking has already been paid for" }); return; }

  const wallet = await getOrCreateWallet(user.id);
  const price = WALLET.STANDARD_LESSON_PRICE_CENTS;
  if (wallet.balanceCents < price) {
    res.status(402).json({ error: "Insufficient credit balance", balanceCents: wallet.balanceCents, requiredCents: price });
    return;
  }

  const [updatedWallet] = await db.update(guardianWalletsTable)
    .set({ balanceCents: wallet.balanceCents - price })
    .where(eq(guardianWalletsTable.id, wallet.id))
    .returning();

  await db.insert(walletTransactionsTable).values({
    viewerUserId: user.id,
    type: "booking_payment",
    amountCents: -price,
    bookingId,
    studentId: booking.studentId,
    status: "completed",
  });

  await logAudit({ actorId: user.id, actorRole: user.role, action: "wallet_pay_booking", resourceType: "booking", resourceId: bookingId, studentId: booking.studentId }, req);

  res.json({ ok: true, balanceCents: updatedWallet.balanceCents });
});

// ─── Stripe webhook — credits the wallet once payment is confirmed ───────────
// Registered in app.ts BEFORE express.json() so req.body is the raw Buffer.

export async function handleWalletStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const viewerUserId = session.metadata?.viewerUserId ? parseInt(session.metadata.viewerUserId, 10) : null;
    const packCents = session.metadata?.packCents ? parseInt(session.metadata.packCents, 10) : null;

    if (!viewerUserId || !packCents) {
      logger.warn({ event: "wallet_webhook_missing_metadata", sessionId: session.id });
      return;
    }

    const [pendingTx] = await db.select().from(walletTransactionsTable)
      .where(and(eq(walletTransactionsTable.stripeCheckoutSessionId, session.id), eq(walletTransactionsTable.status, "pending")));

    if (!pendingTx) {
      logger.info({ event: "wallet_webhook_no_pending_tx_or_already_processed", sessionId: session.id });
      return;
    }

    const wallet = await getOrCreateWallet(viewerUserId);
    await db.update(guardianWalletsTable)
      .set({ balanceCents: wallet.balanceCents + packCents })
      .where(eq(guardianWalletsTable.id, wallet.id));

    await db.update(walletTransactionsTable)
      .set({ status: "completed", stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null })
      .where(eq(walletTransactionsTable.id, pendingTx.id));

    logger.info({ event: "wallet_credited", viewerUserId, packCents, sessionId: session.id });
  }
}

export default router;
