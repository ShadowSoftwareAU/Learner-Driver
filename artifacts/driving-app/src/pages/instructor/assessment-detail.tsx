import { useState } from "react";
import { useGetAssessment, getGetAssessmentQueryKey, useApproveAssessment, useSubmitAssessment } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronLeft, CheckCircle2, MessageSquare, Eye, Send, AlertCircle, Mail, X, Plus, Car, Bike, Truck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportPreview } from "@/components/ReportPreview";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPETENCY_CLASS: Record<string, string> = {
  mastered:      "bg-green-100 text-green-800 border-green-200",
  practiced:     "bg-yellow-100 text-yellow-800 border-yellow-200",
  attempted:     "bg-red-100 text-red-800 border-red-200",
  not_attempted: "bg-gray-100 text-gray-800 border-gray-200",
};

const FINALIZATION_BANNER: Record<string, { bg: string; border: string; icon: React.ReactNode; label: string; description: string }> = {
  draft: {
    bg: "bg-gray-50", border: "border-gray-200",
    icon: <AlertCircle className="w-4 h-4 text-gray-500" />,
    label: "Draft",
    description: "This assessment has not been submitted for review yet.",
  },
  pending_approval: {
    bg: "bg-amber-50", border: "border-amber-200",
    icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
    label: "Pending Your Approval",
    description: "Review the report below, then approve and dispatch it to the student.",
  },
  approved: {
    bg: "bg-green-50", border: "border-green-200",
    icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    label: "Approved",
    description: "This assessment has been approved.",
  },
  dispatched: {
    bg: "bg-teal-50", border: "border-teal-100",
    icon: <Mail className="w-4 h-4 text-teal-600" />,
    label: "Report Dispatched",
    description: "The report has been approved and dispatched.",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ViewAssessment() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: assessment, isLoading } = useGetAssessment(id, {
    query: { enabled: !!id, queryKey: getGetAssessmentQueryKey(id) },
  });

  const approveAssessment = useApproveAssessment();
  const submitAssessment = useSubmitAssessment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAssessmentQueryKey(id) });
        toast({ title: "Assessment submitted", description: "Ready for approval and dispatch." });
      },
      onError: () => toast({ title: "Failed to submit assessment", variant: "destructive" }),
    },
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);

  const combinedNotes = useMemo(() => {
    if (!assessment?.maneuverResults) return "";
    return assessment.maneuverResults
      .filter((r: any) => r.notes)
      .map((r: any) => `${r.maneuverName || "Maneuver"}: ${r.notes}`)
      .join("\n");
  }, [assessment]);

  const finStatus = (assessment as any)?.finalizationStatus ?? "draft";
  const banner = FINALIZATION_BANNER[finStatus] ?? FINALIZATION_BANNER.draft;

  const dispatchEmails: string[] = useMemo(() => {
    const raw = (assessment as any)?.reportDispatchedTo;
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }, [assessment]);

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (emails.includes(trimmed)) { setEmailInput(""); return; }
    setEmails(prev => [...prev, trimmed]);
    setEmailInput("");
  };

  const removeEmail = (e: string) => setEmails(prev => prev.filter(x => x !== e));

  const handleApprove = async () => {
    try {
      await approveAssessment.mutateAsync({ id, data: { dispatchEmails: emails } });
      qc.invalidateQueries({ queryKey: getGetAssessmentQueryKey(id) });
      setApproveOpen(false);
      toast({ title: "Report dispatched", description: emails.length > 0 ? `Sent to ${emails.join(", ")}` : "Assessment approved." });
    } catch {
      toast({ title: "Failed to approve assessment", variant: "destructive" });
    }
  };

  if (isLoading || !assessment) {
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
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Back nav */}
        <div className="flex items-center gap-2">
          <Link href={`/instructor/students/${assessment.studentId}`}>
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Student
            </Button>
          </Link>
        </div>

        {/* Header row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assessment Record</h1>
            <p className="text-muted-foreground">
              {format(new Date(assessment.lessonDate), "PPP")} &bull; {assessment.durationMinutes} mins
              {assessment.studentName && <> &bull; {assessment.studentName}</>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {(assessment.status as string).replace("_", " ")}
            </Badge>
            {/* Assessment program type badge */}
            {(() => {
              const type = (assessment as any).assessmentType ?? "qsafe";
              const cfg: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
                qsafe:         { label: "QSAFE",        icon: <Car  className="w-3.5 h-3.5" />, className: "border-blue-200 bg-blue-50 text-blue-800" },
                qride:         { label: "Q-Ride",       icon: <Bike className="w-3.5 h-3.5" />, className: "border-purple-200 bg-purple-50 text-purple-800" },
                heavy_vehicle: { label: "Heavy Vehicle", icon: <Truck className="w-3.5 h-3.5" />, className: "border-orange-200 bg-orange-50 text-orange-800" },
              };
              const c = cfg[type] ?? cfg.qsafe;
              return (
                <Badge variant="outline" className={`flex items-center gap-1.5 text-sm px-3 py-1 ${c.className}`}>
                  {c.icon}{c.label}
                </Badge>
              );
            })()}
            {/* Preview report button — always available once there are results */}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewOpen(true)}>
              <Eye className="w-4 h-4" /> Preview Report
            </Button>
            {/* Submit button — draft only */}
            {finStatus === "draft" && (
              <Button
                size="sm"
                className="gap-2"
                disabled={submitAssessment.isPending}
                onClick={() => submitAssessment.mutate({ id })}
              >
                {submitAssessment.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                Submit Assessment
              </Button>
            )}
            {/* Approve button — only when pending */}
            {finStatus === "pending_approval" && (
              <Button size="sm" className="gap-2" onClick={() => setApproveOpen(true)}>
                <Send className="w-4 h-4" /> Approve & Dispatch
              </Button>
            )}
          </div>
        </div>

        {/* Finalization status banner */}
        <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${banner.bg} ${banner.border}`}>
          {banner.icon}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{banner.label}</p>
            <p className="text-sm text-muted-foreground">{banner.description}</p>
            {finStatus === "dispatched" && dispatchEmails.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Dispatched to: {dispatchEmails.join(", ")}
                {(assessment as any).reportDispatchedAt && (
                  <> on {format(new Date((assessment as any).reportDispatchedAt), "d MMM yyyy 'at' HH:mm")}</>
                )}
              </p>
            )}
          </div>
          
          {finStatus === "pending_approval" && (
            <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setApproveOpen(true)}>
              <Send className="w-3.5 h-3.5" /> Approve
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lesson Notes */}
          <Card className="col-span-full">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle>Lesson Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Confidence & Overall Notes
                </h4>
                <p className="text-foreground bg-gray-50/50 p-4 rounded-md border border-border min-h-24 whitespace-pre-wrap">
                  {assessment.confidenceNote || (
                    <span className="text-muted-foreground italic">No notes provided.</span>
                  )}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Focus Areas for Next Lesson
                </h4>
                <p className="text-foreground bg-gray-50/50 p-4 rounded-md border border-border min-h-16 whitespace-pre-wrap">
                  {assessment.focusAreasNext || (
                    <span className="text-muted-foreground italic">No focus areas provided.</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Maneuver Results */}
          <Card className="col-span-full">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle>Maneuver Results</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {assessment.maneuverResults && assessment.maneuverResults.length > 0 ? (
                <div className="space-y-2">
                  {assessment.maneuverResults.map((result: any) => (
                    <div key={result.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{result.maneuverName}</span>
                        <Badge
                          variant="outline"
                          className={COMPETENCY_CLASS[result.competencyLevel] ?? COMPETENCY_CLASS.not_attempted}
                        >
                          {({ not_attempted: "Not Attempted", attempted: "Developing", practiced: "Competent", mastered: "Consistent Skills" } as Record<string, string>)[result.competencyLevel] ?? result.competencyLevel.replace("_", " ")}
                        </Badge>
                      </div>
                      {result.notes && (
                        <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                          <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>{result.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p>No maneuvers were explicitly rated during this assessment.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {combinedNotes && (
            <Card className="col-span-full">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle>Combined Maneuver Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-foreground bg-gray-50/50 p-4 rounded-md border border-border whitespace-pre-wrap text-sm">
                  {combinedNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Report Preview Sheet ────────────────────────────────────────────── */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-white shrink-0">
            <SheetTitle>Report Preview</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 overflow-auto">
            <div className="px-6 py-4">
              <ReportPreview assessment={assessment as any} compact />
            </div>
          </ScrollArea>
          <div className="px-6 py-4 border-t bg-white shrink-0 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(`${import.meta.env.BASE_URL}instructor/assessments/${assessment.id}/print`, "_blank")}
            >
              <Download className="w-4 h-4" /> Download PDF
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
              {finStatus === "pending_approval" && (
                <Button
                  className="gap-2"
                  onClick={() => { setPreviewOpen(false); setApproveOpen(true); }}
                >
                  <Send className="w-4 h-4" /> Approve & Dispatch
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Approve & Dispatch Dialog ───────────────────────────────────────── */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve & Dispatch Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will mark the assessment as approved. Optionally add email addresses to record who the report was sent to.
            </p>

            <div className="space-y-2">
              <Label>Dispatch email recipients (optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addEmail}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {emails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {emails.map(email => (
                    <Badge key={email} variant="secondary" className="gap-1.5 pr-1">
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {emails.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No recipients added — the approval will be recorded without email dispatch.
                </p>
              )}
            </div>

            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
              <strong>Note:</strong> This action cannot be undone. The assessment will be locked after approval.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button
              onClick={handleApprove}
              disabled={approveAssessment.isPending}
              className="gap-2"
            >
              {approveAssessment.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
              Approve & Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
