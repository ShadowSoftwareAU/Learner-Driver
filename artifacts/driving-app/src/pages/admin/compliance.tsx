import { useGetExpiringDocuments } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

function formatDocType(docType: string): string {
  return docType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function ExpiryBadge({ daysUntilExpiry }: { daysUntilExpiry: number }) {
  if (daysUntilExpiry < 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="w-3 h-3" />
        Expired
      </Badge>
    );
  }
  if (daysUntilExpiry === 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        Expires today
      </Badge>
    );
  }
  if (daysUntilExpiry <= 7) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        {daysUntilExpiry}d remaining
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
      <AlertTriangle className="w-3 h-3" />
      {daysUntilExpiry}d remaining
    </Badge>
  );
}

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

type InstructorGroup = {
  instructorId: number;
  instructorName: string;
  instructorEmail: string;
  docs: ExpiringDoc[];
};

function groupByInstructor(docs: ExpiringDoc[]): InstructorGroup[] {
  const map = new Map<number, InstructorGroup>();
  for (const doc of docs) {
    if (!map.has(doc.instructorId)) {
      map.set(doc.instructorId, {
        instructorId: doc.instructorId,
        instructorName: doc.instructorName,
        instructorEmail: doc.instructorEmail,
        docs: [],
      });
    }
    map.get(doc.instructorId)!.docs.push(doc);
  }
  return Array.from(map.values()).sort((a, b) => {
    const aMin = Math.min(...a.docs.map((d) => d.daysUntilExpiry));
    const bMin = Math.min(...b.docs.map((d) => d.daysUntilExpiry));
    return aMin - bMin;
  });
}

export default function AdminComplianceDashboard() {
  const { data, isLoading, isError } = useGetExpiringDocuments();

  const docs = (data ?? []) as ExpiringDoc[];
  const expired = docs.filter((d) => d.daysUntilExpiry < 0);
  const expiringSoon = docs.filter((d) => d.daysUntilExpiry >= 0);
  const groups = groupByInstructor(docs);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            All instructor documents expiring within the next 30 days or already expired.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">Failed to load compliance data. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-destructive/10">
                      <ShieldAlert className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{expired.length}</p>
                      <p className="text-sm text-muted-foreground">Expired</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{expiringSoon.length}</p>
                      <p className="text-sm text-muted-foreground">Expiring within 30 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{groups.length}</p>
                      <p className="text-sm text-muted-foreground">Instructors affected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {groups.length === 0 ? (
              <Card>
                <CardContent className="pt-10 pb-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-medium">All clear</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No documents expiring in the next 30 days.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <Card key={group.instructorId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="text-base">{group.instructorName}</CardTitle>
                          <p className="text-sm text-muted-foreground">{group.instructorEmail}</p>
                        </div>
                        <Link href={`/admin/instructors/${group.instructorId}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            View profile
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y divide-border rounded-md border overflow-hidden">
                        {group.docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-4 px-4 py-3 bg-card flex-wrap"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{formatDocType(doc.docType)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {doc.daysUntilExpiry < 0
                                  ? `Expired on ${formatDate(doc.expiresAt)}`
                                  : `Expires ${formatDate(doc.expiresAt)}`}
                              </p>
                            </div>
                            <ExpiryBadge daysUntilExpiry={doc.daysUntilExpiry} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
