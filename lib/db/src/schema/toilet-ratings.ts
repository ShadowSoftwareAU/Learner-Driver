import { pgTable, text, serial, timestamp, integer, bigint, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const toiletRatingsTable = pgTable("toilet_ratings", {
  id: serial("id").primaryKey(),
  osmNodeId: bigint("osm_node_id", { mode: "number" }).notNull(),
  userId: text("user_id").notNull(),
  cleanliness: integer("cleanliness").notNull(),
  comment: varchar("comment", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("toilet_ratings_osm_user_uniq").on(t.osmNodeId, t.userId),
]);

export const insertToiletRatingSchema = createInsertSchema(toiletRatingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertToiletRating = z.infer<typeof insertToiletRatingSchema>;
export type ToiletRating = typeof toiletRatingsTable.$inferSelect;
