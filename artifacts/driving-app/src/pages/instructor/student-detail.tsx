import { lazy, Suspense, useMemo, useState } from "react";
import { useGetStudent, useGetStudentProgress, useListAssessments, useGetStudentLessonPlan, useGetHandover, useListBookings, getGetStudentQueryKey, getGetStudentProgressQueryKey, useUpdateStudent } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Calendar, Clock, Award, ChevronLeft, ExternalLink, MapPin, TrendingUp, AlertCircle, MessageSquare, Target, CalendarClock, Pencil, Car, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { StudentAvatar } from "@/components/StudentAvatar";
import { storageUrl } from "@/lib/upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhotoCaptureField } from "@/components/PhotoCaptureField";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AttendanceReliabilityBadge } from "@/components/AttendanceReliabilityBadge";
import { MedicalInfoCard } from "@/components/MedicalInfoCard";

const LessonRouteMap = lazy(() => import("@/components/LessonRouteMap"));

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  not_attempted: { label: "Not Started", color: "bg-gray-100 text-gray-600" },
  attempted: { label: "Attempted", color: "bg-red-100 text-red-700" },
  practiced: { label: "Not yet Competent", color: "bg-amber-100 text-amber-700" },
  mastered: { label: "Competent", color: "bg-green-100 text-green-700" },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  high: { label: "High Priority", variant: "destructive" },
  medium: { label: "Medium", variant: "default" },
  low: { label: "Low", variant: "secondary" },
};

