import { pgTable, text, serial, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Root tenant entity — one driving school = one tenant
export const drivingSchoolsTable = pgTable("driving_schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  abn: text("abn"),
  logoPath: text("logo_path"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  contractOwnerUserId: integer("contract_owner_user_id"),
  billingContactName: text("billing_contact_name"),
  billingContactEmail: text("billing_contact_email"),
  billingContactPhone: text("billing_contact_phone"),
  status: text("status").notNull().default("active"), // active | suspended | cancelled
  seatLimit: integer("seat_limit").notNull().default(5),
  studentCountSnapshot: integer("student_count_snapshot"),
  subscriptionTier: text("subscription_tier"), // independent | school | enterprise
  // Operating states and RSP (Registered Service Provider) compliance
  operatingStates: text("operating_states").array().default(["QLD"]),
  rspRegistrationNumber: text("rsp_registration_number"),
  rspApprovalDocPath: text("rsp_approval_doc_path"),
  // Student feedback settings
  feedbackEnabled: boolean("feedback_enabled").notNull().default(true),
  feedbackReminderDays: integer("feedback_reminder_days").notNull().default(2),
  feedbackShareWithMentor: boolean("feedback_share_with_mentor").notNull().default(false),
  mentorGroupEmail: text("mentor_group_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Many-to-many: instructors can contract with multiple schools
export const schoolInstructorsTable = pgTable("school_instructors", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  roleWithinSchool: text("role_within_school").notNull().default("instructor"), // instructor | school_admin
  isPrimary: boolean("is_primary").notNull().default(false),
  status: text("status").notNull().default("active"), // active | inactive | pending
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => [
  unique().on(t.schoolId, t.instructorId),
]);

export const insertDrivingSchoolSchema = createInsertSchema(drivingSchoolsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDrivingSchool = z.infer<typeof insertDrivingSchoolSchema>;
export type DrivingSchool = typeof drivingSchoolsTable.$inferSelect;

export const insertSchoolInstructorSchema = createInsertSchema(schoolInstructorsTable).omit({ id: true, joinedAt: true });
export type InsertSchoolInstructor = z.infer<typeof insertSchoolInstructorSchema>;
export type SchoolInstructor = typeof schoolInstructorsTable.$inferSelect;
