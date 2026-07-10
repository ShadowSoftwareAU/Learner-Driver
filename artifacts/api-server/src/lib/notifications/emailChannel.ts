/**
 * Email notification channel.
 * Uses Resend when EMAIL_PROVIDER=resend and RESEND_API_KEY is set.
 * Falls back gracefully (records as suppressed) when not configured.
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
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM ?? "Learner Log <noreply@learnerlog.app>";

  // Record the attempt
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

  if (!provider || !apiKey) {
    logger.info({ event: "email_skipped_no_provider", userId, type: payload.type });
    await db.update(notificationsTable)
      .set({ deliveryStatus: "suppressed" })
      .where(eq(notificationsTable.id, row.id));
    return;
  }

  if (provider === "resend") {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      const { error } = await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: payload.title,
        html: buildEmailHtml(payload),
        text: buildEmailText(payload),
      });

      if (error) {
        logger.error({ event: "email_send_failed", provider, userId, type: payload.type, error });
        await db.update(notificationsTable)
          .set({ deliveryStatus: "failed" })
          .where(eq(notificationsTable.id, row.id));
        return;
      }

      logger.info({ event: "email_sent", provider, userId, type: payload.type, to: email });
      await db.update(notificationsTable)
        .set({ deliveryStatus: "sent", deliveredAt: new Date() })
        .where(eq(notificationsTable.id, row.id));
    } catch (err) {
      logger.error({ event: "email_send_error", provider, userId, type: payload.type, err });
      await db.update(notificationsTable)
        .set({ deliveryStatus: "failed" })
        .where(eq(notificationsTable.id, row.id));
    }
    return;
  }

  // Unknown provider
  logger.warn({ event: "email_unknown_provider", provider, userId, type: payload.type });
  await db.update(notificationsTable)
    .set({ deliveryStatus: "suppressed" })
    .where(eq(notificationsTable.id, row.id));
}

/**
 * Send an email to a recipient who does NOT have a Learner Log user account
 * (e.g. a parent/guardian, a partner school's inbox, or an external group).
 * Does not touch notificationsTable (which requires a userId) — logs via the
 * shared logger instead so delivery attempts are still traceable.
 */
export async function sendExternalEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  bodyText: string,
): Promise<{ delivered: boolean }> {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM ?? "Learner Log <noreply@learnerlog.app>";

  if (!provider || !apiKey) {
    logger.info({ event: "external_email_skipped_no_provider", to, subject });
    return { delivered: false };
  }

  if (provider === "resend") {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: fromAddress,
        to,
        subject,
        html: bodyHtml,
        text: bodyText,
      });
      if (error) {
        logger.error({ event: "external_email_send_failed", provider, to, subject, error });
        return { delivered: false };
      }
      logger.info({ event: "external_email_sent", provider, to, subject });
      return { delivered: true };
    } catch (err) {
      logger.error({ event: "external_email_send_error", provider, to, subject, err });
      return { delivered: false };
    }
  }

  logger.warn({ event: "external_email_unknown_provider", provider, to, subject });
  return { delivered: false };
}

function buildEmailHtml(payload: NotificationPayload): string {
  const body = payload.body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(payload.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .header { background: #1e40af; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 18px; font-weight: 600; }
    .body { padding: 28px 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .footer { padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Learner Log</h1></div>
    <div class="body">
      <p><strong>${escapeHtml(payload.title)}</strong></p>
      <p>${body}</p>
    </div>
    <div class="footer">You received this email because you have an active instructor account on Learner Log.</div>
  </div>
</body>
</html>`;
}

function buildEmailText(payload: NotificationPayload): string {
  return `${payload.title}\n\n${payload.body}\n\n---\nLearner Log`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
