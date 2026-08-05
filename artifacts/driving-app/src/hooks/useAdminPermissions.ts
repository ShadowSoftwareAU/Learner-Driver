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
 *  1. adminSubRole === 'owner'  → unconditional full access determined from
 *     the user profile (no extra API call needed). Owners are the primary tenant.
 *  2. adminSubRole === 'manager' | 'staff'  → permissions fetched from the API
 *     and bound to the admin_staff_permissions table row. Managers start with
 *     full permissions when promoted but can be individually adjusted.
 *     isMasterTier is always false for managers.
 *  3. Non-admin role  → all-false (no-op).
 */
export function useAdminPermissions(): AdminPermissions {
  const { data: user } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  // Only owners are master tier — determined directly from the profile,
  // no round-trip needed.
  const isOwner = user?.role === "admin" && user?.adminSubRole === "owner";

  const { data: perms } = useGetMyAdminPermissions({
    query: {
      queryKey: ["/api/admin/permissions/me"],
      // Owners skip the permissions fetch; all other admin roles (manager,
      // staff) must go through the DB-backed permissions endpoint.
      enabled: user?.role === "admin" && !isOwner,
    },
  });

  if (!user || user.role !== "admin") return NO_ACCESS;

  // Owners get immediate full access from profile data.
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
