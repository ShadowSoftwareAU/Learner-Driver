import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instructorsTable = pgTable("instructors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  qualifications: text("qualifications"),
  // School relationship flags
  // true = sole trader/independent; false = managed by a driving school
  isIndependent: boolean("is_independent").notNull().default(true),
  // Primary school affiliation (when not independent)
  defaultSchoolId: integer("default_school_id"),
  // When false + school-managed: cannot create/cancel bookings unilaterally
  canSelfManageCalendar: boolean("can_self_manage_calendar").notNull().default(true),
  // Safeguarding notes — classification: restricted
  safeguardingNotes: text("safeguarding_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstructorSchema = createInsertSchema(instructorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstructor = z.infer<typeof insertInstructorSchema>;
export type Instructor = typeof instructorsTable.$inferSelect;
