import { pgTable, text, serial, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instructorVehiclesTable = pgTable("instructor_vehicles", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull(),
  vehicleType: text("vehicle_type").notNull().default("car"),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  colour: text("colour"),
  rego: text("rego"),
  regoState: text("rego_state").default("QLD"),
  regoExpiry: date("rego_expiry"),
  // 'manual' | 'auto' — what transmission this vehicle has
  transmissionType: text("transmission_type").notNull().default("auto"),
  // 'dual_control' = professionally fitted dual controls; 'factory' = standard factory pedals
  controlType: text("control_type").notNull().default("dual_control"),
  isDualControl: boolean("is_dual_control").notNull().default(false),
  isOwnerOperator: boolean("is_owner_operator").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false),
  // Object storage path for the vehicle photo
  photoStorageKey: text("photo_storage_key"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceType: text("insurance_type"),
  insuranceExpiry: date("insurance_expiry"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstructorVehicleSchema = createInsertSchema(instructorVehiclesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstructorVehicle = z.infer<typeof insertInstructorVehicleSchema>;
export type InstructorVehicle = typeof instructorVehiclesTable.$inferSelect;
