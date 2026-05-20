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
