import { useGetModerationCase, useUpdateModerationCase } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldAlert, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function ModerationCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [resolution, setResolution] = useState("");

  const { data: mc, isLoading, refetch } = useGetModerationCase(Number(id), {
    query: { queryKey: ["/api/moderation/cases", id] },
  });

  const { mutate: update, isPending } = useUpdateModerationCase({
    mutation: {
      onSuccess: () => {
        toast({ title: "Case updated" });
        refetch();
      },
      onError: () => toast({ title: "Failed to update case", variant: "destructive" }),
    },
  });

  function act(status: "open" | "under_review" | "escalated" | "released" | "closed") {
    update({ id: Number(id), data: { status, reviewOutcome: resolution || undefined } });
  }

  if (isLoading || !mc) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const isResolved = ["resolved", "dismissed"].includes(mc.status);

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/super-admin/moderation")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Case #{mc.id}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${severityColors[mc.severity] ?? "bg-gray-100 text-gray-700"}`}>
                {mc.severity}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {mc.contentType?.replace(/_/g, " ")} · Opened {mc.createdAt ? format(new Date(mc.createdAt), "d MMM yyyy") : "—"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Case Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                <p className="font-medium capitalize mt-0.5">{mc.status?.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Severity</p>
                <p className="font-medium capitalize mt-0.5">{mc.severity}</p>
              </div>
              {mc.actorUserId && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Actor</p>
                  <p className="font-medium mt-0.5">User #{mc.actorUserId}</p>
                </div>
              )}
              {mc.targetUserId && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Target User</p>
                  <p className="font-medium mt-0.5">User #{mc.targetUserId}</p>
                </div>
              )}
              {mc.reviewedByUserId && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Reviewed By</p>
                  <p className="font-medium mt-0.5">User #{mc.reviewedByUserId}</p>
                </div>
              )}
            </div>
            {mc.rawExcerpt && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Excerpt</p>
                <p className="mt-0.5 whitespace-pre-wrap">{mc.rawExcerpt}</p>
              </div>
            )}
            {mc.reviewOutcome && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Review Outcome</p>
                <p className="mt-0.5 whitespace-pre-wrap">{mc.reviewOutcome}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {mc.events && mc.events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {mc.events.map((ev) => (
                  <li key={ev.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium capitalize">{ev.eventType?.replace(/_/g, " ")}</p>
                      {ev.payloadJson && (
                        <p className="text-muted-foreground text-xs">
                          {typeof ev.payloadJson === "string" ? ev.payloadJson : JSON.stringify(ev.payloadJson)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {ev.createdAt ? format(new Date(ev.createdAt), "d MMM yyyy, h:mm a") : "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!isResolved && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Take Action</CardTitle>
              <CardDescription>Add resolution notes and update the case status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Resolution notes (optional)…"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => act("under_review")}
                  disabled={isPending}
                  variant="outline"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Mark Under Review
                </Button>
                <Button
                  size="sm"
                  onClick={() => act("escalated")}
                  disabled={isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                  Escalate
                </Button>
                <Button
                  size="sm"
                  onClick={() => act("closed")}
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => act("released")}
                  disabled={isPending}
                  variant="outline"
                  className="text-muted-foreground"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Release
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
