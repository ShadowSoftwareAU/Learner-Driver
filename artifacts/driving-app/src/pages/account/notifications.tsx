import { useGetNotificationPreferences, useUpdateNotificationPreferences } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QK = "/api/notifications/preferences";

export default function NotificationPreferencesPage() {
  const { toast } = useToast();
  const { data: prefs, isLoading } = useGetNotificationPreferences({
    query: { queryKey: [QK] },
  });
  const { mutate: patch } = useUpdateNotificationPreferences({
    mutation: {
      onSuccess: () => toast({ title: "Preferences saved" }),
      onError: () => toast({ title: "Failed to save preferences", variant: "destructive" }),
    },
  });

  function toggle(key: string, value: boolean) {
    patch({ data: { [key]: value } });
  }

  if (isLoading || !prefs) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const Row = ({
    id,
    label,
    description,
    checked,
  }: {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => toggle(id, v)}
      />
    </div>
  );

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Notification Preferences</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Control how and when DriveTrack contacts you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Channels</CardTitle>
            <CardDescription>Choose how you receive notifications.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row
              id="emailEnabled"
              label="Email notifications"
              description="Receive updates via email"
              checked={prefs.emailEnabled ?? true}
            />
            <Row
              id="pushEnabled"
              label="Push notifications"
              description="Browser and mobile push alerts"
              checked={prefs.pushEnabled ?? true}
            />
            <Row
              id="inAppEnabled"
              label="In-app notifications"
              description="Alerts inside the DriveTrack app"
              checked={prefs.inAppEnabled ?? true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Types</CardTitle>
            <CardDescription>Choose which events trigger notifications.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <Row
              id="bookingEmails"
              label="Booking confirmations"
              description="Emails when a lesson is booked, rescheduled, or cancelled"
              checked={prefs.bookingEmails ?? true}
            />
            <Row
              id="bookingPush"
              label="Booking push alerts"
              description="Push notifications for lesson reminders"
              checked={prefs.bookingPush ?? true}
            />
            <Row
              id="safeguardingAlerts"
              label="Safeguarding alerts"
              description="Critical alerts related to student welfare"
              checked={prefs.safeguardingAlerts ?? true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marketing</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row
              id="marketingEnabled"
              label="Product updates & tips"
              description="Occasional emails about new features and best practices"
              checked={prefs.marketingEnabled ?? false}
            />
          </CardContent>
        </Card>

        <Separator />
        <p className="text-xs text-muted-foreground">
          Safeguarding alerts cannot be fully disabled — they will still be delivered in-app
          regardless of channel settings.
        </p>
      </div>
    </SidebarLayout>
  );
}
