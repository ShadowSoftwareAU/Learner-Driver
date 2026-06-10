/**
 * In-app notification channel.
 * Inserts a notification row that the client polls/reads via /notifications.
 */
import { db, notificationsTable } from "@workspace/db";
import type { NotificationPayload } from "./notificationService";

export async function sendInApp(userId: number, payload: NotificationPayload, schoolId?: number | null): Promise<void> {
  await db.insert(notificationsTable).values({
    userId,
    schoolId: schoolId ?? null,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    relatedId: payload.relatedId ?? null,
    relatedType: payload.relatedType ?? null,
    channel: "in_app",
    deliveryStatus: "sent",
    deliveredAt: new Date(),
    priority: payload.priority ?? "normal",
    isRead: false,
  });
}
