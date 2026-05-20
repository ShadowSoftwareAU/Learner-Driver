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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAvailabilitySchema = createInsertSchema(instructorAvailabilityTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
export type InstructorAvailability = typeof instructorAvailabilityTable.$inferSelect;
