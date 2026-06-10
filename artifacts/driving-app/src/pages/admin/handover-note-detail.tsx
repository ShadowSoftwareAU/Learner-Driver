import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useListAdminHandoverNotes, useReviewHandoverNote, useGetHandoverNoteReview } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Flag, ArrowLeft, User, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const verdictOptions = [
  { value: "approved", label: "Approve", icon: CheckCircle2, className: "border-green-500 text-green-700 bg-green-50 hover:bg-green-100" },
  { value: "needs_improvement", label: "Needs Improvement", icon: AlertTriangle, className: "border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100" },
  { value: "flagged", label: "Flag for Follow-up", icon: Flag, className: "border-red-500 text-red-700 bg-red-50 hover:bg-red-100" },
];

export default function HandoverNoteDetail() {
  const [, params] = useRoute("/admin/handover-notes/:id");
  const [, setLocation] = useLocation();
  const noteId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedVerdict, setSelectedVerdict] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");

  const QK = ["/api/admin/handover-notes", "all", "all", 0];

  // Fetch the list to get note detail (notes list includes full content)
  const { data: listData, isLoading } = useListAdminHandoverNotes(
    { limit: 200, offset: 0 } as any,
    { query: { queryKey: QK } }
  );

  const { mutate: submitReview, isPending } = useReviewHandoverNote({
    mutation: {
      onSuccess: () => {
        toast({ title: "Review saved" });
        qc.invalidateQueries({ queryKey: QK });
      },
      onError: () => toast({ title: "Failed to save review", variant: "destructive" }),
    },
  });

  const note = listData?.items?.find(n => n.id === noteId);

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!note) {
    return (
      <SidebarLayout>
        <div className="text-center py-16 text-muted-foreground">Note not found.</div>
      </SidebarLayout>
    );
  }

  const currentReview = note.review;

  function handleSubmit() {
    if (!selectedVerdict) {
      toast({ title: "Please select a verdict", variant: "destructive" }); return;
    }
    submitReview({
      id: noteId,
      data: { verdict: selectedVerdict as any, reviewComment: reviewComment || undefined },
    });
  }

  return (
    <SidebarLayout>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/handover-notes")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Note Review</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(note.createdAt), "EEEE d MMMM yyyy")}</p>
          </div>
        </div>

        {/* Note content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">Handover Note</CardTitle>
              {note.isSafetyCritical && (
                <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs">
                  <ShieldAlert className="w-3 h-3" /> Safety Critical
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Student: <strong className="text-foreground">{note.studentName ?? `#${note.studentId}`}</strong></span>
              <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Instructor: <strong className="text-foreground">{note.instructorName ?? `#${note.instructorId}`}</strong></span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Note</p>
              <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/40 rounded-md p-3">{note.note}</p>
            </div>
            {note.focusAreas && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Focus Areas</p>
                <p className="text-sm text-foreground bg-muted/40 rounded-md p-3">{note.focusAreas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing review */}
        {currentReview && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Previous Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const vc = verdictOptions.find(v => v.value === currentReview.verdict);
                return vc ? (
                  <Badge className={`gap-1.5 ${vc.className}`}>
                    <vc.icon className="w-3.5 h-3.5" /> {vc.label}
                  </Badge>
                ) : null;
              })()}
              {currentReview.reviewComment && (
                <p className="text-sm text-muted-foreground">{currentReview.reviewComment}</p>
              )}
              <p className="text-xs text-muted-foreground">Reviewed {format(new Date(currentReview.reviewedAt), "d MMM yyyy 'at' HH:mm")}</p>
            </CardContent>
          </Card>
        )}

        {/* Review form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{currentReview ? "Update Review" : "Submit Review"}</CardTitle>
            <CardDescription>Mark this note as meeting your school's standards, needing improvement, or flagged for follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Verdict</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {verdictOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = selectedVerdict === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedVerdict(opt.value)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-all ${
                        isSelected ? opt.className + " ring-2 ring-offset-1 ring-current" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewComment">Comment <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="reviewComment"
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Add context for the instructor or for your records…"
                className="resize-none h-24"
                maxLength={2000}
              />
            </div>
            <Button onClick={handleSubmit} disabled={isPending || !selectedVerdict} className="w-full">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {currentReview ? "Update Review" : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
