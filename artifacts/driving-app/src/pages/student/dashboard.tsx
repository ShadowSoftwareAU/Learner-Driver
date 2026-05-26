import { useMemo } from "react";
import { Link } from "wouter";
import { useGetStudentDashboard, useListBookings } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckCircle, Target, FileText, Award, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { BookingStatus } from "@/lib/enums";

export default function StudentDashboard() {
  const { data: dashboard, isLoading } = useGetStudentDashboard({ query: { queryKey: ["/api/dashboards/student"] }});
  const { data: bookings } = useListBookings(undefined, { query: { queryKey: ["/api/bookings"] } });

  // Upcoming: pending/claimed/confirmed, future-dated, soonest first
  const upcoming = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return ((bookings ?? []) as any[])
      .filter((b) =>
        (b.status === BookingStatus.pending ||
          b.status === BookingStatus.claimed ||
          b.status === BookingStatus.confirmed) &&
        String(b.requestedDate) >= todayIso
      )
      .sort((a, b) =>
        `${a.requestedDate}T${a.requestedTime ?? "00:00"}`.localeCompare(
          `${b.requestedDate}T${b.requestedTime ?? "00:00"}`
        )
      )
      .slice(0, 3);
  }, [bookings]);

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
          <h1 className="text-3xl font-bold tracking-tight">My Progress</h1>
          <p className="text-muted-foreground">Track your learning journey towards getting your license.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hours Logged</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.totalHours}</div>
              <p className="text-xs text-muted-foreground mt-1">Total supervised driving hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mastered Maneuvers</CardTitle>
              <Award className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard.completedManeuvers}<span className="text-base font-normal text-muted-foreground"> / {dashboard.totalManeuvers}</span></div>
              <p className="text-xs text-muted-foreground mt-1">Skills you've fully mastered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Progress</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{dashboard.progressPercent}%</div>
              <Progress value={dashboard.progressPercent} className="h-2" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboard.nextFocusAreas ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> Next Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground">{dashboard.nextFocusAreas}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/30 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                  <Target className="w-5 h-5" /> Next Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Your instructor will set focus areas after your next lesson.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Upcoming Lessons
              </CardTitle>
              <Link href="/student/bookings" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">No upcoming lessons.</p>
                  <Link href="/student/search" className="text-sm text-primary hover:underline mt-2 inline-block">
                    Find an instructor
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((b: any) => (
                    <li key={b.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {format(new Date(b.requestedDate), "EEE d MMM")} at {b.requestedTime}
                        </p>
                        {b.instructorName && (
                          <p className="text-xs text-muted-foreground truncate">with {b.instructorName}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize text-xs flex-shrink-0">{b.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Skill Breakdown</CardTitle>
              <CardDescription>Your proficiency by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {dashboard.skillBreakdown?.map((skill, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-sm">{skill.category}</span>
                      <span className="text-sm text-muted-foreground">{Math.round((skill.mastered / skill.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-green-500 h-full" style={{ width: `${(skill.mastered / skill.total) * 100}%` }}></div>
                      <div className="bg-yellow-400 h-full" style={{ width: `${(skill.practicing / skill.total) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard.recentAssessments?.map(assessment => (
                  <div key={assessment.id} className="p-4 rounded-lg border border-border bg-gray-50/50 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(assessment.lessonDate), 'PPP')}
                      </div>
                      <span className="text-sm font-medium px-2 py-1 bg-white border rounded">
                        {assessment.durationMinutes} mins
                      </span>
                    </div>
                    {assessment.confidenceNote && (
                      <p className="text-sm text-muted-foreground mt-1">"{assessment.confidenceNote}"</p>
                    )}
                  </div>
                ))}
                {(!dashboard.recentAssessments || dashboard.recentAssessments.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No assessments recorded yet.
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
