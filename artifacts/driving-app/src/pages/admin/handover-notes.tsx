import { useState } from "react";
import { useListAdminHandoverNotes } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Flag, Search, ChevronRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

const LIMIT = 20;

const verdictConfig = {
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200" },
  needs_improvement: { label: "Needs Improvement", icon: AlertTriangle, className: "bg-amber-100 text-amber-700 border-amber-200" },
  flagged: { label: "Flagged", icon: Flag, className: "bg-red-100 text-red-700 border-red-200" },
};

export default function AdminHandoverNotes() {
  const [reviewStatus, setReviewStatus] = useState<string>("all");
  const [safetyCritical, setSafetyCritical] = useState<string>("all");
  const [page, setPage] = useState(0);

  const params: Record<string, unknown> = {
    limit: LIMIT,
    offset: page * LIMIT,
  };
  if (reviewStatus !== "all") params.reviewStatus = reviewStatus;
  if (safetyCritical === "true") params.safetyCritical = true;
  if (safetyCritical === "false") params.safetyCritical = false;

  const { data, isLoading } = useListAdminHandoverNotes(
    params as any,
    { query: { queryKey: ["/api/admin/handover-notes", reviewStatus, safetyCritical, page] } }
  );

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Handover Note Audit</h1>
          <p className="text-muted-foreground mt-1">Review instructor handover notes for quality and compliance.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={reviewStatus} onValueChange={v => { setReviewStatus(v); setPage(0); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Review status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="needs_improvement">Needs Improvement</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
          <Select value={safetyCritical} onValueChange={v => { setSafetyCritical(v); setPage(0); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Safety flag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notes</SelectItem>
              <SelectItem value="true">Safety-critical only</SelectItem>
              <SelectItem value="false">Non-critical only</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">{total} note{total !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No handover notes match these filters.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(note => {
              const verdict = note.review?.verdict as keyof typeof verdictConfig | undefined;
              const vc = verdict ? verdictConfig[verdict] : null;
              return (
                <Link key={note.id} href={`/admin/handover-notes/${note.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-border">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {note.isSafetyCritical && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                                <ShieldAlert className="w-3 h-3" /> Safety Critical
                              </Badge>
                            )}
                            {vc ? (
                              <Badge className={`text-xs gap-1 ${vc.className}`}>
                                <vc.icon className="w-3 h-3" /> {vc.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                                <Clock className="w-3 h-3" /> Unreviewed
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 text-sm">
                            <span className="font-medium">{note.studentName ?? `Student #${note.studentId}`}</span>
                            <span className="text-muted-foreground">Instructor: {note.instructorName ?? `#${note.instructorId}`}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{note.note}</p>
                          {note.focusAreas && (
                            <p className="text-xs text-muted-foreground">Focus: {note.focusAreas}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(note.createdAt), "d MMM yyyy")}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground flex items-center px-2">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
