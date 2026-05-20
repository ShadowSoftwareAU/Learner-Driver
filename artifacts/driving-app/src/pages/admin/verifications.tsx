import { useState } from "react";
import { useListVerifications, useReviewVerification } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, badge: "secondary" as const, color: "text-amber-600" },
  approved: { label: "Approved", icon: CheckCircle2, badge: "default" as const, color: "text-green-600" },
  rejected: { label: "Rejected", icon: XCircle, badge: "destructive" as const, color: "text-red-600" },
  needs_revision: { label: "Needs Revision", icon: AlertTriangle, badge: "secondary" as const, color: "text-orange-600" },
};

type VerificationItem = {
  id: number;
  status: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewerNotes?: string | null;
  createdAt: string;
  instructorId: number;
  instructorName: string;
  instructorEmail: string;
  documents: Array<{ id: number; docType: string; fileName: string; objectPath: string; fileSize?: number | null }>;
};

function ReviewDialog({
  verification,
  onClose,
  onDone,
}: {
  verification: VerificationItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState(verification.reviewerNotes ?? "");
  const reviewVerification = useReviewVerification();
  const { toast } = useToast();

  const handleAction = (action: "approved" | "rejected" | "needs_revision") => {
    reviewVerification.mutate(
      { id: verification.id, data: { action, notes: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: `Application ${action.replace("_", " ")}`, description: `${verification.instructorName}'s application has been updated.` });
          onDone();
          onClose();
        },
        onError: () => {
          toast({ title: "Action failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Application</DialogTitle>
          <DialogDescription>{verification.instructorName} — {verification.instructorEmail}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Documents */}
          <div>
            <p className="text-sm font-medium mb-2">Submitted Documents</p>
            <div className="space-y-2">
              {verification.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{doc.fileName}</span>
                  <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                    {doc.docType.replace("_", " ")}
                  </Badge>
                  <a
                    href={`${BASE_URL}/api/storage${doc.objectPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </a>
                </div>
              ))}
              {verification.documents.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents submitted.</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Review Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for the instructor, e.g. which documents need to be corrected…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => handleAction("needs_revision")}
            disabled={reviewVerification.isPending}
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" /> Request Revision
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAction("rejected")}
            disabled={reviewVerification.isPending}
          >
            <XCircle className="w-4 h-4 mr-1.5" /> Reject
          </Button>
          <Button
            onClick={() => handleAction("approved")}
            disabled={reviewVerification.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {reviewVerification.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            )}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerificationRow({ item, onReview }: { item: VerificationItem; onReview: (v: VerificationItem) => void }) {
  const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-sm">{item.instructorName}</p>
              <Badge variant={cfg.badge} className="text-xs flex items-center gap-1">
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{item.instructorEmail}</p>
            {item.submittedAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Submitted {format(new Date(item.submittedAt), "d MMM yyyy")}
              </p>
            )}
            {item.reviewerNotes && (
              <p className="text-xs text-muted-foreground mt-1 italic truncate">Note: {item.reviewerNotes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground">{item.documents.length} doc{item.documents.length !== 1 ? "s" : ""}</span>
            <Button size="sm" variant="outline" onClick={() => onReview(item)}>
              Review
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminVerifications() {
  const { data, isLoading, refetch } = useListVerifications({ query: { queryKey: ["/api/admin/verifications"] } });
  const [reviewing, setReviewing] = useState<VerificationItem | null>(null);

  const all = (data ?? []) as VerificationItem[];
  const byStatus = {
    pending: all.filter((v) => v.status === "pending"),
    approved: all.filter((v) => v.status === "approved"),
    rejected: all.filter((v) => ["rejected", "needs_revision"].includes(v.status)),
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary" />
              Instructor Verifications
            </h1>
            <p className="text-muted-foreground mt-1">Review and approve instructor credential applications.</p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <p className="text-2xl font-bold text-amber-700">{byStatus.pending.length}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <p className="text-2xl font-bold text-green-700">{byStatus.approved.length}</p>
              <p className="text-xs text-green-600">Approved</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending <Badge variant="secondary" className="ml-1.5">{byStatus.pending.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved <Badge variant="secondary" className="ml-1.5">{byStatus.approved.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected / Revision <Badge variant="secondary" className="ml-1.5">{byStatus.rejected.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {(["pending", "approved", "rejected"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
                {byStatus[tab].length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                    No applications in this category.
                  </div>
                ) : (
                  byStatus[tab].map((item) => (
                    <VerificationRow key={item.id} item={item} onReview={setReviewing} />
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {reviewing && (
        <ReviewDialog
          verification={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => refetch()}
        />
      )}
    </SidebarLayout>
  );
}
