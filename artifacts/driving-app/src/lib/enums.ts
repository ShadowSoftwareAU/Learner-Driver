export type RoleUpdateRole = typeof RoleUpdateRole[keyof typeof RoleUpdateRole];
export const RoleUpdateRole = {
  student: "student",
  instructor: "instructor",
  admin: "admin",
} as const;

export type ManeuverResultItemCompetencyLevel = typeof ManeuverResultItemCompetencyLevel[keyof typeof ManeuverResultItemCompetencyLevel];
export const ManeuverResultItemCompetencyLevel = {
  not_attempted: "not_attempted",
  attempted: "attempted",
  practiced: "practiced",
  mastered: "mastered",
} as const;

export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];
export const BookingStatus = {
  pending: "pending",
  claimed: "claimed",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export type TransmissionType = typeof TransmissionType[keyof typeof TransmissionType];
export const TransmissionType = {
  auto: "auto",
  manual: "manual",
  either: "either",
} as const;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
