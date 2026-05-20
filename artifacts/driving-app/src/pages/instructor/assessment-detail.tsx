import { useGetAssessment, getGetAssessmentQueryKey } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function ViewAssessment() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: assessment, isLoading } = useGetAssessment(id, { query: { enabled: !!id, queryKey: getGetAssessmentQueryKey(id) } });

  if (isLoading || !assessment) {
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
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/instructor/students/${assessment.studentId}`}>
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Student
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assessment Record</h1>
            <p className="text-muted-foreground">{format(new Date(assessment.lessonDate), 'PPP')} • {assessment.durationMinutes} mins</p>
          </div>
          <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
            {assessment.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="col-span-full">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle>Lesson Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confidence & Overall Notes</h4>
                <p className="text-foreground bg-gray-50/50 p-4 rounded-md border border-border min-h-24">
                  {assessment.confidenceNote || <span className="text-muted-foreground italic">No notes provided.</span>}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Focus Areas for Next Lesson</h4>
                <p className="text-foreground bg-gray-50/50 p-4 rounded-md border border-border min-h-16">
                  {assessment.focusAreasNext || <span className="text-muted-foreground italic">No focus areas provided.</span>}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full">
            <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between">
              <CardTitle>Maneuver Results</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* @ts-ignore - Assuming assessment has maneuverResults if it's an AssessmentDetail response or we need a new endpoint */}
              {assessment.maneuverResults && assessment.maneuverResults.length > 0 ? (
                 <div className="space-y-4">
                   {/* @ts-ignore */}
                   {assessment.maneuverResults.map((result: any) => (
                     <div key={result.id} className="flex justify-between items-center p-3 border-b last:border-0">
                       <span className="font-medium">{result.maneuverName}</span>
                       <Badge variant="outline" className={
                         result.competencyLevel === 'mastered' ? 'bg-green-100 text-green-800 border-green-200' :
                         result.competencyLevel === 'practiced' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                         result.competencyLevel === 'attempted' ? 'bg-red-100 text-red-800 border-red-200' :
                         'bg-gray-100 text-gray-800 border-gray-200'
                       }>
                         {result.competencyLevel.replace('_', ' ')}
                       </Badge>
                     </div>
                   ))}
                 </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p>No maneuvers were explicitly rated during this assessment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}
