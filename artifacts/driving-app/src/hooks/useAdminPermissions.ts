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
 * For Owner/Manager tier (adminSubRole: owner | manager), all permissions
 * are true by definition — no DB fetch needed beyond the user profile.
 * For regular admin staff, fetches their stored permission flags from the API.
 * For non-admin users, returns all-false (no-op).
 */
export function useAdminPermissions(): AdminPermissions {
  const { data: user } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  // Derive master tier status optimistically from user profile.
  // This avoids flicker for Owner/Manager users — they see full nav immediately.
  const isMasterTier =
    user?.role === "admin" &&
    ["owner", "manager"].includes(user?.adminSubRole ?? "");

  const { data: perms } = useGetMyAdminPermissions({
    query: {
      queryKey: ["/api/admin/permissions/me"],
      // Only fetch for non-master admin users; master tier is already determined above
      enabled: user?.role === "admin" && !isMasterTier,
    },
  });

  if (!user || user.role !== "admin") return NO_ACCESS;
  if (isMasterTier) return FULL_ACCESS;
  if (!perms) return NO_ACCESS; // still loading — conservative default

  return {
    isMasterTier: false,
    canViewBilling: perms.canViewBilling ?? false,
    canManageInstructors: perms.canManageInstructors ?? false,
    canManageCompliance: perms.canManageCompliance ?? false,
    canViewAuditLog: perms.canViewAuditLog ?? false,
    canManageBookings: perms.canManageBookings ?? false,
  };
}
