import { Link } from "wouter";
import { useGetInstructorDashboard } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarCheck, Loader2, ChevronRight } from "lucide-react";
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
          <Link href="/instructor/students" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.activeStudents}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">View all students <ChevronRight className="w-3 h-3" /></p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/instructor/bookings" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lessons This Week</CardTitle>
                <CalendarCheck className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.lessonsThisWeek}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">View bookings <ChevronRight className="w-3 h-3" /></p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/instructor/students" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours Logged</CardTitle>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.totalHoursLogged}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">Break down by student <ChevronRight className="w-3 h-3" /></p>
              </CardContent>
            </Card>
          </Link>
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
                    <Link
                      key={assessment.id}
                      href={`/instructor/assessments/${assessment.id}`}
                      className="flex justify-between items-center p-3 rounded-lg border border-border bg-gray-50 hover:bg-white hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div>
                        <p className="font-medium">{assessment.studentName}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(assessment.lessonDate), 'PPP')} • {assessment.durationMinutes} min</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-primary/10 text-primary capitalize">
                          {assessment.status.replace('_', ' ')}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
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
                    <Link
                      key={student.id}
                      href={`/instructor/students/${student.id}`}
                      className="flex justify-between items-center p-3 rounded-lg border border-border bg-gray-50 hover:bg-white hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{student.totalHours} hrs logged</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <span className="text-lg font-bold">{Math.round(student.progressPercent)}%</span>
                          <p className="text-xs text-muted-foreground">progress</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
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
