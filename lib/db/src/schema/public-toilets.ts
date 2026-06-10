import { pgTable, text, serial, timestamp, boolean, doublePrecision, index } from "drizzle-orm/pg-core";

export const publicToiletsTable = pgTable("public_toilets", {
  id: serial("id").primaryKey(),
  govId: text("gov_id").unique(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  state: text("state"),
  suburb: text("suburb"),
  address: text("address"),
  male: boolean("male").notNull().default(false),
  female: boolean("female").notNull().default(false),
  unisex: boolean("unisex").notNull().default(false),
  wheelchairAccessible: boolean("wheelchair_accessible").notNull().default(false),
  isOpen24h: boolean("is_open_24h").notNull().default(false),
  openingHours: text("opening_hours"),
  paymentRequired: boolean("payment_required").notNull().default(false),
  mlakRequired: boolean("mlak_required").notNull().default(false),
  babyChange: boolean("baby_change").notNull().default(false),
  showers: boolean("showers").notNull().default(false),
  drinkingWater: boolean("drinking_water").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("public_toilets_lat_lng_idx").on(t.lat, t.lng),
]);

export type PublicToilet = typeof publicToiletsTable.$inferSelect;
