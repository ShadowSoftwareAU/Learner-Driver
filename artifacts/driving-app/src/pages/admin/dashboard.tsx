import { useGetAdminDashboard } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, Car, FileCheck, Clock, Activity } from "lucide-react";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useGetAdminDashboard({ query: { queryKey: ["/api/dashboards/admin"] }});

  if (isLoading || !dashboard) {
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fleet Overview</h1>
          <p className="text-muted-foreground">School-wide metrics and activity.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">{dashboard.activeStudents} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Instructors</CardTitle>
              <Car className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.totalInstructors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Assessments</CardTitle>
              <FileCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.totalAssessments}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hours This Month</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.hoursLoggedThisMonth || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard.recentActivity?.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-3 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gray-500">{log.actorName?.charAt(0) || 'U'}</span>
                    </div>
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{log.actorName}</span> {log.action.replace('_', ' ')} <span className="font-medium">{log.resourceType}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(log.createdAt), 'PP p')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructor Performance</CardTitle>
              <CardDescription>Current active roster</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard.instructorStats?.map(stat => (
                  <div key={stat.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-gray-50">
                    <div>
                      <p className="font-medium">{stat.fullName}</p>
                      <p className="text-xs text-muted-foreground">{stat.activeStudents} active students</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">{stat.hoursThisMonth}</span>
                      <p className="text-xs text-muted-foreground">hrs / mo</p>
                    </div>
                  </div>
                ))}
                {(!dashboard.instructorStats || dashboard.instructorStats.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No instructor data available.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
