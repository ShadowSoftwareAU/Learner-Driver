import { useState } from "react";
import { useGetModerationCases } from "@workspace/api-client-react";
import type { ModerationCase } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, Search, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-700",
  escalated: "bg-red-100 text-red-800",
};

export default function ModerationDashboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data: cases, isLoading } = useGetModerationCases(
    { status: statusFilter || undefined },
    { query: { queryKey: ["/api/moderation/cases", statusFilter] } },
  );

  const filtered = (cases ?? []).filter((c: { contentType?: string; reason?: string }) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contentType?.toLowerCase().includes(q) ||
      c.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Content Moderation</h1>
          </div>
          <p className="text-muted-foreground mt-1">Review and act on flagged content across the platform.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search content type, reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["", "open", "under_review", "escalated", "resolved", "dismissed"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "" ? "All" : s.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Flagged Cases{" "}
              {!isLoading && (
                <span className="ml-1 text-muted-foreground font-normal text-sm">
                  ({filtered.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>Click a case to review the full detail and take action.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No cases found.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((c: ModerationCase) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/40 rounded px-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/super-admin/moderation/${c.id}`)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm capitalize">
                          {c.contentType.replace(/_/g, " ")}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${severityColors[c.severity] ?? "bg-gray-100 text-gray-700"}`}>
                          {c.severity}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${statusColors[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                      {c.rawExcerpt && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{c.rawExcerpt}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {c.createdAt ? format(new Date(c.createdAt), "d MMM yyyy, h:mm a") : "—"}
                        {c.actorUserId && ` · Actor user #${c.actorUserId}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-4" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
