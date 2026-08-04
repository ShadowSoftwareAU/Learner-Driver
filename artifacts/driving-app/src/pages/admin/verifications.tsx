import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVerifications,
  useReviewVerification,
  useReviewVerificationDocument,
  useGetExpiringDocuments,
  useUpdateInstructorWwcc,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, ExternalLink,
  ShieldCheck, ChevronDown, ChevronUp, ScanLine, ShieldAlert, Calendar, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Status configs ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, badge: "secondary" as const, color: "text-amber-600" },
  approved: { label: "Approved", icon: CheckCircle2, badge: "default" as const, color: "text-green-600" },
  rejected: { label: "Rejected", icon: XCircle, badge: "destructive" as const, color: "text-red-600" },
  needs_revision: { label: "Needs Revision", icon: AlertTriangle, badge: "secondary" as const, color: "text-orange-600" },
};

const WWCC_STATUS_CONFIG = {
  valid: { label: "Valid", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  restricted: { label: "RESTRICTED", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  expired: { label: "Expired", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  not_checked: { label: "Not Checked", color: "text-muted-foreground", bg: "bg-muted border-border" },
};

const DOC_STATUS_CONFIG = {
  approved: { label: "Approved", variant: "default" as const },
  rejected: { label: "Rejected", variant: "destructive" as const },
  needs_revision: { label: "Needs Revision", variant: "secondary" as const },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationDoc = {
  id: number;
  docType: string;
  fileName: string;
  objectPath: string;
  fileSize?: number | null;
  expiresAt?: string | null;
  docStatus?: string | null;
  docReviewNotes?: string | null;
  docReviewedAt?: string | null;
  ocrStatus?: string | null;
  ocrData?: Record<string, unknown> | null;
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
  wwccStatus?: string | null;
  wwccNumber?: string | null;
  wwccExpiresAt?: string | null;
  documents: VerificationDoc[];
};

type ExpiringDoc = {
  id: number;
  verificationId: number;
  docType: string;
  fileName: string;
  objectPath: string;
  uploadedAt: string;
  expiresAt: string;
  instructorId: number;
  instructorName: string;
  instructorEmail: string;
  daysUntilExpiry: number;
};

// ── OCR data panel ────────────────────────────────────────────────────────────

function humaniseKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function OcrPanel({ ocrStatus, ocrData }: { ocrStatus?: string | null; ocrData?: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);

  if (!ocrStatus || ocrStatus === "processing") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5 pl-1">
        <Loader2 className="w-3 h-3 animate-spin" /> AI scan in progress
      </div>
    );
  }
  if (ocrStatus === "skipped") {
    return <p className="text-xs text-muted-foreground mt-1.5 pl-1">PDF: review manually</p>;
  }
  if (ocrStatus === "failed") {
    return <p className="text-xs text-amber-600 mt-1.5 pl-1">Scan failed, review manually</p>;
  }
  if (ocrStatus === "done" && ocrData) {
    const entries = Object.entries(ocrData).filter(([, v]) => v != null && v !== "");
    if (entries.length === 0) return null;
    return (
      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ScanLine className="w-3 h-3" />
          AI extracted data
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {open && (
          <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/50 border px-3 py-2">
            {entries.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-xs text-muted-foreground truncate">{humaniseKey(k)}</dt>
                <dd className="text-xs font-medium truncate">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }
  return null;
}

// ── Per-document inline review ────────────────────────────────────────────────

function DocReviewRow({
  doc,
  verificationId,
  onUpdated,
}: {
  doc: VerificationDoc;
  verificationId: number;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<"approved" | "rejected" | "needs_revision">("approved");
  const [notes, setNotes] = useState(doc.docReviewNotes ?? "");
  const reviewDoc = useReviewVerificationDocument();
  const { toast } = useToast();

  const handleSave = () => {
    reviewDoc.mutate(
      { id: verificationId, docId: doc.id, data: { action, notes: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Document updated" });
          setExpanded(false);
          onUpdated();
        },
        onError: () => toast({ title: "Failed to update document", variant: "destructive" }),
      }
    );
  };

  const docStatusCfg = doc.docStatus ? DOC_STATUS_CONFIG[doc.docStatus as keyof typeof DOC_STATUS_CONFIG] : null;

  return (
    <div className="rounded-md border text-sm">
      <div className="flex items-center gap-2 p-2.5">
        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 truncate">{doc.fileName}</span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {doc.expiresAt && (() => {
            const days = Math.ceil((new Date(doc.expiresAt + "T00:00:00").getTime() - Date.now()) / 86400000);
            const expired = days < 0;
            const soon = days <= 30;
            return (
              <span className={`text-xs flex items-center gap-0.5 ${expired ? "text-red-600 font-medium" : soon ? "text-amber-600" : "text-muted-foreground"}`}>
                <Calendar className="w-3 h-3" />
                {expired ? `Exp. ${Math.abs(days)}d ago` : `Exp. ${days}d`}
              </span>
            );
          })()}
          <Badge variant="outline" className="text-xs capitalize">
            {doc.docType.replace(/_/g, " ")}
          </Badge>
          {docStatusCfg && (
            <Badge variant={docStatusCfg.variant} className="text-xs">{docStatusCfg.label}</Badge>
          )}
        </div>

        <a href={`${BASE_URL}/api/storage${doc.objectPath}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
        </a>
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          className="flex-shrink-0 text-muted-foreground hover:text-primary"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <OcrPanel ocrStatus={doc.ocrStatus} ocrData={doc.ocrData as Record<string, unknown> | null} />

      {expanded && (
        <div className="border-t px-2.5 pb-2.5 pt-2 space-y-2 bg-muted/30">
          <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved" className="text-xs">Approve this document</SelectItem>
              <SelectItem value="needs_revision" className="text-xs">Flag for revision</SelectItem>
              <SelectItem value="rejected" className="text-xs">Reject this document</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for this document (optional)"
            rows={2}
            className="text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)} className="h-7 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={reviewDoc.isPending} className="h-7 text-xs">
              {reviewDoc.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WWCC status panel ─────────────────────────────────────────────────────────

function WwccPanel({
  instructorId,
  current,
  onUpdated,
}: {
  instructorId: number;
  current: { wwccStatus?: string | null; wwccNumber?: string | null; wwccExpiresAt?: string | null };
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string>(current.wwccStatus ?? "not_checked");
  const [number, setNumber] = useState(current.wwccNumber ?? "");
  const [expiry, setExpiry] = useState(current.wwccExpiresAt ?? "");
  const updateWwcc = useUpdateInstructorWwcc();
  const { toast } = useToast();

  const cfg = WWCC_STATUS_CONFIG[status as keyof typeof WWCC_STATUS_CONFIG] ?? WWCC_STATUS_CONFIG.not_checked;

  const handleSave = () => {
    updateWwcc.mutate(
      {
        instructorId,
        data: {
          wwccStatus: status as "valid" | "restricted" | "expired" | "not_checked",
          wwccNumber: number || null,
          wwccExpiresAt: expiry || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "WWCC status updated" });
          setEditing(false);
          onUpdated();
        },
        onError: () => toast({ title: "Failed to update WWCC status", variant: "destructive" }),
      }
    );
  };

  return (
    <div className={`rounded-md border p-3 ${status === "restricted" ? "bg-red-50 border-red-300" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {status === "restricted" ? (
            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-sm font-medium">Working With Children Check</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing((o) => !o)} className="h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" /> Update
        </Button>
      </div>

      {(current.wwccNumber || current.wwccExpiresAt) && !editing && (
        <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground pl-6">
          {current.wwccNumber && <span>Card: {current.wwccNumber}</span>}
          {current.wwccExpiresAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Exp. {new Date(current.wwccExpiresAt + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2 pl-6">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valid" className="text-xs">Valid</SelectItem>
                  <SelectItem value="restricted" className="text-xs text-red-600 font-medium">Restricted</SelectItem>
                  <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                  <SelectItem value="not_checked" className="text-xs">Not Checked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Expiry Date</Label>
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Card Number</Label>
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="e.g. WWC1234567E"
              className="h-7 text-xs"
            />
          </div>
          {status === "restricted" && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              Marking as Restricted will flag this instructor across the system. Ensure this is correct before saving.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={updateWwcc.isPending} className="h-7 text-xs">
              {updateWwcc.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Review dialog ─────────────────────────────────────────────────────────────

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
          toast({ title: `Application ${action.replace(/_/g, " ")}`, description: `${verification.instructorName}'s application has been updated.` });
          onDone();
          onClose();
        },
        onError: () => toast({ title: "Action failed", description: "Please try again.", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Application</DialogTitle>
          <DialogDescription>{verification.instructorName}, {verification.instructorEmail}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* WWCC status */}
          <WwccPanel
            instructorId={verification.instructorId}
            current={{ wwccStatus: verification.wwccStatus, wwccNumber: verification.wwccNumber, wwccExpiresAt: verification.wwccExpiresAt }}
            onUpdated={onDone}
          />

          {/* Documents with inline per-doc review */}
          <div>
            <p className="text-sm font-medium mb-2">
              Submitted Documents
              <span className="text-xs text-muted-foreground font-normal ml-1.5">— expand a document to review it individually</span>
            </p>
            <div className="space-y-2">
              {verification.documents.map((doc) => (
                <DocReviewRow key={doc.id} doc={doc} verificationId={verification.id} onUpdated={onDone} />
              ))}
              {verification.documents.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents submitted.</p>
              )}
            </div>
          </div>

          {/* Overall application notes */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Application Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for the instructor, e.g. which documents need to be corrected."
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
            {reviewVerification.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Expiring documents tab ────────────────────────────────────────────────────

function ExpiringDocsTab() {
  const { data, isLoading, refetch } = useGetExpiringDocuments({ query: { queryKey: ["/api/admin/compliance/expiring"] } });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const docs = (data ?? []) as ExpiringDoc[];

  if (docs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
        No documents expiring in the next 30 days.
      </div>
    );
  }

  // Group by instructor
  const byInstructor = docs.reduce(
    (acc, doc) => {
      if (!acc[doc.instructorId]) {
        acc[doc.instructorId] = { instructorId: doc.instructorId, instructorName: doc.instructorName, instructorEmail: doc.instructorEmail, docs: [] };
      }
      acc[doc.instructorId].docs.push(doc);
      return acc;
    },
    {} as Record<number, { instructorId: number; instructorName: string; instructorEmail: string; docs: ExpiringDoc[] }>
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""} expiring across {Object.keys(byInstructor).length} instructor{Object.keys(byInstructor).length !== 1 ? "s" : ""}.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {Object.values(byInstructor).map((group) => (
        <Card key={group.instructorId}>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{group.instructorName}</p>
              <span className="text-xs text-muted-foreground">{group.instructorEmail}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {group.docs.map((doc) => {
              const expired = doc.daysUntilExpiry < 0;
              const urgent = !expired && doc.daysUntilExpiry <= 7;
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-2 text-sm p-2.5 rounded-md ${
                    expired ? "bg-red-50 border border-red-200"
                    : urgent ? "bg-amber-50 border border-amber-200"
                    : "border"
                  }`}
                >
                  <FileText className={`w-4 h-4 flex-shrink-0 ${expired ? "text-red-500" : urgent ? "text-amber-500" : "text-muted-foreground"}`} />
                  <span className="truncate flex-1">{doc.fileName}</span>
                  <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                    {doc.docType.replace(/_/g, " ")}
                  </Badge>
                  <span className={`text-xs font-semibold flex-shrink-0 flex items-center gap-1 ${expired ? "text-red-600" : urgent ? "text-amber-600" : "text-muted-foreground"}`}>
                    <Calendar className="w-3 h-3" />
                    {expired
                      ? `Expired ${Math.abs(doc.daysUntilExpiry)}d ago`
                      : doc.daysUntilExpiry === 0
                      ? "Expires today"
                      : `${doc.daysUntilExpiry}d remaining`}
                  </span>
                  <a href={`${BASE_URL}/api/storage${doc.objectPath}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </a>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Verification row ──────────────────────────────────────────────────────────

function VerificationRow({ item, onReview }: { item: VerificationItem; onReview: (v: VerificationItem) => void }) {
  const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const wwccRestricted = item.wwccStatus === "restricted";
  const wwccExpired = item.wwccStatus === "expired";

  return (
    <Card className={`hover:border-primary/40 transition-colors ${wwccRestricted ? "border-red-300" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-semibold text-sm">{item.instructorName}</p>
              <Badge variant={cfg.badge} className="text-xs flex items-center gap-1">
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </Badge>
              {wwccRestricted && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> WWCC Restricted
                </Badge>
              )}
              {wwccExpired && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-200">
                  <ShieldCheck className="w-3 h-3" /> WWCC Expired
                </Badge>
              )}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminVerifications() {
  const { data, isLoading, refetch } = useListVerifications({ query: { queryKey: ["/api/admin/verifications"] } });
  const { data: expiringData } = useGetExpiringDocuments({ query: { queryKey: ["/api/admin/compliance/expiring"] } });
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<VerificationItem | null>(null);

  const all = (data ?? []) as VerificationItem[];
  const byStatus = {
    pending: all.filter((v) => v.status === "pending"),
    approved: all.filter((v) => v.status === "approved"),
    rejected: all.filter((v) => ["rejected", "needs_revision"].includes(v.status)),
  };

  const expiringCount = ((expiringData ?? []) as ExpiringDoc[]).length;
  const expiredCount = ((expiringData ?? []) as ExpiringDoc[]).filter((d) => d.daysUntilExpiry < 0).length;

  const handleDone = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance/expiring"] });
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary" />
              Instructor Verifications
            </h1>
            <p className="text-muted-foreground mt-1">Review credentials, manage WWCC status, and track expiring documents.</p>
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
            {expiringCount > 0 && (
              <div className={`border rounded-lg px-4 py-2 ${expiredCount > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`text-2xl font-bold ${expiredCount > 0 ? "text-red-700" : "text-amber-700"}`}>{expiringCount}</p>
                <p className={`text-xs ${expiredCount > 0 ? "text-red-600" : "text-amber-600"}`}>Expiring</p>
              </div>
            )}
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
              <TabsTrigger value="expiring" className={expiringCount > 0 ? "text-amber-600" : ""}>
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                Expiring
                {expiringCount > 0 && (
                  <Badge variant="secondary" className={`ml-1.5 ${expiredCount > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {expiringCount}
                  </Badge>
                )}
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

            <TabsContent value="expiring">
              <ExpiringDocsTab />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {reviewing && (
        <ReviewDialog
          verification={reviewing}
          onClose={() => setReviewing(null)}
          onDone={handleDone}
        />
      )}
    </SidebarLayout>
  );
}
