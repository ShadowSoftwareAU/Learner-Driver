import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One wallet per viewer (parent/guardian/mentor) — funds credits used to pay for bookings.
export const guardianWalletsTable = pgTable("guardian_wallets", {
  id: serial("id").primaryKey(),
  viewerUserId: integer("viewer_user_id").notNull().unique(),
  balanceCents: integer("balance_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  viewerUserId: integer("viewer_user_id").notNull(),
  type: text("type").notNull(), // topup | booking_payment | refund
  amountCents: integer("amount_cents").notNull(), // positive for topup/refund, negative for booking_payment
  bookingId: integer("booking_id"),
  studentId: integer("student_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("completed"), // pending | completed | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGuardianWalletSchema = createInsertSchema(guardianWalletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuardianWallet = z.infer<typeof insertGuardianWalletSchema>;
export type GuardianWallet = typeof guardianWalletsTable.$inferSelect;

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({ id: true, createdAt: true });
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;

// One wallet per student — holds prepaid credit balance for direct lesson payments.
// Separate from guardianWalletsTable which is for parent/guardian top-ups.
export const studentWalletsTable = pgTable("student_wallets", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().unique(),
  balanceCents: integer("balance_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentWalletSchema = createInsertSchema(studentWalletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentWallet = z.infer<typeof insertStudentWalletSchema>;
export type StudentWallet = typeof studentWalletsTable.$inferSelect;
