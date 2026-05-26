import { useListAuditLogs } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

// Friendly labels for known audit actions
const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  view: "Viewed",
  view_student: "Viewed student",
  create_assessment: "Logged assessment",
  update_assessment: "Updated assessment",
  create_handover: "Wrote handover note",
  create_booking: "Created booking",
  claim_booking: "Claimed booking",
  decline_booking: "Declined booking",
  complete_booking: "Completed booking",
  verify_instructor: "Verified instructor",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-50 text-green-800 border-green-200",
  update: "bg-blue-50 text-blue-800 border-blue-200",
  delete: "bg-red-50 text-red-800 border-red-200",
  view: "bg-gray-50 text-gray-700 border-gray-200",
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // Fallback: snake_case → Sentence case
  return action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function actionColor(action: string): string {
  for (const key of Object.keys(ACTION_COLORS)) {
    if (action.startsWith(key)) return ACTION_COLORS[key];
  }
  return "bg-gray-50 text-gray-700 border-gray-200";
}

export default function AdminAuditLog() {
  const { data: logs, isLoading } = useListAuditLogs();

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">System-wide activity and compliance tracking.</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4 font-medium">Timestamp</th>
                      <th className="px-6 py-4 font-medium">Actor</th>
                      <th className="px-6 py-4 font-medium">Action</th>
                      <th className="px-6 py-4 font-medium">Resource</th>
                      <th className="px-6 py-4 font-medium hidden md:table-cell">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map(log => (
                      <tr key={log.id} className="bg-white hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {log.actorName || `User ${log.actorId}`}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={`text-xs ${actionColor(log.action)}`}>
                            {actionLabel(log.action)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize">{log.resourceType}</span>
                          {log.resourceId && <span className="text-muted-foreground ml-1">#{log.resourceId}</span>}
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell text-xs font-mono text-muted-foreground max-w-xs truncate">
                          {log.metadata || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No audit logs found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
