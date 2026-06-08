import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique(),
  createdByInstructorId: integer("created_by_instructor_id"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  pcycSchoolEmail: text("pcyc_school_email"),
  licenseNumber: text("license_number"),
  licenceFrontPath: text("licence_front_path"),
  licenceBackPath: text("licence_back_path"),
  headshotPath: text("headshot_path"),
  notes: text("notes"),
  totalHours: real("total_hours").notNull().default(0),
  region: text("region"),
  country: text("country").default("AU"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
