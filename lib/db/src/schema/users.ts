import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  // Extended roles: student | instructor | school_admin | super_admin | viewer | unassigned
  // During rollout, admin is tolerated as alias for school_admin
  role: text("role").notNull().default("unassigned"),
  // Admin sub-role scoped within school_admin: owner | manager | coordinator | null
  adminSubRole: text("admin_sub_role"),
  // Tenant scoping — null for independent instructors and super_admins
  schoolId: integer("school_id"),
  // Activity and session tracking
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  // MFA encouragement tracking for school_admin/super_admin roles
  mfaEncouragedAt: timestamp("mfa_encouraged_at", { withTimezone: true }),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
