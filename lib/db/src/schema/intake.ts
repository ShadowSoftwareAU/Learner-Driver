import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const intakeTable = pgTable("intake", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().unique(),
  priorExperience: text("prior_experience"),
  previousLessons: integer("previous_lessons"),
  previousInstructorFeedback: text("previous_instructor_feedback"),
  medicalConditions: text("medical_conditions"),
  learningGoals: text("learning_goals"),
  preferredLessonTime: text("preferred_lesson_time"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIntakeSchema = createInsertSchema(intakeTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntake = z.infer<typeof insertIntakeSchema>;
export type Intake = typeof intakeTable.$inferSelect;
