import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Active viewer → student links (parent/guardian/mentor/support_worker)
export const viewerLinksTable = pgTable("viewer_links", {
  id: serial("id").primaryKey(),
  viewerUserId: integer("viewer_user_id").notNull(),
  studentId: integer("student_id").notNull(),
  schoolId: integer("school_id"),
  relationshipType: text("relationship_type"), // parent | guardian | mentor | support_worker | other
  linkStatus: text("link_status").notNull().default("active"), // active | revoked | expired
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  linkedByUserId: integer("linked_by_user_id"),
}, (t) => [
  unique().on(t.viewerUserId, t.studentId),
]);

// Traceability record for all link attempts (including failed/invalid code entries)
export const viewerLinkRequestsTable = pgTable("viewer_link_requests", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id"),
  viewerUserId: integer("viewer_user_id").notNull(),
  enteredCode: text("entered_code").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | expired
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedByUserId: integer("resolved_by_user_id"),
  failureReason: text("failure_reason"),
});

export const insertViewerLinkSchema = createInsertSchema(viewerLinksTable).omit({ id: true, linkedAt: true });
export type InsertViewerLink = z.infer<typeof insertViewerLinkSchema>;
export type ViewerLink = typeof viewerLinksTable.$inferSelect;

export const insertViewerLinkRequestSchema = createInsertSchema(viewerLinkRequestsTable).omit({ id: true, requestedAt: true });
export type InsertViewerLinkRequest = z.infer<typeof insertViewerLinkRequestSchema>;
export type ViewerLinkRequest = typeof viewerLinkRequestsTable.$inferSelect;
