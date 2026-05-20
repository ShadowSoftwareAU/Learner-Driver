import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  instructorId: integer("instructor_id"), // null until claimed
  requestedDate: text("requested_date").notNull(), // YYYY-MM-DD
  requestedTime: text("requested_time").notNull(), // HH:mm
  durationMinutes: integer("duration_minutes").notNull().default(60),
  transmissionType: text("transmission_type").notNull().default("auto"), // auto | manual | either
  suburb: text("suburb").notNull(),
  postcode: text("postcode").notNull(),
  status: text("status").notNull().default("pending"), // pending | claimed | confirmed | completed | cancelled
  studentNotes: text("student_notes"),
  instructorNotes: text("instructor_notes"),
  broadcastCount: integer("broadcast_count").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
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
  type: text("type").notNull(), // booking_request | booking_claimed | booking_confirmed | booking_cancelled | lesson_reminder
  title: text("title").notNull(),
  body: text("body").notNull(),
  relatedId: integer("related_id"), // booking_id or assessment_id
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true, claimedAt: true, confirmedAt: true, instructorId: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
