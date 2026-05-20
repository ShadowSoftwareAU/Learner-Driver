import { pgTable, text, serial, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { maneuversTable } from "./maneuvers";

export const lessonTypesTable = pgTable("lesson_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("car"),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const maneuverLessonTypesTable = pgTable(
  "maneuver_lesson_types",
  {
    id: serial("id").primaryKey(),
    maneuverId: integer("maneuver_id")
      .notNull()
      .references(() => maneuversTable.id, { onDelete: "cascade" }),
    lessonTypeId: integer("lesson_type_id")
      .notNull()
      .references(() => lessonTypesTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique("uq_maneuver_lesson_type").on(t.maneuverId, t.lessonTypeId)]
);

export const insertLessonTypeSchema = createInsertSchema(lessonTypesTable).omit({ id: true });
export type InsertLessonType = z.infer<typeof insertLessonTypeSchema>;
export type LessonType = typeof lessonTypesTable.$inferSelect;
export type ManeuverLessonType = typeof maneuverLessonTypesTable.$inferSelect;
