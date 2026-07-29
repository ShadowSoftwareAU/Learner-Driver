/**
 * /join/:token  —  Instructor invite acceptance page.
 *
 * Flow:
 *  - Anyone with the link can preview the invite details (no auth required).
 *  - If not signed in, buttons guide them to sign up / sign in.
 *    The token is stored in sessionStorage so after auth the app redirects
 *    back here automatically (handled in App.tsx via pendingJoinToken).
 *  - If signed in, they can accept or decline the invitation with one click.
 */
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useUser, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useGetInstructorInvitePreview, useClaimInstructorInvite } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Building2, CheckCircle2, XCircle, AlertCircle, LogIn, UserPlus,
} from "lucide-react";

export const PENDING_JOIN_TOKEN_KEY = "pendingJoinToken";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Fetch public invite preview
  const { data: preview, isLoading: previewLoading, error: previewError } = useGetInstructorInvitePreview(
    token ?? "",
    { query: { queryKey: [`/api/instructor-links/invite/${token}`], enabled: !!token } },
  );

  const claimInvite = useClaimInstructorInvite();

  // When the page loads while signed out, store the token so App.tsx can
  // redirect here after Clerk sign-in/sign-up completes.
  useEffect(() => {
    if (token && isLoaded && !isSignedIn) {
      sessionStorage.setItem(PENDING_JOIN_TOKEN_KEY, token);
    }
  }, [token, isLoaded, isSignedIn]);

  // Once signed in, clear the stored token (we're already on the page)
  useEffect(() => {
    if (isSignedIn) {
      sessionStorage.removeItem(PENDING_JOIN_TOKEN_KEY);
    }
  }, [isSignedIn]);

  const handleAccept = async () => {
    if (!token) return;
    setClaiming(true);
    try {
      const result = await claimInvite.mutateAsync({ token });
      setClaimed(true);
      toast({
        title: "Invitation accepted",
        description: `You are now linked to ${(result as any).linkedToAdmin ?? "the school admin"}.`,
      });
      // Redirect to instructor availability after a short delay
      setTimeout(() => navigate("/instructor/availability"), 2000);
    } catch (err: any) {
      const msg = err?.body?.error ?? err?.response?.data?.error ?? "Please try again.";
      toast({ title: "Could not accept invite", description: msg, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const handleDecline = () => {
    navigate("/");
  };

  // ── Loading states ──────────────────────────────────────────────────────────

  if (!token) {
    return <JoinShell><ErrorCard message="Invalid invite link." /></JoinShell>;
  }

  if (previewLoading || !isLoaded) {
    return (
      <JoinShell>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </JoinShell>
    );
  }

  if (previewError || !(preview as any)?.valid) {
    const p = preview as any;
    const msg = p?.expired
      ? "This invite link has expired. Ask the school admin to send a new one."
      : p?.status === "accepted"
      ? "This invite has already been used."
      : "This invite link is invalid or has been cancelled.";
    return <JoinShell><ErrorCard message={msg} /></JoinShell>;
  }

  const p = preview as any;

  // ── Claimed success ─────────────────────────────────────────────────────────
  if (claimed) {
    return (
      <JoinShell>
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">All done!</h2>
            <p className="text-muted-foreground text-sm">
              You are now linked to <strong>{p.invitedBy}</strong>. Redirecting you to
              your availability page…
            </p>
          </CardContent>
        </Card>
      </JoinShell>
    );
  }

  // ── Main invite card ────────────────────────────────────────────────────────
  return (
    <JoinShell>
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl">You've been invited</CardTitle>
          <CardDescription className="text-base mt-1">
            <strong>{p.invitedBy}</strong> has invited you to join Learner Log as an instructor.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invited by</span>
              <span className="font-medium">{p.invitedBy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sent to</span>
              <span className="font-medium">{p.inviteeEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">
                {new Date(p.expiresAt).toLocaleDateString("en-AU", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Not signed in — guide to auth */}
          {!isSignedIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Create a free account or sign in to accept this invitation.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <SignUpButton
                  mode="redirect"
                  forceRedirectUrl={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/join/${token}`}
                >
                  <Button className="w-full gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    Create Account
                  </Button>
                </SignUpButton>
                <SignInButton
                  mode="redirect"
                  forceRedirectUrl={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/join/${token}`}
                >
                  <Button variant="outline" className="w-full gap-1.5">
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Button>
                </SignInButton>
              </div>
            </div>
          )}

          {/* Signed in — accept or decline */}
          {isSignedIn && (
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleAccept}
                disabled={claiming}
                className="w-full gap-1.5"
                size="lg"
              >
                {claiming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Accept Invitation
              </Button>
              <Button
                variant="ghost"
                onClick={handleDecline}
                disabled={claiming}
                className="w-full gap-1.5 text-muted-foreground"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </JoinShell>
  );
}

// ── Layout shell (no sidebar — this page is pre/semi auth) ───────────────────

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <header className="h-16 bg-white border-b flex items-center px-6">
        <img src="/learnerlog-logo.png" alt="Learner Log" className="h-9 w-auto" />
      </header>
      <main className="flex-1 flex items-start justify-center p-4 pt-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  const [, navigate] = useLocation();
  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-8 pb-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go to homepage</Button>
      </CardContent>
    </Card>
  );
}
