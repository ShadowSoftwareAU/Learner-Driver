import { pgTable, text, serial, timestamp, integer, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assessmentsTable = pgTable("assessments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  // Tenant scoping
  schoolId: integer("school_id"),
  lessonDate: text("lesson_date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  status: text("status").notNull().default("in_progress"),
  // Safety-critical: who controls the pedals during this lesson
  pedalOperator: text("pedal_operator").notNull().default("student"), // instructor | student | shared
  confidenceNote: text("confidence_note"),
  focusAreasNext: text("focus_areas_next"),
  routePath: jsonb("route_path"),
  // Safety flags JSON for structured safety annotations
  safetyFlagsJson: jsonb("safety_flags_json"),
  // Pre-lesson briefing acknowledgement
  preLessonBriefingAcknowledgedAt: timestamp("pre_lesson_briefing_acknowledged_at", { withTimezone: true }),
  preLessonBriefingAcknowledgedBy: integer("pre_lesson_briefing_acknowledged_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const maneuverResultsTable = pgTable("maneuver_results", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  maneuverId: integer("maneuver_id").notNull(),
  competencyLevel: text("competency_level").notNull().default("not_attempted"),
  notes: text("notes"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessmentsTable.$inferSelect;

export const insertManeuverResultSchema = createInsertSchema(maneuverResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertManeuverResult = z.infer<typeof insertManeuverResultSchema>;
export type ManeuverResult = typeof maneuverResultsTable.$inferSelect;
