import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const handoverNotesTable = pgTable("handover_notes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  instructorId: integer("instructor_id").notNull(),
  note: text("note").notNull(),
  focusAreas: text("focus_areas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHandoverNoteSchema = createInsertSchema(handoverNotesTable).omit({ id: true, createdAt: true });
export type InsertHandoverNote = z.infer<typeof insertHandoverNoteSchema>;
export type HandoverNote = typeof handoverNotesTable.$inferSelect;
