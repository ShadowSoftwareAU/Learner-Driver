import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { instructorsTable } from "./instructors";

export const instructorVerificationsTable = pgTable("instructor_verifications", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").notNull().references(() => instructorsTable.id),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewerId: integer("reviewer_id").references(() => usersTable.id),
  reviewerNotes: text("reviewer_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const verificationDocumentsTable = pgTable("verification_documents", {
  id: serial("id").primaryKey(),
  verificationId: integer("verification_id").notNull().references(() => instructorVerificationsTable.id),
  docType: text("doc_type").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  objectPath: text("object_path").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const termsAcceptancesTable = pgTable("terms_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  version: text("version").notNull().default("1.0"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInstructorVerificationSchema = createInsertSchema(instructorVerificationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVerificationDocumentSchema = createInsertSchema(verificationDocumentsTable).omit({ id: true, uploadedAt: true });
export const insertTermsAcceptanceSchema = createInsertSchema(termsAcceptancesTable).omit({ id: true, acceptedAt: true });

export type InstructorVerification = typeof instructorVerificationsTable.$inferSelect;
export type VerificationDocument = typeof verificationDocumentsTable.$inferSelect;
export type TermsAcceptance = typeof termsAcceptancesTable.$inferSelect;
