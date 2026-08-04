import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserCog, Plus, Trash2, Pencil, Mail, ShieldCheck, Users, FileText, CreditCard, BookOpen, AlertTriangle } from "lucide-react";
import {
  useListAdminStaff,
  useInviteAdminStaff,
  useCancelAdminStaffInvite,
  useUpdateAdminStaffPermissions,
  useUpdateAdminStaffSubRole,
  useRemoveAdminStaff,
  useGetMe,
} from "@workspace/api-client-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useToast } from "@/hooks/use-toast";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

// ─── Permission definitions ───────────────────────────────────────────────────

type PermKey =
  | "canViewBilling"
  | "canManageInstructors"
  | "canManageCompliance"
  | "canViewAuditLog"
  | "canManageBookings";

const PERMISSION_DEFS: { key: PermKey; label: string; description: string; icon: React.ElementType }[] = [
  {
    key: "canViewBilling",
    label: "Can view Billing & Finance",
    description: "Read-only access to invoices and transaction history",
    icon: CreditCard,
  },
  {
    key: "canManageInstructors",
    label: "Can manage Instructors & Students",
    description: "View and edit instructor and student profiles, handover notes",
    icon: Users,
  },
  {
    key: "canManageCompliance",
    label: "Can manage Compliance",
    description: "Access the compliance and verification dashboard",
    icon: ShieldCheck,
  },
  {
    key: "canViewAuditLog",
    label: "Can view Audit Log",
    description: "Read-only access to the audit trail",
    icon: FileText,
  },
  {
    key: "canManageBookings",
    label: "Can manage Bookings",
    description: "View and manage lesson bookings",
    icon: BookOpen,
  },
];

// ─── Permission badge list ─────────────────────────────────────────────────────

function PermissionBadges({
  perms,
  isMasterTier,
}: {
  perms: Record<PermKey, boolean>;
  isMasterTier: boolean;
}) {
  if (isMasterTier) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
        Full access
      </Badge>
    );
  }
  const granted = PERMISSION_DEFS.filter((d) => perms[d.key]);
  if (!granted.length) {
    return <span className="text-xs text-muted-foreground italic">No permissions</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map((d) => (
        <Badge key={d.key} variant="secondary" className="text-xs">
          {d.label.replace("Can ", "").replace(" & ", "/")}
        </Badge>
      ))}
    </div>
  );
}

// ─── Permissions toggle form (shared by invite + edit) ───────────────────────

type PermissionsFormValues = Record<PermKey, boolean>;

