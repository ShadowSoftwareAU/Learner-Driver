import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const handoverNotesTable = pgTable("handover_notes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  // Tenant scoping
  schoolId: integer("school_id"),
  note: text("note").notNull(),
  focusAreas: text("focus_areas"),
  // Safety flag — if true, surfaced prominently before lesson start
  isSafetyCritical: boolean("is_safety_critical").notNull().default(false),
  // Content moderation status
  contentStatus: text("content_status").notNull().default("approved"), // approved | quarantined | under_review | released
  moderationCaseId: integer("moderation_case_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHandoverNoteSchema = createInsertSchema(handoverNotesTable).omit({ id: true, createdAt: true });
export type InsertHandoverNote = z.infer<typeof insertHandoverNoteSchema>;
export type HandoverNote = typeof handoverNotesTable.$inferSelect;
