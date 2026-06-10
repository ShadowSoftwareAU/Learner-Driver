import { useState } from "react";
import { useListAdminFeedback, useGetAdminFeedbackSummary } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const LIMIT = 20;

function StarRating({ value }: { value: number | null | undefined }) {
  if (!value) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs font-medium ml-1">{value.toFixed(1)}</span>
    </div>
  );
}

function AvgBadge({ value }: { value: number | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const color = value >= 4 ? "text-green-600" : value >= 3 ? "text-amber-600" : "text-red-600";
  return (
    <div className={`flex items-center gap-1 font-bold text-lg ${color}`}>
      <Star className="w-4 h-4 fill-current" />
      {value.toFixed(1)}
    </div>
  );
}

export default function AdminFeedback() {
  const [page, setPage] = useState(0);
  const [filterInstructor, setFilterInstructor] = useState<string>("all");

  const summaryQK = ["/api/admin/feedback/summary"];
  const listQK = ["/api/admin/feedback", filterInstructor, page];

  const { data: summary, isLoading: summaryLoading } = useGetAdminFeedbackSummary({
    query: { queryKey: summaryQK },
  });

  const listParams: Record<string, unknown> = { limit: LIMIT, offset: page * LIMIT };
  if (filterInstructor !== "all") listParams.instructorId = parseInt(filterInstructor, 10);

  const { data: feedbackList, isLoading: listLoading } = useListAdminFeedback(
    listParams as any,
    { query: { queryKey: listQK } }
  );

  const items = feedbackList?.items ?? [];
  const total = feedbackList?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const instructorOptions = summary ?? [];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Feedback</h1>
          <p className="text-muted-foreground mt-1">Session feedback submitted by students after completed lessons.</p>
        </div>

        {/* Instructor summary cards */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Instructor Performance
          </h2>
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : instructorOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback received yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {instructorOptions.map(inst => (
                <Card key={inst.instructorId} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{inst.instructorName ?? `Instructor #${inst.instructorId}`}</CardTitle>
                    <CardDescription>{inst.totalFeedback} review{inst.totalFeedback !== 1 ? "s" : ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Overall</span>
                      <AvgBadge value={inst.avgOverall} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Communication: <strong className="text-foreground">{inst.avgCommunication?.toFixed(1) ?? "—"}</strong></span>
                      <span>Safety: <strong className="text-foreground">{inst.avgSafetyFocus?.toFixed(1) ?? "—"}</strong></span>
                      <span>Lesson quality: <strong className="text-foreground">{inst.avgLessonQuality?.toFixed(1) ?? "—"}</strong></span>
                      <span>Recommend: <strong className="text-foreground">{inst.recommendRate != null ? `${inst.recommendRate}%` : "—"}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Individual responses */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Individual Responses
            </h2>
            <Select value={filterInstructor} onValueChange={v => { setFilterInstructor(v); setPage(0); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All instructors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                {instructorOptions.map(inst => (
                  <SelectItem key={inst.instructorId} value={String(inst.instructorId)}>
                    {inst.instructorName ?? `Instructor #${inst.instructorId}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {listLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No feedback yet{filterInstructor !== "all" ? " for this instructor" : ""}.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map(fb => (
                <Card key={fb.id} className="border-border">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="font-medium">{fb.studentName ?? `Student #${fb.studentId}`}</span>
                          <span className="text-muted-foreground">→ {fb.instructorName ?? `Instructor #${fb.instructorId}`}</span>
                          {fb.lessonDate && <span className="text-muted-foreground">{fb.lessonDate}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span>Overall: <StarRating value={fb.overallRating} /></span>
                          <span className="flex items-center gap-1">Communication: <StarRating value={fb.communicationRating} /></span>
                          <span className="flex items-center gap-1">Safety: <StarRating value={fb.safetyFocusRating} /></span>
                          <span className="flex items-center gap-1">Lesson: <StarRating value={fb.lessonQualityRating} /></span>
                        </div>
                        {fb.comments && (
                          <p className="text-sm text-muted-foreground italic bg-muted/40 rounded p-2 mt-1">"{fb.comments}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {fb.wouldRecommend != null && (
                          fb.wouldRecommend
                            ? <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs"><ThumbsUp className="w-3 h-3" /> Recommends</Badge>
                            : <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs"><ThumbsDown className="w-3 h-3" /> Wouldn't recommend</Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {fb.submittedAt ? format(new Date(fb.submittedAt), "d MMM") : ""}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground flex items-center px-2">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
