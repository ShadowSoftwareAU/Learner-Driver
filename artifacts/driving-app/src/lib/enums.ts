// ─── Role ─────────────────────────────────────────────────────────────────────
export type RoleUpdateRole = typeof RoleUpdateRole[keyof typeof RoleUpdateRole];
export const RoleUpdateRole = {
  student: "student",
  instructor: "instructor",
  admin: "admin",
  school_admin: "school_admin",
  viewer: "viewer",
} as const;

// ─── Competency ───────────────────────────────────────────────────────────────
export type ManeuverResultItemCompetencyLevel = typeof ManeuverResultItemCompetencyLevel[keyof typeof ManeuverResultItemCompetencyLevel];
export const ManeuverResultItemCompetencyLevel = {
  not_attempted: "not_attempted",
  attempted: "attempted",
  practiced: "practiced",
  mastered: "mastered",
} as const;

// ─── Bookings ─────────────────────────────────────────────────────────────────
export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];
export const BookingStatus = {
  pending: "pending",
  claimed: "claimed",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show",
} as const;

export type TransmissionType = typeof TransmissionType[keyof typeof TransmissionType];
export const TransmissionType = {
  auto: "auto",
  manual: "manual",
  either: "either",
} as const;

// ─── Pedal control ────────────────────────────────────────────────────────────
export type PedalOperator = typeof PedalOperator[keyof typeof PedalOperator];
export const PedalOperator = {
  student: "student",
  instructor: "instructor",
  shared: "shared",
} as const;

export const PedalOperatorLabel: Record<PedalOperator, string> = {
  student: "Student controls pedals",
  instructor: "Instructor controls pedals",
  shared: "Shared / dual control",
};

export const PedalOperatorDescription: Record<PedalOperator, string> = {
  student: "The learner operates the accelerator and brake without instructor override.",
  instructor: "The instructor retains pedal control throughout (e.g. early lessons).",
  shared: "Dual control vehicle — both instructor and student have pedal access.",
};

// ─── Content status ───────────────────────────────────────────────────────────
export type ContentStatus = typeof ContentStatus[keyof typeof ContentStatus];
export const ContentStatus = {
  approved: "approved",
  quarantined: "quarantined",
  under_review: "under_review",
  released: "released",
} as const;

// ─── Assessment status ────────────────────────────────────────────────────────
export type AssessmentStatus = typeof AssessmentStatus[keyof typeof AssessmentStatus];
export const AssessmentStatus = {
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
} as const;

// ─── Data classification ──────────────────────────────────────────────────────
export type DataClassification = "restricted" | "confidential" | "internal" | "public";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
