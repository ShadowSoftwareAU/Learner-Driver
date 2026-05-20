import { lazy, Suspense } from "react";
import { useGetStudent, useGetStudentProgress, useListAssessments, useGetStudentLessonPlan, getGetStudentQueryKey, getGetStudentProgressQueryKey, getListAssessmentsQueryKey } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Calendar, Clock, Award, ChevronLeft, ExternalLink, MapPin, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const LessonRouteMap = lazy(() => import("@/components/LessonRouteMap"));

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  not_attempted: { label: "Not Started", color: "bg-gray-100 text-gray-600" },
  attempted: { label: "Attempted", color: "bg-red-100 text-red-700" },
  practiced: { label: "Practiced", color: "bg-amber-100 text-amber-700" },
  mastered: { label: "Mastered", color: "bg-green-100 text-green-700" },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  high: { label: "High Priority", variant: "destructive" },
  medium: { label: "Medium", variant: "default" },
  low: { label: "Low", variant: "secondary" },
};

export default function InstructorStudentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id, queryKey: getGetStudentQueryKey(id) } });
  const { data: progress, isLoading: isProgressLoading } = useGetStudentProgress(id, { query: { enabled: !!id, queryKey: getGetStudentProgressQueryKey(id) } });
  const { data: assessments, isLoading: isAssessmentsLoading } = useListAssessments({ studentId: id }, { query: { queryKey: ["/api/assessments", { studentId: id }] } });
  const { data: lessonPlan, isLoading: isPlanLoading } = useGetStudentLessonPlan(id, { query: { enabled: !!id, queryKey: ["/api/students", id, "lesson-plan"] } });

  const isLoading = isStudentLoading || isProgressLoading || isAssessmentsLoading;

  if (isLoading || !student) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const highlightedTypeIds = lessonPlan?.lessonFocus?.slice(0, 3).map((f: any) => f.lessonType.id) ?? [];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/instructor/students">
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {student.fullName}
              <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                {student.status?.replace('_', ' ')}
              </Badge>
            </h1>
            <p className="text-muted-foreground">{student.email} {student.phone ? `• ${student.phone}` : ''}</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Link href={`/instructor/handover/${student.id}`}>
              <Button variant="outline" className="flex-1 md:flex-none">
                <ExternalLink className="w-4 h-4 mr-2" /> Handover
              </Button>
            </Link>
            <Link href={`/instructor/assessments/new?studentId=${student.id}`}>
              <Button className="flex-1 md:flex-none">New Assessment</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{student.totalHours || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Maneuvers Mastered</CardTitle>
              <Award className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {progress?.completedManeuvers || 0} <span className="text-base font-normal text-muted-foreground">/ {progress?.totalManeuvers || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Assessments</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{assessments?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger value="progress" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Skill Progress</TabsTrigger>
            <TabsTrigger value="lesson-plan" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Lesson Plan
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Assessment History</TabsTrigger>
            <TabsTrigger value="intake" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Intake Info</TabsTrigger>
          </TabsList>
          
          <TabsContent value="progress" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {progress?.skillBreakdown?.map((skill, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{skill.category}</CardTitle>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden flex">
                      <div className="bg-green-500 h-2.5" style={{ width: `${(skill.mastered / skill.total) * 100}%` }}></div>
                      <div className="bg-yellow-400 h-2.5" style={{ width: `${(skill.practicing / skill.total) * 100}%` }}></div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">{skill.mastered} Mastered</span>
                      <span className="text-yellow-600 font-medium">{skill.practicing} Practicing</span>
                      <span className="text-gray-400">{skill.notStarted} Not Started</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!progress?.skillBreakdown?.length && (
                <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                  No skill progress recorded yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lesson-plan" className="pt-6">
            {isPlanLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !lessonPlan ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                Could not load lesson plan.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary banner */}
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{lessonPlan.summary}</p>
                </div>

                {lessonPlan.lessonFocus?.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-lg">
                    <Award className="w-10 h-10 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-green-700">All skills mastered!</p>
                    <p className="text-sm text-muted-foreground mt-1">This student is ready for a QSAFE pre-test assessment.</p>
                  </div>
                ) : (
                  <>
                    {/* Focus area cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {lessonPlan.lessonFocus?.map((area: any, idx: number) => {
                        const priorityCfg = PRIORITY_CONFIG[area.priority] ?? PRIORITY_CONFIG.low;
                        return (
                          <Card
                            key={area.lessonType.id}
                            className={`relative overflow-hidden ${idx === 0 ? "ring-2 ring-primary/30" : ""}`}
                          >
                            {/* Color accent bar */}
                            <div
                              className="absolute top-0 left-0 right-0 h-1"
                              style={{ backgroundColor: area.lessonType.color }}
                            />
                            <CardHeader className="pt-5 pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: area.lessonType.color }}
                                    />
                                    <CardTitle className="text-base leading-tight">{area.lessonType.name}</CardTitle>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{area.lessonType.description}</p>
                                </div>
                                <Badge variant={priorityCfg.variant} className="flex-shrink-0 text-xs">
                                  {priorityCfg.label}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-xs text-muted-foreground mb-3">
                                {area.gapCount} skill{area.gapCount !== 1 ? "s" : ""} need attention
                              </p>
                              <div className="space-y-1.5">
                                {area.maneuvers?.slice(0, 5).map((m: any) => {
                                  const lvl = LEVEL_CONFIG[m.bestLevel] ?? LEVEL_CONFIG.not_attempted;
                                  return (
                                    <div key={m.id} className="flex items-center justify-between gap-2">
                                      <span className="text-xs truncate">{m.name}</span>
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${lvl.color}`}>
                                        {lvl.label}
                                      </span>
                                    </div>
                                  );
                                })}
                                {area.maneuvers?.length > 5 && (
                                  <p className="text-xs text-muted-foreground pt-1">
                                    +{area.maneuvers.length - 5} more maneuvers
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Route map */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Recommended Practice Locations — Brisbane</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Highlighted zones match this student's priority lesson types. Click a zone for practice tips.
                      </p>
                      <Suspense fallback={
                        <div className="rounded-xl border bg-muted flex items-center justify-center" style={{ height: 420 }}>
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      }>
                        <LessonRouteMap highlightedTypeIds={highlightedTypeIds} />
                      </Suspense>

                      {/* Map legend */}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        {lessonPlan.lessonFocus?.slice(0, 5).map((area: any) => (
                          <div key={area.lessonType.id} className="flex items-center gap-1.5">
                            <span
                              className="h-3 w-3 rounded-full flex-shrink-0 border"
                              style={{ backgroundColor: area.lessonType.color }}
                            />
                            <span className="text-xs text-muted-foreground">{area.lessonType.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="pt-6">
            <div className="space-y-4">
              {assessments?.map(assessment => (
                <Link key={assessment.id} href={`/instructor/assessments/${assessment.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-foreground">{format(new Date(assessment.lessonDate), 'PPP')}</p>
                        <p className="text-sm text-muted-foreground">{assessment.durationMinutes} minutes</p>
                      </div>
                      <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                        {assessment.status.replace('_', ' ')}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {(!assessments || assessments.length === 0) && (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                  No assessments recorded yet.
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="intake" className="pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Learner Intake Data</CardTitle>
                <CardDescription>Information provided by the student.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">License Number</h4>
                    <p className="mt-1">{student.licenseNumber || 'Not provided'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Date of Birth</h4>
                    <p className="mt-1">{student.dateOfBirth ? format(new Date(student.dateOfBirth), 'PPP') : 'Not provided'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Guardian Name</h4>
                    <p className="mt-1">{student.guardianName || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Guardian Phone</h4>
                    <p className="mt-1">{student.guardianPhone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
