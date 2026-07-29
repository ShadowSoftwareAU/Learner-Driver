import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

function genLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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
  trainingCategories: jsonb("training_categories").$type<string[]>().default([]),
  // State/territory where this instructor primarily operates
  state: text("state"),
  // School relationship flags
  // true = sole trader/independent; false = managed by a driving school
  isIndependent: boolean("is_independent").notNull().default(true),
  // Unique invite/link code used for hybrid school-to-instructor invitations (6-char alphanumeric, auto-generated).
  // Column + unique constraint applied via SQL migration; $defaultFn generates codes for new rows at the ORM layer.
  uniqueLinkCode: text("unique_link_code").unique().$defaultFn(genLinkCode),
  // Primary school affiliation (when not independent)
  defaultSchoolId: integer("default_school_id"),
  // When false + school-managed: cannot create/cancel bookings unilaterally
  canSelfManageCalendar: boolean("can_self_manage_calendar").notNull().default(true),
  // Hourly rate in Australian cents (e.g. 8500 = $85.00)
  hourlyRateCents: integer("hourly_rate_cents"),
  // ADTA membership number — optional, not enforced; future integration with ADTA database
  adtaNumber: text("adta_number"),
  // Safeguarding notes — classification: restricted
  safeguardingNotes: text("safeguarding_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstructorSchema = createInsertSchema(instructorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstructor = z.infer<typeof insertInstructorSchema>;
export type Instructor = typeof instructorsTable.$inferSelect;
