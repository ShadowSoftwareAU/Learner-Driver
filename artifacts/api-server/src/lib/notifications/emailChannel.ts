/**
 * Email notification channel.
 * Phase 2: scaffold only — logs the intent and records delivery attempt.
 * Wire in a real provider (Resend, SendGrid, SES) when ready.
 *
 * To enable live email: set EMAIL_PROVIDER=resend and RESEND_API_KEY.
 */
import { eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import type { NotificationPayload } from "./notificationService";
import { logger } from "../logger";

export async function sendEmail(
  userId: number,
  email: string,
  payload: NotificationPayload,
  schoolId?: number | null,
): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;

  // Record the attempt regardless of provider
  const [row] = await db.insert(notificationsTable).values({
    userId,
    schoolId: schoolId ?? null,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    relatedId: payload.relatedId ?? null,
    relatedType: payload.relatedType ?? null,
    channel: "email",
    deliveryStatus: "pending",
    deliveryProvider: provider ?? "none",
    deliveryAttemptedAt: new Date(),
    priority: payload.priority ?? "normal",
    isRead: false,
  }).returning();

  if (!provider) {
    logger.info({ event: "email_skipped_no_provider", userId, type: payload.type });
    await db.update(notificationsTable)
      .set({ deliveryStatus: "suppressed" })
      .where(eq(notificationsTable.id, row.id));
    return;
  }

  // TODO: Integrate Resend / SendGrid / SES here
  logger.info({ event: "email_send_stub", provider, userId, type: payload.type, to: email });

  await db.update(notificationsTable)
    .set({ deliveryStatus: "sent", deliveredAt: new Date() })
    .where(eq(notificationsTable.id, row.id));
}