function PermissionsToggles({
  value,
  onChange,
}: {
  value: PermissionsFormValues;
  onChange: (key: PermKey, checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {PERMISSION_DEFS.map((def) => {
        const Icon = def.icon;
        return (
          <div key={def.key} className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium leading-none">{def.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
              </div>
            </div>
            <Switch
              checked={value[def.key]}
              onCheckedChange={(checked) => onChange(def.key, checked)}
              aria-label={def.label}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Invite dialog ────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [permissions, setPermissions] = useState<PermissionsFormValues>({
    canViewBilling: false,
    canManageInstructors: false,
    canManageCompliance: false,
    canViewAuditLog: false,
    canManageBookings: false,
  });

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  const invite = useInviteAdminStaff();
  const { toast } = useToast();

  const handlePermChange = (key: PermKey, checked: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: checked }));
  };

  const onSubmit = async (values: InviteValues) => {
    try {
      await invite.mutateAsync({
        data: {
          email: values.email,
          ...permissions,
          joinBaseUrl: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ""),
        },
      });
      toast({ title: "Invitation sent", description: `Invite sent to ${values.email}` });
      form.reset();
      setPermissions({
        canViewBilling: false,
        canManageInstructors: false,
        canManageCompliance: false,
        canViewAuditLog: false,
        canManageBookings: false,
      });
      onInvited();
    } catch {
      toast({ title: "Failed to send invite", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Send an invite link with access permissions. The recipient will be
            prompted to create an account if they don't have one.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input placeholder="staff@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Access permissions</p>
              <PermissionsToggles value={permissions} onChange={handlePermChange} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit permissions dialog ──────────────────────────────────────────────────

function EditPermissionsDialog({
  staffMember,
  isCurrentUserOwner,
  onClose,
  onSaved,
}: {
  staffMember: {
    id: number;
    name: string | null;
    email: string;
    adminSubRole: string | null;
    permissions: PermissionsFormValues & { isMasterTier: boolean };
  };
  isCurrentUserOwner: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialSubRole =
    staffMember.adminSubRole === "manager" ? "manager" : "staff";
  const [subRole, setSubRole] = useState<"manager" | "staff">(initialSubRole);
  const [permissions, setPermissions] = useState<PermissionsFormValues>({
    canViewBilling: staffMember.permissions.canViewBilling,
    canManageInstructors: staffMember.permissions.canManageInstructors,
    canManageCompliance: staffMember.permissions.canManageCompliance,
    canViewAuditLog: staffMember.permissions.canViewAuditLog,
    canManageBookings: staffMember.permissions.canManageBookings,
  });

  const update = useUpdateAdminStaffPermissions();
  const updateSubRole = useUpdateAdminStaffSubRole();
  const { toast } = useToast();

  const isSaving = update.isPending || updateSubRole.isPending;

  const handleSave = async () => {
    try {
      const subRoleChanged = subRole !== initialSubRole;

      // Update sub-role first if it changed (this deletes/creates the perms row).
      if (subRoleChanged) {
        await updateSubRole.mutateAsync({ id: staffMember.id, data: { subRole } });
      }

      // Update permissions only when the final state is 'staff'.
      if (subRole === "staff") {
        await update.mutateAsync({ id: staffMember.id, data: permissions });
      }

      toast({
        title:
          subRoleChanged
            ? subRole === "manager"
              ? "Promoted to Manager"
              : "Demoted to Staff"
            : "Permissions updated",
      });
      onSaved();
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Access</DialogTitle>
          <DialogDescription>
            Updating access for{" "}
            <strong>{staffMember.name ?? staffMember.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Sub-role toggle — only shown to owners */}
        {isCurrentUserOwner && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Role</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSubRole("staff")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  subRole === "staff"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-medium">Staff</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scoped to the permissions below
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSubRole("manager")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  subRole === "manager"
                    ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-medium">Manager</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full access, no restrictions
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Permissions toggles — hidden when role is manager */}
        {subRole === "staff" ? (
          <>
            {isCurrentUserOwner && <Separator />}
            <PermissionsToggles
              value={permissions}
              onChange={(key, checked) =>
                setPermissions((prev) => ({ ...prev, [key]: checked }))
              }
            />
          </>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800">
              Managers have full access to all admin features. Individual
              permission toggles do not apply.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ManageStaffPage() {
  const adminPerms = useAdminPermissions();
  const { data: currentUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const isCurrentUserOwner = currentUser?.role === "admin" && currentUser?.adminSubRole === "owner";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<null | {
    id: number;
    name: string | null;
    email: string;
    adminSubRole: string | null;
    permissions: PermissionsFormValues & { isMasterTier: boolean };
  }>(null);
  const [removeTarget, setRemoveTarget] = useState<null | { id: number; email: string }>(null);
  const [cancelTarget, setCancelTarget] = useState<null | { id: number; email: string }>(null);

  const { data, refetch } = useListAdminStaff({
    query: {
      queryKey: ["/api/admin/staff"],
      enabled: adminPerms.isMasterTier,
    },
  });

  const removeStaff = useRemoveAdminStaff();
  const cancelInvite = useCancelAdminStaffInvite();
  const { toast } = useToast();

  if (!adminPerms.isMasterTier) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Owner or Manager access is required to manage staff.
            </p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const staff = data?.staff ?? [];
  const pendingInvites = data?.pendingInvites ?? [];

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeStaff.mutateAsync({ id: removeTarget.id });
      toast({ title: "Staff member removed" });
      setRemoveTarget(null);
      refetch();
    } catch {
      toast({ title: "Failed to remove staff member", variant: "destructive" });
    }
  };

  const handleCancelInvite = async () => {
    if (!cancelTarget) return;
    try {
      await cancelInvite.mutateAsync({ id: cancelTarget.id });
      toast({ title: "Invite cancelled" });
      setCancelTarget(null);
      refetch();
    } catch {
      toast({ title: "Failed to cancel invite", variant: "destructive" });
    }
  };

  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <SidebarLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Manage Staff</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Invite administrators and control what each person can access.
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Invite Staff
          </Button>
        </div>

        {/* Staff members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Staff Members
              {staff.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({staff.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Active admin accounts and their access levels.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No staff members yet. Send an invite to get started.
              </p>
            ) : (
              <ul className="divide-y">
                {staff.map((member) => {
                  const isMaster = member.permissions.isMasterTier;
                  return (
                    <li
                      key={member.id}
                      className="py-4 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {member.name ?? member.email}
                          </span>
                          {member.adminSubRole && (
                            <Badge
                              variant="outline"
                              className={
                                isMaster
                                  ? "border-amber-300 text-amber-700 bg-amber-50"
                                  : ""
                              }
                            >
                              {member.adminSubRole}
                            </Badge>
                          )}
                        </div>
                        {member.name && (
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        )}
                        <PermissionBadges
                          perms={member.permissions}
                          isMasterTier={isMaster}
                        />
                      </div>
                      {!isMaster && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit permissions"
                            onClick={() =>
                              setEditTarget({
                                id: member.id,
                                name: member.name ?? null,
                                email: member.email,
                                adminSubRole: member.adminSubRole ?? null,
                                permissions: member.permissions,
                              })
                            }
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Remove staff member"
                            onClick={() =>
                              setRemoveTarget({ id: member.id, email: member.email })
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pending Invites
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({pendingInvites.length})
                </span>
              </CardTitle>
              <CardDescription>
                Sent invitations waiting to be accepted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {pendingInvites.map((inv) => {
                  const days = daysUntil(inv.expiresAt);
                  return (
                    <li
                      key={inv.id}
                      className="py-4 flex items-start gap-3"
                    >
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-medium">{inv.inviteeEmail}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs ${days <= 1 ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            Expires in {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "less than a day"}
                          </span>
                        </div>
                        <PermissionBadges
                          perms={{
                            canViewBilling: inv.canViewBilling ?? false,
                            canManageInstructors: inv.canManageInstructors ?? false,
                            canManageCompliance: inv.canManageCompliance ?? false,
                            canViewAuditLog: inv.canViewAuditLog ?? false,
                            canManageBookings: inv.canManageBookings ?? false,
                          }}
                          isMasterTier={false}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                        title="Cancel invite"
                        onClick={() =>
                          setCancelTarget({ id: inv.id, email: inv.inviteeEmail })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); refetch(); }}
      />

      {editTarget && (
        <EditPermissionsDialog
          staffMember={editTarget}
          isCurrentUserOwner={isCurrentUserOwner}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refetch(); }}
        />
      )}

      {removeTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{removeTarget.email}</strong> will lose admin access
                immediately. Their account will remain but be set back to
                unassigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleRemove}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {cancelTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setCancelTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel invite?</AlertDialogTitle>
              <AlertDialogDescription>
                The invite sent to <strong>{cancelTarget.email}</strong> will be
                cancelled and the link will stop working.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep invite</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelInvite}>
                Cancel invite
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </SidebarLayout>
  );
}
