import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  instructorId: integer("instructor_id"), // null until claimed
  // Tenant scoping
  schoolId: integer("school_id"),
  requestedDate: text("requested_date").notNull(), // YYYY-MM-DD
  requestedTime: text("requested_time").notNull(), // HH:mm
  durationMinutes: integer("duration_minutes").notNull().default(60),
  transmissionType: text("transmission_type").notNull().default("auto"), // auto | manual | either
  suburb: text("suburb").notNull(),
  postcode: text("postcode").notNull(),
  // status includes no_show for attendance tracking
  status: text("status").notNull().default("pending"), // pending | claimed | confirmed | completed | cancelled | no_show
  carType: text("car_type").notNull().default("trainer_car"), // learner_car | trainer_car
  trainingCategory: text("training_category").notNull().default("car_learner"), // car_learner | car_probationary | q_ride_re | q_ride_r | mr | hr | hc | mc
  studentNotes: text("student_notes"),
  instructorNotes: text("instructor_notes"),
  broadcastCount: integer("broadcast_count").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  // Cancellation tracking
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledByUserId: integer("cancelled_by_user_id"),
  // No-show tracking
  noShowMarkedAt: timestamp("no_show_marked_at", { withTimezone: true }),
  noShowMarkedByUserId: integer("no_show_marked_by_user_id"),
  // Generic reason for status changes
  statusReason: text("status_reason"),
  // Payment status — set at booking creation based on student billing type
  paymentStatus: text("payment_status").notNull().default("not_applicable"),
  // not_applicable (free/no rate) | wallet_deducted | pending_invoice (NDIS/post-pay)
  // Calendar approval workflow
  changeRequestedByUserId: integer("change_requested_by_user_id"),
  changeRequestStatus: text("change_request_status"), // pending | approved | denied | none
  requiresSchoolApproval: boolean("requires_school_approval").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookingBroadcastsTable = pgTable("booking_broadcasts", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }).notNull().defaultNow(),
  notificationType: text("notification_type").notNull().default("email"),
  status: text("status").notNull().default("sent"), // sent | viewed | declined
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  // Tenant scoping
  schoolId: integer("school_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  isRead: boolean("is_read").notNull().default(false),
  // Multi-channel delivery tracking
  channel: text("channel").notNull().default("in_app"), // in_app | email | push | sms
  deliveryStatus: text("delivery_status").notNull().default("pending"), // pending | sent | failed | suppressed | quarantined | read
  deliveryProvider: text("delivery_provider"),
  deliveryAttemptedAt: timestamp("delivery_attempted_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  priority: text("priority").notNull().default("normal"), // normal | high | urgent
  metadataJson: text("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true, createdAt: true, updatedAt: true,
  claimedAt: true, confirmedAt: true, instructorId: true,
  cancelledAt: true, noShowMarkedAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
