import { useListBookingChangeRequests, useReviewBookingChangeRequest } from "@workspace/api-client-react";
import type { BookingChangeRequest } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckSquare, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const QK = "/api/bookings/change-requests";

type ChangeRequest = BookingChangeRequest;

export default function BookingApprovals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: requests, isLoading } = useListBookingChangeRequests(
    { status: (statusFilter || undefined) as import("@workspace/api-client-react").ListBookingChangeRequestsStatus | undefined },
    { query: { queryKey: [QK, statusFilter] } },
  );

  const { mutate: review, isPending } = useReviewBookingChangeRequest({
    mutation: {
      onSuccess: () => {
        toast({ title: "Request reviewed" });
        qc.invalidateQueries({ queryKey: [QK] });
        setReviewing(null);
        setReviewNotes("");
      },
      onError: () => toast({ title: "Review failed", variant: "destructive" }),
    },
  });

  function act(decision: "approved" | "denied") {
    if (!reviewing) return;
    review({
      id: reviewing.id,
      data: { decision, reviewNotes: reviewNotes || undefined },
    });
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
    withdrawn: "bg-gray-100 text-gray-700",
  };

  const typeLabels: Record<string, string> = {
    cancel: "Cancellation",
    reschedule: "Reschedule",
    update: "Update",
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Booking Approvals</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Review student and instructor booking change requests.
          </p>
        </div>

        <div className="flex gap-1 flex-wrap">
          {["pending", "approved", "denied", "withdrawn", ""].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Change Requests{" "}
              {!isLoading && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({(requests ?? []).length})
                </span>
              )}
            </CardTitle>
            <CardDescription>Click a pending request to approve or deny it.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !requests || requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No requests found.
              </p>
            ) : (
              <ul className="divide-y">
                {requests.map((r: ChangeRequest) => (
                  <li
                    key={r.id}
                    className={`flex items-start justify-between py-3 ${
                      r.status === "pending"
                        ? "cursor-pointer hover:bg-muted/40 rounded px-2 -mx-2 transition-colors"
                        : ""
                    }`}
                    onClick={() => r.status === "pending" && setReviewing(r)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {typeLabels[r.requestType] ?? r.requestType} · Booking #{r.bookingId}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${
                            statusColors[r.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      {r.reason && (
                        <p className="text-xs text-muted-foreground">{r.reason}</p>
                      )}
                      {(r.requestedDate || r.requestedTime) && (
                        <p className="text-xs text-muted-foreground">
                          Requested: {r.requestedDate} {r.requestedTime}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {r.createdAt ? format(new Date(r.createdAt), "d MMM yyyy, h:mm a") : "—"} · User #{r.requestedByUserId}
                      </p>
                    </div>
                    {r.status === "pending" && (
                      <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0 ml-4 -rotate-90" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Request #{reviewing?.id}</DialogTitle>
            <DialogDescription>
              {reviewing && typeLabels[reviewing.requestType]} for Booking #{reviewing?.bookingId}
            </DialogDescription>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-3 text-sm">
              {reviewing.reason && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Reason</p>
                  <p className="mt-0.5">{reviewing.reason}</p>
                </div>
              )}
              {(reviewing.requestedDate || reviewing.requestedTime) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Requested new time
                  </p>
                  <p className="mt-0.5">
                    {reviewing.requestedDate} {reviewing.requestedTime}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                  Review notes (optional)
                </p>
                <Textarea
                  placeholder="Add a note for the requester…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => act("denied")}
              disabled={isPending}
              className="text-destructive border-destructive hover:bg-destructive/10"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Deny
            </Button>
            <Button
              onClick={() => act("approved")}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
