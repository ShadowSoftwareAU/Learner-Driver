import { useGetHandover, getGetHandoverQueryKey } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Clock, Award, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";

export default function HandoverView() {
  const params = useParams();
  const studentId = parseInt(params.studentId || "0", 10);

  const { data: handover, isLoading } = useGetHandover(studentId, { query: { enabled: !!studentId, queryKey: getGetHandoverQueryKey(studentId) } });

  if (isLoading || !handover) {
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
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/instructor/students/${studentId}`}>
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Student
            </Button>
          </Link>
        </div>

        <div className="bg-primary text-primary-foreground p-8 rounded-xl shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Handover Report</h1>
          <p className="text-primary-foreground/80 text-lg">{handover.student.fullName}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{handover.totalHours}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Maneuvers Mastered</CardTitle>
              <Award className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {handover.completedManeuvers} <span className="text-base font-normal text-muted-foreground">/ {handover.totalManeuvers}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Skill Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {handover.skillBreakdown?.map((skill, idx) => (
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
            <CardDescription>Last 5 lessons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {handover.recentAssessments?.map(assessment => (
                <div key={assessment.id} className="p-4 rounded-lg border border-border bg-gray-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">{format(new Date(assessment.lessonDate), 'PPP')}</span>
                    <span className="text-sm text-muted-foreground">{assessment.instructorName}</span>
                  </div>
                  <p className="text-sm mt-2"><span className="font-medium">Focus next:</span> {assessment.focusAreasNext || 'None specified'}</p>
                </div>
              ))}
              {(!handover.recentAssessments || handover.recentAssessments.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No recent assessments.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
