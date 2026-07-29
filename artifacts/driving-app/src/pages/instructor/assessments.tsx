import { useState } from "react";
import { Link } from "wouter";
import { useListAssessments } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileCheck, Plus, Pencil } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in_progress: { label: "In Progress", variant: "secondary" },
  completed:   { label: "Completed",   variant: "default" },
  no_show:     { label: "No Show",     variant: "destructive" },
};

const FINALIZATION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft:            { label: "Draft",            variant: "outline" },
  pending_approval: { label: "Pending Approval", variant: "secondary" },
  approved:         { label: "Approved",         variant: "default" },
  dispatched:       { label: "Dispatched",       variant: "default" },
};

const TYPE_LABELS: Record<string, string> = {
  qsafe:         "Q-SAFE",
  qride:         "Q-RIDE",
  heavy_vehicle: "Heavy Vehicle",
};

export default function InstructorAssessments() {
  const { data: assessments, isLoading } = useListAssessments(
    {},
    { query: { queryKey: ["/api/assessments"] } }
  );

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [finalFilter, setFinalFilter]   = useState("all");

  const filtered = assessments?.filter(a => {
    const nameMatch   = !search || (a.studentName ?? "").toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || a.status === statusFilter;
    const typeMatch   = typeFilter   === "all" || a.assessmentType === typeFilter;
    const finalMatch  = finalFilter  === "all" || a.finalizationStatus === finalFilter;
    return nameMatch && statusMatch && typeMatch && finalMatch;
  }) ?? [];

  const draftCount = assessments?.filter(a => a.finalizationStatus === "draft" && a.status !== "no_show").length ?? 0;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileCheck className="w-7 h-7 text-primary" />
              My Assessments
            </h1>
            <p className="text-muted-foreground">
              All sessions you have conducted — review, complete drafts, or use as reference.
            </p>
          </div>
          <Link href="/instructor/assessments/new">
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              New Assessment
            </Button>
          </Link>
        </div>

        {draftCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Pencil className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              You have <strong>{draftCount}</strong> draft assessment{draftCount !== 1 ? "s" : ""} awaiting completion.
              Use the <strong>Report</strong> filter below to find them quickly.
            </span>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name…"
                  className="pl-9 bg-gray-50/50"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="qsafe">Q-SAFE</SelectItem>
                  <SelectItem value="qride">Q-RIDE</SelectItem>
                  <SelectItem value="heavy_vehicle">Heavy Vehicle</SelectItem>
                </SelectContent>
              </Select>
              <Select value={finalFilter} onValueChange={setFinalFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Report" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reports</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex justify-center p-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Type</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell text-center">Duration</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <Link key={a.id} href={`/instructor/assessments/${a.id}`} asChild>
                        <tr className="bg-white border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {format(new Date(a.lessonDate), "d MMM yyyy")}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {a.studentName ?? <span className="text-muted-foreground italic">Unknown</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs font-medium text-muted-foreground">
                              {TYPE_LABELS[a.assessmentType ?? "qsafe"] ?? a.assessmentType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground hidden lg:table-cell">
                            {a.durationMinutes}m
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_LABELS[a.status]?.variant ?? "outline"} className="text-xs">
                              {STATUS_LABELS[a.status]?.label ?? a.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge
                              variant={FINALIZATION_LABELS[a.finalizationStatus ?? "draft"]?.variant ?? "outline"}
                              className="text-xs"
                            >
                              {FINALIZATION_LABELS[a.finalizationStatus ?? "draft"]?.label ?? a.finalizationStatus}
                            </Badge>
                          </td>
                        </tr>
                      </Link>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-14">
                <FileCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No assessments found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== "all" || typeFilter !== "all" || finalFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Your logged assessments will appear here."}
                </p>
              </div>
            )}
            {!isLoading && filtered.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Showing {filtered.length} of {assessments?.length ?? 0} assessment{assessments?.length !== 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
