import { useGetStudent, useGetStudentProgress, useListAssessments, getGetStudentQueryKey, getGetStudentProgressQueryKey, getListAssessmentsQueryKey } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Calendar, Clock, Award, ChevronLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function InstructorStudentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: student, isLoading: isStudentLoading } = useGetStudent(id, { query: { enabled: !!id, queryKey: getGetStudentQueryKey(id) } });
  const { data: progress, isLoading: isProgressLoading } = useGetStudentProgress(id, { query: { enabled: !!id, queryKey: getGetStudentProgressQueryKey(id) } });
  const { data: assessments, isLoading: isAssessmentsLoading } = useListAssessments({ query: { queryKey: ["/api/assessments", { studentId: id }] } });

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
