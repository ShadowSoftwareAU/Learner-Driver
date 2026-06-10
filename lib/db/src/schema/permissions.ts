import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Booking change requests — school-managed instructors cannot cancel/reschedule unilaterally
export const bookingChangeRequestsTable = pgTable("booking_change_requests", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  schoolId: integer("school_id"),
  requestedByUserId: integer("requested_by_user_id").notNull(),
  requestType: text("request_type").notNull(), // reschedule | cancel | availability_override
  requestedPayloadJson: jsonb("requested_payload_json"),
  status: text("status").notNull().default("pending"), // pending | approved | denied
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Optional explicit per-instructor calendar permission overrides within a school
export const calendarPermissionsTable = pgTable("calendar_permissions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  canViewOwnSchedule: boolean("can_view_own_schedule").notNull().default(true),
  canRequestChanges: boolean("can_request_changes").notNull().default(true),
  canMarkAvailability: boolean("can_mark_availability").notNull().default(true),
  canCreateAppointments: boolean("can_create_appointments").notNull().default(false),
  canCancelAppointments: boolean("can_cancel_appointments").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Demo mode reset audit trail — super_admin only
export const demoResetsTable = pgTable("demo_resets", {
  id: serial("id").primaryKey(),
  triggeredByUserId: integer("triggered_by_user_id").notNull(),
  notes: text("notes"),
  resetScope: text("reset_scope").notNull().default("full_demo"), // full_demo | bookings_only | students_only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingChangeRequestSchema = createInsertSchema(bookingChangeRequestsTable).omit({ id: true, createdAt: true });
export type InsertBookingChangeRequest = z.infer<typeof insertBookingChangeRequestSchema>;
export type BookingChangeRequest = typeof bookingChangeRequestsTable.$inferSelect;

export const insertDemoResetSchema = createInsertSchema(demoResetsTable).omit({ id: true, createdAt: true });
export type InsertDemoReset = z.infer<typeof insertDemoResetSchema>;
export type DemoReset = typeof demoResetsTable.$inferSelect;
