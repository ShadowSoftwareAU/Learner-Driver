import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, History, ArrowDownToLine } from "lucide-react";
import { useListAssessments } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useMemo } from "react";

interface PreviousLessonCardProps {
  studentId: number | null;
  onUseFocus: (focus: string) => void;
}

export function PreviousLessonCard({ studentId, onUseFocus }: PreviousLessonCardProps) {
  const enabled = !!studentId;
  const { data: assessments, isLoading } = useListAssessments(
    enabled ? { studentId } : undefined,
    {
      query: {
        enabled,
        queryKey: ["/api/assessments", { studentId }],
      },
    },
  );

  const previous = useMemo(() => {
    if (!assessments || assessments.length === 0) return null;
    const sorted = [...assessments].sort(
      (a, b) => new Date(b.lessonDate).getTime() - new Date(a.lessonDate).getTime(),
    );
    return sorted[0];
  }, [assessments]);

  if (!enabled) return null;

  if (isLoading) {
    return (
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading previous lesson…</span>
        </CardContent>
      </Card>
    );
  }

  if (!previous) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <History className="w-4 h-4" />
          No previous lessons for this student yet. This will be their first recorded assessment.
        </CardContent>
      </Card>
    );
  }

  const hasFocus = !!previous.focusAreasNext && previous.focusAreasNext.trim().length > 0;

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardHeader className="p-6 pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
          <History className="w-4 h-4" />
          Previous Lesson Carry Forward
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          {format(new Date(previous.lessonDate), "PPP")} · {previous.durationMinutes} minutes
        </p>
        {previous.confidenceNote && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Overall Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{previous.confidenceNote}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Focus Areas Set Last Lesson</p>
          {hasFocus ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{previous.focusAreasNext}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No focus areas were set last time.</p>
          )}
        </div>
        {hasFocus && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 gap-2 bg-white"
            onClick={() => onUseFocus(previous.focusAreasNext ?? "")}
          >
            <ArrowDownToLine className="w-4 h-4" />
            Use as today's focus
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
