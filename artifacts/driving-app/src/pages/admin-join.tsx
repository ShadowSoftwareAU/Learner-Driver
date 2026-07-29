import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import {
  useGetAdminStaffInvitePreview,
  useClaimAdminStaffInvite,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const PENDING_ADMIN_JOIN_TOKEN_KEY = "pendingAdminJoinToken";

const PERM_LABELS: Record<string, string> = {
  canViewBilling: "View Billing & Finance",
  canManageInstructors: "Manage Instructors & Students",
  canManageCompliance: "Manage Compliance",
  canViewAuditLog: "View Audit Log",
  canManageBookings: "Manage Bookings",
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminJoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const { toast } = useToast();
  const [claimed, setClaimed] = useState(false);

  const { data: preview, isLoading: previewLoading } =
    useGetAdminStaffInvitePreview(token, {
      query: {
        queryKey: [`/api/admin/staff/invite/${token}`],
        enabled: !!token,
      },
    });

  const claimInvite = useClaimAdminStaffInvite();

  // Store token in sessionStorage so HomeRedirect can pick it up post-auth
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      sessionStorage.setItem(PENDING_ADMIN_JOIN_TOKEN_KEY, token);
    }
  }, [isLoaded, isSignedIn, token]);

  const handleClaim = async () => {
    try {
      await claimInvite.mutateAsync({ token });
      setClaimed(true);
      setTimeout(() => navigate("/admin/dashboard"), 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to accept invitation.";
      toast({ title: msg, variant: "destructive" });
    }
  };

  if (previewLoading || !isLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Claimed success state
  if (claimed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold">Welcome aboard!</h2>
            <p className="text-sm text-muted-foreground">
              Your admin access has been set up. Redirecting to your dashboard…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (!preview || !preview.valid) {
    const reason = !preview
      ? "This invite link is invalid."
      : preview.expired
      ? "This invite link has expired."
      : `This invite has already been ${preview.status}.`;

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold">Invite unavailable</h2>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const permissions = preview.permissions ?? {};
  const grantedPerms = Object.entries(PERM_LABELS).filter(
    ([key]) => (permissions as Record<string, boolean>)[key]
  );

  const expiresIn = Math.ceil(
    (new Date(preview.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Branding */}
        <div className="flex justify-center mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg text-foreground">Learner Log</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>You've been invited</CardTitle>
            <CardDescription>
              <strong>{preview.invitedByName}</strong> has invited{" "}
              <strong>{preview.inviteeEmail}</strong> to join as a staff
              administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Permissions */}
            <div>
              <p className="text-sm font-medium mb-2.5">Your access permissions:</p>
              {grantedPerms.length > 0 ? (
                <ul className="space-y-1.5">
                  {grantedPerms.map(([, label]) => (
                    <li key={label} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Read-only dashboard access
                </p>
              )}
            </div>

            {/* Expiry */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Expires in {expiresIn > 0 ? `${expiresIn} day${expiresIn !== 1 ? "s" : ""}` : "less than a day"}
            </div>

            {/* Action area */}
            {!isSignedIn ? (
              <div className="space-y-3 pt-1">
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to accept this invitation.
                </p>
                <div className="flex flex-col gap-2">
                  <SignUpButton
                    mode="redirect"
                    forceRedirectUrl={`${window.location.origin}${basePath}/admin-join/${token}`}
                  >
                    <Button className="w-full">Create Account</Button>
                  </SignUpButton>
                  <SignInButton
                    mode="redirect"
                    forceRedirectUrl={`${window.location.origin}${basePath}/admin-join/${token}`}
                  >
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </SignInButton>
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <Button
                  className="w-full"
                  onClick={handleClaim}
                  disabled={claimInvite.isPending}
                >
                  {claimInvite.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Accepting…
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          If you weren't expecting this invitation, you can safely close this page.
        </p>
      </div>
    </div>
  );
}
