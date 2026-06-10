import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull(),
  actorRole: text("actor_role"), // student | instructor | school_admin | super_admin | viewer | unassigned
  // Tenant scoping
  schoolId: integer("school_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: integer("resource_id"),
  studentId: integer("student_id"),
  // Legacy field — kept for compatibility; prefer metadataJson going forward
  metadata: text("metadata"),
  // Extended audit context
  result: text("result").notNull().default("success"), // success | denied | flagged | quarantined | exported
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  route: text("route"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
