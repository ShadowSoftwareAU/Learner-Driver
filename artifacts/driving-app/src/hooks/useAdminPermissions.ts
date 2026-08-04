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
 *  1. adminSubRole === 'owner' | 'manager'  → unconditional full access.
 *     Determined purely from the user profile (no extra API call needed).
 *     Owners are the primary tenant; managers are promoted staff members
 *     whose permissions row has been deleted as they bypass the table.
 *  2. Any other admin subRole   → permissions fetched from the API and bound
 *     strictly to the admin_staff_permissions table row written at invite-claim
 *     time. Invited staff always have adminSubRole = 'staff'.
 *  3. Non-admin role            → all-false (no-op).
 */
export function useAdminPermissions(): AdminPermissions {
  const { data: user } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  // Master tier (owner or manager) is determined directly from the profile —
  // no round-trip needed. Managers bypass the permissions table just like owners.
  const isMasterTierLocal =
    user?.role === "admin" &&
    (user?.adminSubRole === "owner" || user?.adminSubRole === "manager");

  const { data: perms } = useGetMyAdminPermissions({
    query: {
      queryKey: ["/api/admin/permissions/me"],
      // Master-tier users never need the permissions fetch; skip it entirely.
      enabled: user?.role === "admin" && !isMasterTierLocal,
    },
  });

  if (!user || user.role !== "admin") return NO_ACCESS;

  // Master-tier users get immediate full access from profile data.
  if (isMasterTierLocal) return FULL_ACCESS;

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
