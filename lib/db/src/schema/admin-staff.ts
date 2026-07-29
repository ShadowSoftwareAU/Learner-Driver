import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Per-user permission flags for admin staff members.
 * Owner/Manager tier (adminSubRole: owner | manager) bypasses this table
 * and always has full access. Rows here are only created for regular staff.
 */
export const adminStaffPermissionsTable = pgTable("admin_staff_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  canViewBilling: boolean("can_view_billing").notNull().default(false),
  canManageInstructors: boolean("can_manage_instructors").notNull().default(false),
  canManageCompliance: boolean("can_manage_compliance").notNull().default(false),
  canViewAuditLog: boolean("can_view_audit_log").notNull().default(false),
  canManageBookings: boolean("can_manage_bookings").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Pending email invites for new admin staff members.
 * Carries the permission set that will be applied on claim.
 */
export const adminStaffInvitesTable = pgTable("admin_staff_invites", {
  id: serial("id").primaryKey(),
  invitedByUserId: integer("invited_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  inviteeEmail: text("invitee_email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | accepted | expired | cancelled
  canViewBilling: boolean("can_view_billing").notNull().default(false),
  canManageInstructors: boolean("can_manage_instructors").notNull().default(false),
  canManageCompliance: boolean("can_manage_compliance").notNull().default(false),
  canViewAuditLog: boolean("can_view_audit_log").notNull().default(false),
  canManageBookings: boolean("can_manage_bookings").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
