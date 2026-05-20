import { useGetInstructorDashboard } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function InstructorDashboard() {
  const { data: dashboard, isLoading } = useGetInstructorDashboard({ query: { queryKey: ["/api/dashboards/instructor"] }});

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
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Your performance and student activity for this week.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.activeStudents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lessons This Week</CardTitle>
              <CalendarCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.lessonsThisWeek}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours Logged</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.totalHoursLogged}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.recentAssessments && dashboard.recentAssessments.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.recentAssessments.map(assessment => (
                    <div key={assessment.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-gray-50">
                      <div>
                        <p className="font-medium">{assessment.studentName}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(assessment.lessonDate), 'PPP')} • {assessment.durationMinutes} min</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-primary/10 text-primary">
                        {assessment.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent assessments found.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Student Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.studentSummaries && dashboard.studentSummaries.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.studentSummaries.map(student => (
                    <div key={student.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-gray-50">
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{student.totalHours} hrs logged</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{student.progressPercent}%</span>
                        <p className="text-xs text-muted-foreground">progress</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active students found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
