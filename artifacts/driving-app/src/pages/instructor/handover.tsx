import { useGetHandover, getGetHandoverQueryKey } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Clock, Award, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { PreLessonBriefingCard } from "@/components/PreLessonBriefingCard";
import { MedicalInfoCard } from "@/components/MedicalInfoCard";

export default function HandoverView() {
  const params = useParams();
  const studentId = parseInt(params.studentId || "0", 10);

  const { data: handover, isLoading } = useGetHandover(studentId, { query: { enabled: !!studentId, queryKey: getGetHandoverQueryKey(studentId) } });

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!handover) {
    return (
      <SidebarLayout>
        <div className="space-y-4">
          <Link href="/instructor/students">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">
              <ArrowLeft className="w-4 h-4" /> Back to Students
            </button>
          </Link>
          <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-3">
            <FileText className="w-12 h-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No handover data</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              There are no assessments on record linking you to this student yet. Complete an assessment first.
            </p>
          </div>
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

        {/* Pre-lesson briefing — safety snapshot */}
        {(handover as any).safetyBriefing && (
          <PreLessonBriefingCard
            briefing={(handover as any).safetyBriefing}
            studentName={handover.student.fullName}
            readOnly
          />
        )}

        {/* Medical info — restricted, reveal on demand */}
        <MedicalInfoCard
          studentId={studentId}
          preview={{
            medicalConditionsPreview: (handover as any).safetyBriefing?.medicalConditionsPreview,
            allergiesPreview: (handover as any).safetyBriefing?.allergiesPreview,
          }}
        />

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
              <CardTitle className="text-sm font-medium text-muted-foreground">Maneuvers Competent</CardTitle>
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
              {handover.recentAssessments?.map(assessment => {
                const currentInstructorId = (handover as any).currentInstructorId as number | null;
                const isOwn = currentInstructorId != null && assessment.instructorId === currentInstructorId;
                const maneuverNoteSummary = (assessment as any).maneuverNoteSummary as string | null;
                const inner = (
                  <div className={`p-4 rounded-lg border border-border bg-gray-50/50 transition-colors ${isOwn ? "hover:border-primary/50 hover:bg-primary/5 cursor-pointer" : ""}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold">{format(new Date(assessment.lessonDate), 'PPP')}</span>
                      <div className="flex items-center gap-1.5">
                        {assessment.instructorName && (
                          <span className="text-sm text-muted-foreground">{assessment.instructorName}</span>
                        )}
                        {isOwn && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    </div>
                    <p className="text-sm mt-1"><span className="font-medium">Focus next:</span> {assessment.focusAreasNext || 'None specified'}</p>
                    {maneuverNoteSummary && (
                      <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2 line-clamp-2">
                        <span className="font-medium">Notes:</span> {maneuverNoteSummary}
                      </p>
                    )}
                  </div>
                );
                return isOwn ? (
                  <Link key={assessment.id} href={`/instructor/assessments/${assessment.id}`}>
                    {inner}
                  </Link>
                ) : (
                  <div key={assessment.id}>{inner}</div>
                );
              })}
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
