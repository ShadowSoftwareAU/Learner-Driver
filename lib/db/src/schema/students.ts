import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique(),
  createdByInstructorId: integer("created_by_instructor_id"),
  // Tenant scoping
  schoolId: integer("school_id"),
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
  instructorHours: real("instructor_hours").notNull().default(0),
  supervisedHours: real("supervised_hours").notNull().default(0),
  region: text("region"),
  state: text("state"),
  country: text("country").default("AU"),
  status: text("status").notNull().default("active"),
  // Medical and allergy data — encrypted at rest (AES-256-GCM via crypto.ts)
  // classification: restricted — only instructor/school_admin/super_admin may read
  medicalConditionsEncrypted: text("medical_conditions_encrypted"),
  allergiesEncrypted: text("allergies_encrypted"),
  // Short safe preview, NOT full diagnosis detail. Example: "Medical info on file"
  medicalConditionsPreview: text("medical_conditions_preview"),
  allergiesPreview: text("allergies_preview"),
  // Attendance tracking
  noShowCount: integer("no_show_count").notNull().default(0),
  attendanceReliabilityScore: integer("attendance_reliability_score"), // 0-100; 100 = no issues
  // Viewer linking — unique code for parent/guardian/mentor access
  viewerCode: text("viewer_code").unique(),
  viewerCodeIssuedAt: timestamp("viewer_code_issued_at", { withTimezone: true }),
  // Data classification label — default restricted for student PII
  dataClassification: text("data_classification").notNull().default("restricted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
