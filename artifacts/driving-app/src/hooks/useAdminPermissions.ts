import { useGetMe, useGetMyAdminPermissions } from "@workspace/api-client-react";

export type AdminPermissions = {
  isMasterTier: boolean;
  canViewBilling: boolean;
  canManageInstructors: boolean;
  canManageCompliance: boolean;
  canViewAuditLog: boolean;
  canManageBookings: boolean;
};

const FULL_ACCESS: AdminPermissions = {
  isMasterTier: true,
  canViewBilling: true,
  canManageInstructors: true,
  canManageCompliance: true,
  canViewAuditLog: true,
  canManageBookings: true,
};

const NO_ACCESS: AdminPermissions = {
  isMasterTier: false,
  canViewBilling: false,
  canManageInstructors: false,
  canManageCompliance: false,
  canViewAuditLog: false,
  canManageBookings: false,
};

/**
 * Returns the current user's admin permission profile.
 *
 * Access rules:
 *  1. adminSubRole === 'owner'  → unconditional full access. Determined
 *     purely from the user profile (no extra API call). This is the primary
 *     tenant created via the onboarding screen.
 *  2. Any other admin subRole   → permissions fetched from the API and bound
 *     strictly to the admin_staff_permissions table row written at invite-claim
 *     time. Invited staff always have adminSubRole = 'staff'.
 *  3. Non-admin role            → all-false (no-op).
 */
export function useAdminPermissions(): AdminPermissions {
  const { data: user } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  // Owner is determined directly from the profile — no round-trip needed.
  const isOwner = user?.role === "admin" && user?.adminSubRole === "owner";

  const { data: perms } = useGetMyAdminPermissions({
    query: {
      queryKey: ["/api/admin/permissions/me"],
      // Owners never need the permissions fetch; skip it entirely.
      enabled: user?.role === "admin" && !isOwner,
    },
  });

  if (!user || user.role !== "admin") return NO_ACCESS;

  // Owners get immediate full access from profile data — no loading state.
  if (isOwner) return FULL_ACCESS;

  // Non-owner admin staff — wait for their permissions to load.
  if (!perms) return NO_ACCESS;

  return {
    isMasterTier: false,
    canViewBilling: perms.canViewBilling ?? false,
    canManageInstructors: perms.canManageInstructors ?? false,
    canManageCompliance: perms.canManageCompliance ?? false,
    canViewAuditLog: perms.canViewAuditLog ?? false,
    canManageBookings: perms.canManageBookings ?? false,
  };
}
