import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const maneuversTable = pgTable("maneuvers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  assessmentType: text("assessment_type").notNull().default("tmr_learner"),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertManeuverSchema = createInsertSchema(maneuversTable).omit({ id: true });
export type InsertManeuver = z.infer<typeof insertManeuverSchema>;
export type Maneuver = typeof maneuversTable.$inferSelect;
