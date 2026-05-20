import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instructorZonesTable = pgTable("instructor_zones", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull(),
  suburb: text("suburb").notNull(),
  postcode: text("postcode").notNull(),
  state: text("state").notNull().default("QLD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertZoneSchema = createInsertSchema(instructorZonesTable).omit({ id: true, createdAt: true });
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type InstructorZone = typeof instructorZonesTable.$inferSelect;
