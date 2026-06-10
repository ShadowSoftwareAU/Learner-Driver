import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionFeedbackTable = pgTable("session_feedback", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  studentId: integer("student_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  schoolId: integer("school_id"),
  overallRating: integer("overall_rating"),
  communicationRating: integer("communication_rating"),
  safetyFocusRating: integer("safety_focus_rating"),
  lessonQualityRating: integer("lesson_quality_rating"),
  comments: text("comments"),
  wouldRecommend: boolean("would_recommend"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionFeedbackSchema = createInsertSchema(sessionFeedbackTable).omit({ id: true, createdAt: true });
export type InsertSessionFeedback = z.infer<typeof insertSessionFeedbackSchema>;
export type SessionFeedback = typeof sessionFeedbackTable.$inferSelect;

export const handoverNoteReviewsTable = pgTable("handover_note_reviews", {
  id: serial("id").primaryKey(),
  handoverNoteId: integer("handover_note_id").notNull(),
  reviewerUserId: integer("reviewer_user_id").notNull(),
  schoolId: integer("school_id"),
  verdict: text("verdict").notNull(),
  reviewComment: text("review_comment"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHandoverNoteReviewSchema = createInsertSchema(handoverNoteReviewsTable).omit({ id: true, reviewedAt: true });
export type InsertHandoverNoteReview = z.infer<typeof insertHandoverNoteReviewSchema>;
export type HandoverNoteReview = typeof handoverNoteReviewsTable.$inferSelect;
