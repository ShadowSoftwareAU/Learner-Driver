/**
 * Notification service — single entry point for all notification delivery.
 * Respects user preferences before dispatching to each channel.
 *
 * Usage:
 *   await sendNotification({ userId, email, payload, schoolId })
 */
import { db, notificationPreferencesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendInApp } from "./inAppChannel";
import { sendEmail } from "./emailChannel";
import { logger } from "../logger";

export type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  relatedId?: number;
  relatedType?: string;
  priority?: "normal" | "high" | "urgent";
};

export type SendOptions = {
  userId: number;
  email?: string;
  payload: NotificationPayload;
  schoolId?: number | null;
  channels?: Array<"in_app" | "email" | "push">;
};

async function getPreferences(userId: number) {
  const [prefs] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId));
  // Return defaults if no preferences row exists yet
  return prefs ?? {
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    bookingEmails: true,
    bookingPush: true,
    safeguardingAlerts: true,
    marketingEnabled: false,
  };
}

function shouldSendEmail(prefs: Awaited<ReturnType<typeof getPreferences>>, type: string): boolean {
  if (!prefs.emailEnabled) return false;
  if (type.startsWith("booking_") && !prefs.bookingEmails) return false;
  return true;
}

export async function sendNotification(opts: SendOptions): Promise<void> {
  const { userId, email, payload, schoolId, channels } = opts;
  const prefs = await getPreferences(userId);

  const requested = channels ?? ["in_app", "email"];

  try {
    if (requested.includes("in_app") && prefs.inAppEnabled) {
      await sendInApp(userId, payload, schoolId);
    }

    if (requested.includes("email") && email && shouldSendEmail(prefs, payload.type)) {
      await sendEmail(userId, email, payload, schoolId);
    }

    // push: placeholder — push_tokens table is ready, actual send deferred to post-Phase-2
  } catch (err) {
    logger.error({ event: "notification_delivery_error", userId, type: payload.type, err });
  }
}

/**
 * Send a safety/safeguarding alert to all super_admin users.
 * Called by moderation service for critical flags.
 */
export async function alertSuperAdmins(payload: NotificationPayload): Promise<void> {
  const superAdmins = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"));

  for (const admin of superAdmins) {
    await sendNotification({
      userId: admin.id,
      email: admin.email,
      payload: { ...payload, priority: "urgent" },
    }).catch(err => logger.error({ event: "super_admin_alert_error", adminId: admin.id, err }));
  }
}
