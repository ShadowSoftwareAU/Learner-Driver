import { useGetStudentDashboard } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Clock, CheckCircle, Target, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

export default function StudentDashboard() {
  const { data: dashboard, isLoading } = useGetStudentDashboard({ query: { queryKey: ["/api/dashboards/student"] }});

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
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Mastery</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 mb-2">
                <div className="text-3xl font-bold">{dashboard.progressPercent}%</div>
                <div className="text-sm text-muted-foreground mb-1">{dashboard.completedManeuvers} of {dashboard.totalManeuvers} maneuvers</div>
              </div>
              <Progress value={dashboard.progressPercent} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {dashboard.nextFocusAreas && (
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
        )}

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
