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
 * Access rules (evaluated server-side, reflected in isMasterTier):
 *  1. Owner/Manager subRole → full access (fast path, no extra fetch needed
 *     but we still fetch so the hook is uniform).
 *  2. Admin with NO row in admin_staff_permissions → primary admin account,
 *     full access.
 *  3. Admin WITH a permissions row → invited staff, scoped access per that row.
 *  4. Any other role → all-false (no-op for non-admin pages).
 *
 * While the query is loading the hook returns NO_ACCESS (conservative).
 * The query resolves in one round-trip and is cached, so flicker is minimal.
 */
export function useAdminPermissions(): AdminPermissions {
  const { data: user } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  const { data: perms } = useGetMyAdminPermissions({
    query: {
      queryKey: ["/api/admin/permissions/me"],
      // Only fire for admin users — others never need this.
      enabled: user?.role === "admin",
    },
  });

  if (!user || user.role !== "admin") return NO_ACCESS;

  // Still loading the permissions response — show nothing until we know.
  if (!perms) return NO_ACCESS;

  // Server already applied the full logic (owner/manager OR no perms row → full).
  if (perms.isMasterTier) return FULL_ACCESS;

  return {
    isMasterTier: false,
    canViewBilling: perms.canViewBilling ?? false,
    canManageInstructors: perms.canManageInstructors ?? false,
    canManageCompliance: perms.canManageCompliance ?? false,
    canViewAuditLog: perms.canViewAuditLog ?? false,
    canManageBookings: perms.canManageBookings ?? false,
  };
}
