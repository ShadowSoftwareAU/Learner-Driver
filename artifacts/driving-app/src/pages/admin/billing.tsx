import { CreditCard, FileText, TrendingUp, ExternalLink, Lock } from "lucide-react";
import { useGetMySubscription, useGetMyEntitlements } from "@workspace/api-client-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

// ─── Plan labels & colours ────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  independent: "Independent Instructor",
  school_base: "School – Base",
  school_pro: "School – Pro",
  enterprise: "Enterprise",
};

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  unpaid: "bg-orange-100 text-orange-800",
};

// ─── Subscription management (Owner/Manager only) ────────────────────────────

function SubscriptionSection() {
  const { data: subscription, isLoading: subLoading } = useGetMySubscription({
    query: { queryKey: ["/api/billing/subscription"] },
  });
  const { data: entitlements, isLoading: entLoading } = useGetMyEntitlements({
    query: { queryKey: ["/api/billing/entitlements"] },
  });

  if (subLoading || entLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading subscription…</span>
      </div>
    );
  }

  const planCode = subscription?.planCode ?? "free";
  const status = subscription?.status ?? "active";
  const planLabel = PLAN_LABELS[planCode] ?? planCode;
  const statusClass = STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-800";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription Plan</CardTitle>
          <CardDescription>Your active Learner Log subscription.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{planLabel}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass}`}>
              {status}
            </span>
          </div>
          {subscription?.renewalAt && (
            <p className="text-sm text-muted-foreground">
              Renews on{" "}
              {new Date(subscription.renewalAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          {subscription?.seatCount != null && (
            <p className="text-sm text-muted-foreground">
              {subscription.seatCount} seat{subscription.seatCount !== 1 ? "s" : ""} included
            </p>
          )}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled>
              Upgrade Plan
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
              Manage Billing
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stripe billing portal coming soon. Contact support to change your plan.
          </p>
        </CardContent>
      </Card>

      {entitlements && entitlements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Access</CardTitle>
            <CardDescription>Features enabled based on your current plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {entitlements.map(
                (e: { featureKey: string; isEnabled: boolean; source?: string }) => (
                  <li key={e.featureKey} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      {e.isEnabled ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-mono">{e.featureKey}</span>
                    </div>
                    {e.source && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {e.source}
                      </Badge>
                    )}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wide border-b">
                <th className="text-left pb-2">Plan</th>
                <th className="text-right pb-2">Price (AUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2">Viewer (parent/guardian)</td>
                <td className="py-2 text-right">Free</td>
              </tr>
              <tr>
                <td className="py-2">Independent Instructor</td>
                <td className="py-2 text-right">$29 / month</td>
              </tr>
              <tr>
                <td className="py-2">School – Base (up to 3 instructors)</td>
                <td className="py-2 text-right">$79 / month</td>
              </tr>
              <tr>
                <td className="py-2">Additional seat</td>
                <td className="py-2 text-right">$15 / seat / month</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Invoice history (all billing-access users) ───────────────────────────────

function InvoiceHistorySection() {
  // No real invoice data yet — clean empty state
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Invoice History</CardTitle>
        </div>
        <CardDescription>Past invoices and transaction records.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No invoices yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Your billing history will appear here once charges are processed
            through the Stripe billing portal.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Accounting integrations (placeholder cards) ──────────────────────────────

function AccountingIntegrationsSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Accounting Integrations</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your accounting software to automatically sync invoices,
        payments, and financial records.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Xero */}
        <Card className="border-2 border-dashed border-[#13B5EA]/30 hover:border-[#13B5EA]/60 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: "#13B5EA" }}
                >
                  <span className="text-white font-bold text-sm">X</span>
                </div>
                <CardTitle className="text-base">Xero</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <CardDescription>
              Sync invoices, payments, and contacts with Xero automatically.
              Eliminate double-entry and keep your books up to date.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="border-[#13B5EA]/30 text-[#0a7ba8]"
            >
              Connect Xero
              <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-50" />
            </Button>
          </CardFooter>
        </Card>

        {/* MYOB */}
        <Card className="border-2 border-dashed border-[#7B2D8B]/30 hover:border-[#7B2D8B]/60 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: "#7B2D8B" }}
                >
                  <span className="text-white font-bold text-xs">MYO</span>
                </div>
                <CardTitle className="text-base">MYOB</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <CardDescription>
              Push transactions directly to MYOB AccountRight or Essentials.
              Ideal for Australian-based schools already using MYOB.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="border-[#7B2D8B]/30 text-[#5a1e68]"
            >
              Connect MYOB
              <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-50" />
            </Button>
          </CardFooter>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        API integrations with Xero and MYOB are planned for a future release.
        Use the "Connect" buttons above to register your interest.
      </p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const adminPerms = useAdminPermissions();

  // Deny access if not master tier and doesn't have billing permission
  if (!adminPerms.isMasterTier && !adminPerms.canViewBilling) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-2">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              You don't have permission to view Billing & Finance.
            </p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Billing & Finance</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {adminPerms.isMasterTier
              ? "Manage your subscription, view invoices, and connect accounting software."
              : "View past invoices and connect accounting software."}
          </p>
          {!adminPerms.isMasterTier && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 w-fit">
              <Lock className="w-3.5 h-3.5" />
              Read-only view — subscription management requires Owner or Manager access.
            </div>
          )}
        </div>

        {/* Subscription — Owner/Manager only */}
        {adminPerms.isMasterTier && <SubscriptionSection />}

        {/* Invoice history — all billing-access users */}
        <InvoiceHistorySection />

        {/* Accounting integrations — all billing-access users */}
        <AccountingIntegrationsSection />
      </div>
    </SidebarLayout>
  );
}
