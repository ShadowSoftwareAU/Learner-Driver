/**
 * Server-side feature flags and platform configuration.
 * Toggle enforcement independently from entitlement storage.
 */

export const featureFlags = {
  // Wave 2 — content moderation quarantine hard enforcement
  // When false: content is scanned and flagged but NOT blocked from being saved
  contentModerationEnforced: process.env.FEATURE_CONTENT_MODERATION_ENFORCED === "true",

  // Wave 4 — Stripe payment enforcement
  // When false: entitlement checks run but always pass
  stripePaymentEnforced: process.env.FEATURE_STRIPE_PAYMENT_ENFORCED === "true",

  // Demo mode reset controls — super_admin only UI control
  demoModeEnabled: process.env.FEATURE_DEMO_MODE_ENABLED === "true",

  // Session timeout backend enforcement
  sessionTimeoutEnforced: process.env.FEATURE_SESSION_TIMEOUT_ENFORCED === "true",

  // Viewer payment gate enforcement
  viewerPaymentGateEnforced: process.env.FEATURE_VIEWER_PAYMENT_GATE_ENFORCED === "true",

  // Calendar approval workflow enforcement
  calendarApprovalEnforced: process.env.FEATURE_CALENDAR_APPROVAL_ENFORCED === "true",
} as const;

/** Pricing tier plan codes — mirrors feature_entitlements featureKey values */
export const PLAN_CODES = {
  FREE: "free",
  VIEWER: "viewer",
  INDEPENDENT_INSTRUCTOR: "independent_instructor",
  SCHOOL: "school",
  ENTERPRISE: "enterprise",
} as const;

/** Feature keys for feature_entitlements table */
export const FEATURE_KEYS = {
  VIEWER_DASHBOARD_ACCESS: "viewer_dashboard_access",
  CALENDAR_MANAGEMENT: "calendar_management",
  BULK_BOOKING_MANAGEMENT: "bulk_booking_management",
  SCHOOL_BRANDING: "school_branding",
  SCHOOL_MULTI_INSTRUCTOR: "school_multi_instructor",
  DEMO_MODE_RESET: "demo_mode_reset",
  MODERATION_DASHBOARD: "moderation_dashboard",
} as const;

/** Pricing (AUD/month) */
export const PRICING = {
  VIEWER_MONTHLY: 2_00, // $2.00 in cents
  INDEPENDENT_INSTRUCTOR_MONTHLY: 29_00, // $29.00 in cents
  SCHOOL_BASE_MONTHLY: 99_00, // $99.00 includes 5 seats
  SCHOOL_ADDITIONAL_SEAT_MONTHLY: 15_00, // $15.00 per seat
} as const;

/** Guardian wallet — credit pack options for topping up, and standard lesson price */
export const WALLET = {
  CREDIT_PACKS_CENTS: [5_000, 10_000, 20_000] as const, // $50 / $100 / $200
  STANDARD_LESSON_PRICE_CENTS: 75_00, // $75.00 flat rate per booked lesson, paid via credits
} as const;

/** Roles — tolerate legacy 'admin' as alias during rollout */
export const ROLES = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  SCHOOL_ADMIN: "school_admin",
  VIEWER: "viewer",
  SUPER_ADMIN: "super_admin",
  UNASSIGNED: "unassigned",
  // Legacy alias — maps to school_admin during rollout
  ADMIN: "admin",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/** Normalize legacy admin role to school_admin */
export function normalizeRole(role: string): string {
  return role === "admin" ? "school_admin" : role;
}

/** Check if role is a school_admin (including legacy alias) */
export function isSchoolAdmin(role: string): boolean {
  return role === "school_admin" || role === "admin";
}

/** Check if role is super_admin */
export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}

/** Check if role can manage restricted medical data */
export function canAccessRestrictedData(role: string): boolean {
  return role === "instructor" || isSchoolAdmin(role) || isSuperAdmin(role);
}
