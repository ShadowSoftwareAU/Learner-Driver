import { useState } from "react";
import {
  useGetInstructorLinks,
  useLinkInstructorByCode,
  useInviteInstructorByEmail,
  useRevokeInstructorLink,
  useCancelInstructorInvite,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Link2, Mail, Users, Trash2, CheckCircle2,
  Clock, XCircle, RefreshCw, UserCheck, AlertCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const LINKS_QK = ["/api/instructor-links"];

// ── Status badge helpers ──────────────────────────────────────────────────────

function LinkStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; Icon: any }> = {
    active:   { label: "Active",   className: "text-green-700 border-green-200 bg-green-50",  Icon: CheckCircle2 },
    pending:  { label: "Pending",  className: "text-amber-700 border-amber-200 bg-amber-50",  Icon: Clock },
    revoked:  { label: "Revoked",  className: "text-red-700 border-red-200 bg-red-50",        Icon: XCircle },
    declined: { label: "Declined", className: "text-gray-600 border-gray-200 bg-gray-50",     Icon: XCircle },
  };
  const cfg = map[status] ?? { label: status, className: "text-gray-600 border-gray-200 bg-gray-50", Icon: AlertCircle };
  const Icon = cfg.Icon;
  return (
    <Badge variant="outline" className={`text-xs flex items-center gap-1 ${cfg.className}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </Badge>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InstructorManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useGetInstructorLinks({
    query: { queryKey: LINKS_QK },
  });

  const links = (data as any)?.links ?? [];
  const pendingInvites = (data as any)?.pendingInvites ?? [];
  const activeLinks = links.filter((l: any) => l.status === "active");
  const inactiveLinks = links.filter((l: any) => l.status !== "active");

  // ── Link by code ────────────────────────────────────────────────────────────
  const linkByCode = useLinkInstructorByCode();
  const [codeInput, setCodeInput] = useState("");

  const handleLinkByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) { toast({ title: "Enter a link code", variant: "destructive" }); return; }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      toast({ title: "Link codes are 6 alphanumeric characters", variant: "destructive" }); return;
    }
    try {
      const result = await linkByCode.mutateAsync({ data: { linkCode: code } });
      await qc.invalidateQueries({ queryKey: LINKS_QK });
      setCodeInput("");
      toast({
        title: "Instructor linked",
        description: `${(result as any).instructorName} is now linked to your account.`,
      });
    } catch (err: any) {
      const msg = err?.body?.error ?? err?.response?.data?.error ?? "Please try again.";
      toast({ title: "Link failed", description: msg, variant: "destructive" });
    }
  };

  // ── Invite by email ─────────────────────────────────────────────────────────
  const inviteByEmail = useInviteInstructorByEmail();
  const [emailInput, setEmailInput] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const handleInvite = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) { toast({ title: "Enter an email address", variant: "destructive" }); return; }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      toast({ title: "Enter a valid email address", variant: "destructive" }); return;
    }
    try {
      const joinBaseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
      const result = await inviteByEmail.mutateAsync({ data: { email, joinBaseUrl } });
      await qc.invalidateQueries({ queryKey: LINKS_QK });
      setEmailInput("");
      setLastInviteUrl((result as any).inviteUrl ?? null);
      const delivered = (result as any).emailDelivered;
      toast({
        title: delivered ? "Invite sent" : "Invite created (email not sent)",
        description: delivered
          ? `An invitation has been sent to ${email}.`
          : `Copy the invite link below and share it with ${email}.`,
      });
    } catch (err: any) {
      const msg = err?.body?.error ?? err?.response?.data?.error ?? "Please try again.";
      toast({ title: "Invite failed", description: msg, variant: "destructive" });
    }
  };

  // ── Revoke / Cancel ─────────────────────────────────────────────────────────
  const revokeLink = useRevokeInstructorLink();
  const cancelInvite = useCancelInstructorInvite();
  const [revoking, setRevoking] = useState<number | null>(null);

  const handleRevoke = async (id: number) => {
    setRevoking(id);
    try {
      await revokeLink.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: LINKS_QK });
      toast({ title: "Link revoked" });
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  const handleCancelInvite = async (id: number) => {
    setRevoking(id);
    try {
      await cancelInvite.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: LINKS_QK });
      toast({ title: "Invite cancelled" });
    } catch {
      toast({ title: "Failed to cancel invite", variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />
              Instructor Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Link instructors to your school account so they can tag availability slots to your school.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* ── Two workflow cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Workflow 1: Link via Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="w-4 h-4 text-primary" />
                Link via Code
              </CardTitle>
              <CardDescription>
                Ask the instructor for their 6-character link code. Entering it creates an
                immediate active link — no approval needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="link-code">Instructor Link Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="link-code"
                    placeholder="e.g. A1B2C3"
                    maxLength={6}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleLinkByCode()}
                    className="font-mono tracking-widest uppercase max-w-[160px]"
                  />
                  <Button
                    onClick={handleLinkByCode}
                    disabled={linkByCode.isPending || !codeInput.trim()}
                    className="gap-1.5"
                  >
                    {linkByCode.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    Link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Instructors can find their link code on their Availability page.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Workflow 2: Invite via Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="w-4 h-4 text-primary" />
                Invite via Email
              </CardTitle>
              <CardDescription>
                Send a secure onboarding link to an instructor who doesn't have a Learner Log
                account yet. The link expires after 7 days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Instructor Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="instructor@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleInvite}
                    disabled={inviteByEmail.isPending || !emailInput.trim()}
                    className="gap-1.5"
                  >
                    {inviteByEmail.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>

              {/* Dev fallback: show invite URL if email wasn't sent */}
              {lastInviteUrl && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Email not sent — share this link manually
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-amber-900 break-all flex-1">{lastInviteUrl}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs h-7"
                      onClick={() => {
                        navigator.clipboard.writeText(lastInviteUrl);
                        toast({ title: "Link copied" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Active links ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="w-4 h-4 text-green-600" />
              Linked Instructors
              {activeLinks.length > 0 && (
                <Badge variant="secondary" className="text-xs">{activeLinks.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Instructors who are actively linked to your school account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : activeLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No linked instructors yet. Use the workflows above to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {activeLinks.map((link: any) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between rounded-md border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{link.instructorName}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.instructorEmail}</p>
                      {link.instructorLinkCode && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          Code: {link.instructorLinkCode}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <LinkStatusBadge status={link.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(link.id)}
                        disabled={revoking === link.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1.5 h-auto"
                        title="Revoke link"
                      >
                        {revoking === link.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Pending invites ──────────────────────────────────────────────── */}
        {(pendingInvites.length > 0 || inactiveLinks.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-amber-600" />
                Pending and Historical
              </CardTitle>
              <CardDescription>
                Invites waiting to be claimed, and previously active links that were revoked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingInvites.map((invite: any) => (
                <div
                  key={`invite-${invite.id}`}
                  className="flex items-center justify-between rounded-md border border-amber-100 bg-amber-50/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{invite.inviteeEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited via email · expires {new Date(invite.expiresAt).toLocaleDateString("en-AU")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <LinkStatusBadge status="pending" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                      disabled={revoking === invite.id}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 h-auto"
                      title="Cancel invite"
                    >
                      {revoking === invite.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}

              {inactiveLinks.map((link: any) => (
                <div
                  key={`link-${link.id}`}
                  className="flex items-center justify-between rounded-md border px-4 py-3 opacity-60"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{link.instructorName}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.instructorEmail}</p>
                  </div>
                  <LinkStatusBadge status={link.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
