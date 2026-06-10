import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Core safeguarding case — created when content filter fires
// Retention: minimum 7 years; do NOT hard-delete
export const moderationCasesTable = pgTable("moderation_cases", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id"),
  reportedBySystem: boolean("reported_by_system").notNull().default(true),
  status: text("status").notNull().default("open"), // open | under_review | released | escalated | closed
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  contentType: text("content_type").notNull(), // handover_note | assessment_note | booking_note | message | other
  contentId: integer("content_id"),
  actorUserId: integer("actor_user_id"),
  targetUserId: integer("target_user_id"),
  studentId: integer("student_id"),
  ruleHitsJson: jsonb("rule_hits_json"), // [{rule: string, excerpt: string}]
  rawExcerpt: text("raw_excerpt"),
  reviewOutcome: text("review_outcome"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  legalHold: boolean("legal_hold").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Immutable event log per moderation case — never update, only append
export const moderatedContentEventsTable = pgTable("moderated_content_events", {
  id: serial("id").primaryKey(),
  moderationCaseId: integer("moderation_case_id").notNull(),
  eventType: text("event_type").notNull(), // detected | quarantined | notified | reviewed | released | escalated | exported
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin-controlled content filter rule configuration
export const contentFilterConfigsTable = pgTable("content_filter_configs", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  configJson: jsonb("config_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Evidence export audit — tightly restricted, super_admin only
export const lawEnforcementExportsTable = pgTable("law_enforcement_exports", {
  id: serial("id").primaryKey(),
  requestedByUserId: integer("requested_by_user_id").notNull(),
  approvedByUserId: integer("approved_by_user_id"),
  schoolId: integer("school_id"),
  caseIdsJson: jsonb("case_ids_json").notNull(),
  reason: text("reason").notNull(),
  exportPath: text("export_path"),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertModerationCaseSchema = createInsertSchema(moderationCasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertModerationCase = z.infer<typeof insertModerationCaseSchema>;
export type ModerationCase = typeof moderationCasesTable.$inferSelect;

export const insertModeratedContentEventSchema = createInsertSchema(moderatedContentEventsTable).omit({ id: true, createdAt: true });
export type InsertModeratedContentEvent = z.infer<typeof insertModeratedContentEventSchema>;
export type ModeratedContentEvent = typeof moderatedContentEventsTable.$inferSelect;
