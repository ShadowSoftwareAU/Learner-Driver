import { useGetDemoStatus, useResetDemoData } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FlaskConical, RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const scopeDescriptions: Record<string, string> = {
  full_demo: "Wipes all demo data and re-seeds a fresh set of students, assessments, and bookings.",
  bookings_only: "Clears only booking data; students and assessments remain.",
  students_only: "Clears only student records and their assessments.",
};

export default function DemoManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scope, setScope] = useState("full_demo");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const { data: status, isLoading } = useGetDemoStatus({
    query: { queryKey: ["/api/demo/status"] },
  });

  const { mutate: resetDemoData, isPending } = useResetDemoData({
    mutation: {
      onSuccess: (result) => {
        toast({
          title: "Demo reset complete",
          description: `Scope: ${result.scope}`,
        });
        qc.invalidateQueries();
        setConfirming(false);
        setNotes("");
      },
      onError: () => {
        toast({ title: "Reset failed", variant: "destructive" });
        setConfirming(false);
      },
    },
  });

  function handleReset() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    resetDemoData({ data: { resetScope: scope as "full_demo" | "bookings_only" | "students_only", notes: notes || undefined } });
  }

  if (isLoading || !status) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Demo Management</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Control the demo environment and seed data for presentations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demo Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Demo mode</span>
              <Badge
                className={
                  status.demoModeEnabled
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700"
                }
              >
                {status.demoModeEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            {status.demoSchoolId != null && (
              <p className="text-sm text-muted-foreground">
                Demo school ID: <span className="font-mono">{status.demoSchoolId}</span>
              </p>
            )}
            {status.lastReset && typeof status.lastReset === "object" && (status.lastReset as { completedAt?: string }).completedAt && (
              <p className="text-sm text-muted-foreground">
                Last reset:{" "}
                {new Date((status.lastReset as { completedAt: string }).completedAt).toLocaleString("en-AU")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reset Demo Data</CardTitle>
            <CardDescription>
              This re-seeds the demo environment with fresh placeholder data.
              <strong className="text-foreground"> This is destructive and cannot be undone.</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Reset scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_demo">Full demo reset</SelectItem>
                  <SelectItem value="bookings_only">Bookings only</SelectItem>
                  <SelectItem value="students_only">Students only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{scopeDescriptions[scope]}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Why are you resetting? (internal log)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {confirming && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <AlertTriangle className="w-4 h-4 text-yellow-700 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  Are you sure? This will{" "}
                  <strong>permanently delete</strong> demo data matching the selected scope. Click
                  again to confirm.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleReset}
                disabled={isPending}
                className={confirming ? "bg-red-600 hover:bg-red-700 text-white" : ""}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                {confirming ? "Confirm Reset" : "Reset Demo Data"}
              </Button>
              {confirming && (
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
