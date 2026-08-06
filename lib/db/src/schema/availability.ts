import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instructorAvailabilityTable = pgTable("instructor_availability", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: text("start_time").notNull(), // HH:mm
  endTime: text("end_time").notNull(), // HH:mm
  transmissionTypes: text("transmission_types").notNull().default("auto,manual"), // CSV
  isActive: boolean("is_active").notNull().default(true),
  // Hybrid model: which context this slot belongs to
  // 'independent' = shown under the instructor's own business
  // 'school' = only visible/bookable via the linked school admin
  contextType: text("context_type").notNull().default("independent"), // 'independent' | 'school'
  // Set when contextType = 'school' — references users.id of the school admin who owns this slot
  schoolAdminId: integer("school_admin_id"),
  // CSV of instructorVehicles.id values available in this slot — null means any/all active vehicles
  vehicleIds: text("vehicle_ids"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAvailabilitySchema = createInsertSchema(instructorAvailabilityTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
export type InstructorAvailability = typeof instructorAvailabilityTable.$inferSelect;
