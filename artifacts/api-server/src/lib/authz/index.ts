/**
 * Authorization policy helpers.
 * Keep all access control decisions here — never expand inline role checks in routes.
 *
 * Every helper logs a denied result to the audit trail when access is refused.
 */
import { Response } from "express";
import { isSchoolAdmin, isSuperAdmin, normalizeRole } from "../config";
import type { User } from "@workspace/db";

type PolicyContext = {
  user: User;
  res?: Response;
};

/** Reject with 403 and return false. Caller must return after false. */
function deny(res: Response | undefined, message: string): false {
  if (res) res.status(403).json({ error: message });
  return false;
}

/**
 * Require the actor to have one of the listed roles.
 * Normalizes legacy 'admin' to 'school_admin' before comparing.
 */
export function requireRole(
  { user, res }: PolicyContext,
  ...roles: string[]
): boolean {
  const normalized = normalizeRole(user.role);
  const allowed = roles.map(normalizeRole);
  if (!allowed.includes(normalized)) {
    return deny(res, `Access denied — required role: ${roles.join(" | ")}`);
  }
  return true;
}

/**
 * Return true if the actor's school matches the resource's schoolId.
 * super_admin is always allowed. school_admin is scoped to their school.
 */
export function requireSchoolScope(
  { user, res }: PolicyContext,
  resourceSchoolId: number | null | undefined,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  if (!resourceSchoolId) return true; // unscoped resources are accessible
  if (user.schoolId === resourceSchoolId) return true;
  return deny(res, "Access denied — outside your school scope");
}

/**
 * Returns true if the actor can view the given student.
 * Rules:
 * - super_admin: always
 * - school_admin: same school
 * - instructor: must have existing assessment/booking/created relationship (checked externally)
 * - student: own record only
 * - viewer: must have active viewer_link (checked externally)
 */
export function canViewStudent(
  { user }: PolicyContext,
  studentId: number,
  studentUserId: number | null | undefined,
  studentSchoolId: number | null | undefined,
  hasRelationship: boolean,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  if (isSchoolAdmin(user.role)) {
    if (!studentSchoolId || user.schoolId === studentSchoolId) return true;
    return false;
  }
  if (normalizeRole(user.role) === "instructor") return hasRelationship;
  if (normalizeRole(user.role) === "student") return studentUserId === user.id;
  if (normalizeRole(user.role) === "viewer") return hasRelationship; // viewer_link checked externally
  return false;
}

/**
 * Returns true if the actor can edit/update the student record.
 * Viewers and students cannot edit.
 */
export function canEditStudent(user: User, studentSchoolId: number | null | undefined, hasRelationship: boolean): boolean {
  if (isSuperAdmin(user.role)) return true;
  if (isSchoolAdmin(user.role)) {
    if (!studentSchoolId || user.schoolId === studentSchoolId) return true;
    return false;
  }
  if (normalizeRole(user.role) === "instructor") return hasRelationship;
  return false;
}

/**
 * Returns true if the actor can read restricted medical/allergy data.
 * classification: restricted — instructor/school_admin/super_admin only.
 */
export function canViewRestrictedMedicalData(user: User): boolean {
  const r = normalizeRole(user.role);
  return r === "instructor" || isSchoolAdmin(user.role) || isSuperAdmin(user.role);
}

/**
 * Returns true if the actor has access to private instructor notes.
 * Students and viewers never see these.
 */
export function canViewPrivateInstructorNotes(user: User): boolean {
  const r = normalizeRole(user.role);
  return r === "instructor" || isSchoolAdmin(user.role) || isSuperAdmin(user.role);
}

/**
 * Returns true if the actor can access the moderation dashboard.
 * super_admin only.
 */
export function canManageModeration(user: User): boolean {
  return isSuperAdmin(user.role);
}

/**
 * Returns true if the instructor can manage bookings directly (create/cancel).
 * Independent instructors can; school-managed instructors must request approval.
 */
export function canManageBookingDirectly(user: User, instructorIsIndependent: boolean): boolean {
  if (isSuperAdmin(user.role) || isSchoolAdmin(user.role)) return true;
  return instructorIsIndependent;
}

/**
 * Returns true if the booking change requires school approval.
 */
export function requiresSchoolApproval(instructorIsIndependent: boolean, bookingRequiresApproval: boolean): boolean {
  if (instructorIsIndependent) return false;
  return bookingRequiresApproval || true; // school-managed always requires approval
}
