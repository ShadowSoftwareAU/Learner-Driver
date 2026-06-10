import { useGetMySubscription, useGetMyEntitlements } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2, XCircle } from "lucide-react";

const planLabels: Record<string, string> = {
  free: "Free",
  independent: "Independent Instructor",
  school_base: "School – Base",
  school_pro: "School – Pro",
  enterprise: "Enterprise",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  unpaid: "bg-orange-100 text-orange-800",
};

export default function BillingPage() {
  const { data: subscription, isLoading: subLoading } = useGetMySubscription({
    query: { queryKey: ["/api/billing/subscription"] },
  });
  const { data: entitlements, isLoading: entLoading } = useGetMyEntitlements({
    query: { queryKey: ["/api/billing/entitlements"] },
  });

  const isLoading = subLoading || entLoading;

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const planCode = subscription?.planCode ?? "free";
  const status = subscription?.status ?? "active";
  const planLabel = planLabels[planCode] ?? planCode;
  const statusColor = statusColors[status] ?? "bg-gray-100 text-gray-800";

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Billing & Plan</h1>
          </div>
          <p className="text-muted-foreground mt-1">Manage your Learner Log subscription.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Plan</CardTitle>
            <CardDescription>Your active subscription details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg">{planLabel}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor}`}>
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

            <div className="pt-2 border-t flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Upgrade Plan
              </Button>
              <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
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
              <CardDescription>
                Features enabled for your account based on plan and promotions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {entitlements.map((e: { featureKey: string; isEnabled: boolean; source?: string }) => (
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
                ))}
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
    </SidebarLayout>
  );
}