export default function InstructorStudentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editHeadshotPath, setEditHeadshotPath] = useState<string | null>(null);
  const updateStudent = useUpdateStudent();

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id, queryKey: getGetStudentQueryKey(id) } });
  const { data: progress, isLoading: isProgressLoading } = useGetStudentProgress(id, { query: { enabled: !!id, queryKey: getGetStudentProgressQueryKey(id) } });
  const { data: assessments, isLoading: isAssessmentsLoading } = useListAssessments({ studentId: id }, { query: { queryKey: ["/api/assessments", { studentId: id }] } });
  const { data: lessonPlan, isLoading: isPlanLoading } = useGetStudentLessonPlan(id, { query: { enabled: !!id, queryKey: ["/api/students", id, "lesson-plan"] } });
  const { data: handover } = useGetHandover(id, { query: { enabled: !!id, queryKey: ["/api/handover", id] } });
  const { data: allBookings } = useListBookings(undefined, { query: { queryKey: ["/api/bookings"] } });

  const sortedAssessments = useMemo(() => {
    if (!assessments) return [];
    return [...assessments].sort(
      (a, b) => new Date(b.lessonDate).getTime() - new Date(a.lessonDate).getTime(),
    );
  }, [assessments]);

  const latestAssessment = sortedAssessments[0];

  const upcomingBookings = useMemo(() => {
    if (!allBookings) return [];
    const now = new Date();
    return allBookings
      .filter(b => b.studentId === id)
      .filter(b => b.status === "pending" || b.status === "claimed" || b.status === "confirmed")
      .filter(b => {
        const when = new Date(`${b.requestedDate}T${b.requestedTime || "00:00"}`);
        return when.getTime() >= now.getTime() - 60 * 60 * 1000;
      })
      .sort((a, b) => new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime());
  }, [allBookings, id]);

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
          <div className="flex items-center gap-4">
            <StudentAvatar fullName={student.fullName} headshotPath={student.headshotPath} className="w-14 h-14" textClassName="text-xl" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                {student.fullName}
                <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                  {student.status?.replace('_', ' ')}
                </Badge>
              </h1>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                <p className="text-muted-foreground">{student.email} {student.phone ? `• ${student.phone}` : ''}</p>
                {(student as any).noShowCount != null && (
                  <AttendanceReliabilityBadge
                    noShowCount={(student as any).noShowCount}
                    attendanceReliabilityScore={(student as any).attendanceReliabilityScore}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              className="flex-1 md:flex-none"
              onClick={() => {
                setEditFullName(student.fullName);
                setEditPhone(student.phone ?? "");
                setEditNotes(student.notes ?? "");
                setEditHeadshotPath(student.headshotPath ?? null);
                setEditOpen(true);
              }}
            >
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
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

        {/* Latest focus areas + upcoming bookings: at-a-glance for the next lesson */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-blue-200 bg-blue-50/40">
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                <Target className="w-4 h-4" />
                Current Focus for Next Lesson
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {latestAssessment ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    Set on {format(new Date(latestAssessment.lessonDate), "PPP")}
                  </p>
                  {latestAssessment.focusAreasNext && latestAssessment.focusAreasNext.trim().length > 0 ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{latestAssessment.focusAreasNext}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No focus areas were set last lesson.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">No lessons recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                Upcoming Bookings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {upcomingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No upcoming bookings.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingBookings.slice(0, 4).map(b => (
                    <li key={b.id} className="text-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {format(new Date(b.requestedDate), "PP")} · {b.requestedTime}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.suburb} {b.postcode} · {b.durationMinutes} min
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {b.carType === "learner_car" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              <GraduationCap className="w-3 h-3" /> Learner's Car
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              <Car className="w-3 h-3" /> Trainer's Car
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize text-xs flex-shrink-0">
                        {b.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
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
            <TabsTrigger value="handover" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Handover Notes
            </TabsTrigger>
            <TabsTrigger value="intake" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Intake Info</TabsTrigger>
            <TabsTrigger value="medical" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              🛡 Medical
            </TabsTrigger>
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
              {sortedAssessments.map(assessment => (
                <Link key={assessment.id} href={`/instructor/assessments/${assessment.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{format(new Date(assessment.lessonDate), 'PPP')}</p>
                          <p className="text-sm text-muted-foreground">{assessment.durationMinutes} minutes</p>
                        </div>
                        <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'} className="capitalize flex-shrink-0">
                          {assessment.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {(assessment.confidenceNote || assessment.focusAreasNext) && (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          {assessment.confidenceNote && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Notes</p>
                              <p className="text-sm text-foreground line-clamp-2">{assessment.confidenceNote}</p>
                            </div>
                          )}
                          {assessment.focusAreasNext && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Focus Areas for Next Lesson</p>
                              <p className="text-sm text-foreground line-clamp-2">{assessment.focusAreasNext}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {sortedAssessments.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                  No assessments recorded yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="handover" className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Notes shared between instructors about this student.</p>
                <Link href={`/instructor/handover/${student.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" /> Add note
                  </Button>
                </Link>
              </div>
              {!handover || handover.notes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                  No handover notes yet.
                </div>
              ) : (
                handover.notes.map(note => (
                  <Card key={note.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{note.instructorName ?? "Instructor"}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(note.createdAt), "PPp")}</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                      {note.focusAreas && (
                        <div className="border-l-2 border-blue-200 pl-3 mt-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Focus Areas</p>
                          <p className="text-sm whitespace-pre-wrap">{note.focusAreas}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
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
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Guardian Email</h4>
                    <p className="mt-1 break-words">{student.guardianEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">PCYC / School Email</h4>
                    <p className="mt-1 break-words">{student.pcycSchoolEmail || 'N/A'}</p>
                  </div>
                </div>

                {student.notes && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notes</h4>
                    <p className="mt-1 whitespace-pre-wrap">{student.notes}</p>
                  </div>
                )}

                {(student.licenceFrontPath || student.licenceBackPath) && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Licence Photos</h4>
                    <div className="flex flex-wrap gap-4">
                      {student.licenceFrontPath && (
                        <a href={storageUrl(student.licenceFrontPath) ?? undefined} target="_blank" rel="noreferrer">
                          <img src={storageUrl(student.licenceFrontPath) ?? undefined} alt="Licence front" className="w-40 h-24 object-cover rounded-md border border-border hover:border-primary transition-colors" />
                          <p className="text-xs text-muted-foreground mt-1">Front</p>
                        </a>
                      )}
                      {student.licenceBackPath && (
                        <a href={storageUrl(student.licenceBackPath) ?? undefined} target="_blank" rel="noreferrer">
                          <img src={storageUrl(student.licenceBackPath) ?? undefined} alt="Licence back" className="w-40 h-24 object-cover rounded-md border border-border hover:border-primary transition-colors" />
                          <p className="text-xs text-muted-foreground mt-1">Back</p>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medical" className="pt-6">
            <MedicalInfoCard
              studentId={id}
              preview={{
                medicalConditionsPreview: (student as any).medicalConditionsPreview,
                allergiesPreview: (student as any).allergiesPreview,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit student dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-2">
                <StudentAvatar fullName={editFullName || student.fullName} headshotPath={editHeadshotPath} className="w-20 h-20" textClassName="text-2xl" />
                <PhotoCaptureField
                  label="Update photo"
                  value={editHeadshotPath}
                  onChange={setEditHeadshotPath}
                  rounded
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editFullName} onChange={e => setEditFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. 0412 345 678" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Any notes about this student..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={updateStudent.isPending || !editFullName.trim()}
              onClick={async () => {
                try {
                  await updateStudent.mutateAsync({
                    id,
                    data: {
                      fullName: editFullName,
                      phone: editPhone || undefined,
                      notes: editNotes || undefined,
                      headshotPath: editHeadshotPath ?? undefined,
                    },
                  });
                  await qc.invalidateQueries({ queryKey: getGetStudentQueryKey(id) });
                  setEditOpen(false);
                  toast({ title: "Saved", description: "Student profile updated." });
                } catch {
                  toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
                }
              }}
            >
              {updateStudent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
