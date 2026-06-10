import { pgTable, text, serial, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Billing subscription (Stripe skeleton — not enforced yet, feature-flagged)
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id"),
  userId: integer("user_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCode: text("plan_code").notNull(), // free | viewer | independent_instructor | school | enterprise
  status: text("status").notNull().default("inactive"), // trialing | active | past_due | cancelled | incomplete | inactive
  seatCount: integer("seat_count"),
  renewalAt: timestamp("renewal_at", { withTimezone: true }),
  billingProvider: text("billing_provider").notNull().default("stripe"), // stripe | apple | google | manual
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Feature entitlements — read before enforcing any gated feature
// Enforcement is separately controlled by feature flags in config.ts
export const featureEntitlementsTable = pgTable("feature_entitlements", {
  id: serial("id").primaryKey(),
  scopeType: text("scope_type").notNull(), // user | school
  scopeId: integer("scope_id").notNull(),
  featureKey: text("feature_key").notNull(), // viewer_dashboard_access | calendar_management | school_branding | moderation_dashboard | demo_mode_reset | bulk_booking_management | school_multi_instructor
  isEnabled: boolean("is_enabled").notNull().default(false),
  source: text("source").notNull().default("default"), // plan | promo | manual | default
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.scopeType, t.scopeId, t.featureKey),
]);

// Per-user notification preferences
export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  bookingEmails: boolean("booking_emails").notNull().default(true),
  bookingPush: boolean("booking_push").notNull().default(true),
  safeguardingAlerts: boolean("safeguarding_alerts").notNull().default(true),
  marketingEnabled: boolean("marketing_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Push tokens for future Expo / FCM push delivery
export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  platform: text("platform").notNull(), // ios | android | web
  provider: text("provider").notNull(), // expo | fcm | apns
  token: text("token").notNull().unique(),
  deviceLabel: text("device_label"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferencesTable).omit({ id: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferencesTable.$inferSelect;

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({ id: true, createdAt: true });
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;
