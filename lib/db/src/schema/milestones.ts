import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentMilestonesTable = pgTable("student_milestones", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  milestoneId: text("milestone_id").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.studentId, t.milestoneId),
}));

export const insertStudentMilestoneSchema = createInsertSchema(studentMilestonesTable).omit({ id: true });
export type InsertStudentMilestone = z.infer<typeof insertStudentMilestoneSchema>;
export type StudentMilestone = typeof studentMilestonesTable.$inferSelect;
