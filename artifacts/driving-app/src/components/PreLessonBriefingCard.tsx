/**
 * PreLessonBriefingCard — safety summary shown at the top of the handover view
 * and embedded in the assessment start flow.
 *
 * Shows:
 * - Pedal control assignment for this student
 * - Safety-critical handover notes (if any)
 * - Medical/allergy preview (if on file)
 * - Latest focus areas
 * - Acknowledgement button (records preLessonBriefingAcknowledgedAt on the assessment)
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldAlert, Pill, Target, ChevronDown, ChevronUp } from "lucide-react";
import { PedalControlBadge } from "@/components/PedalControlSelector";
import { cn } from "@/lib/utils";

type SafetyCriticalNote = {
  id: number;
  note: string;
  focusAreas?: string | null;
  instructorName?: string | null;
  createdAt: string;
};

type BriefingData = {
  pedalOperator?: string | null;
  safetyCriticalNotes?: SafetyCriticalNote[];
  medicalConditionsPreview?: string | null;
  allergiesPreview?: string | null;
  latestFocusAreas?: string | null;
};

type Props = {
  briefing: BriefingData;
  studentName?: string;
  assessmentId?: number;
  isAcknowledged?: boolean;
  acknowledgedAt?: string | null;
  onAcknowledge?: () => Promise<void>;
  className?: string;
  readOnly?: boolean;
};

export function PreLessonBriefingCard({
  briefing,
  studentName,
  assessmentId,
  isAcknowledged,
  acknowledgedAt,
  onAcknowledge,
  className,
  readOnly,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const hasAlerts = !!(
    (briefing.safetyCriticalNotes?.length ?? 0) > 0 ||
    briefing.medicalConditionsPreview ||
    briefing.allergiesPreview
  );

  async function handleAcknowledge() {
    if (!onAcknowledge) return;
    setIsAcknowledging(true);
    try {
      await onAcknowledge();
    } finally {
      setIsAcknowledging(false);
    }
  }

  return (
    <Card
      className={cn(
        "border-2",
        hasAlerts ? "border-amber-400 bg-amber-50" : "border-green-300 bg-green-50",
        isAcknowledged && "border-green-500 bg-green-50",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className={cn("text-sm font-bold flex items-center gap-2", hasAlerts ? "text-amber-900" : "text-green-900")}>
            {hasAlerts
              ? <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              : <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            }
            Pre-Lesson Safety Briefing
            {hasAlerts && (
              <Badge className="bg-amber-500 text-white text-xs">Alerts</Badge>
            )}
            {isAcknowledged && (
              <Badge className="bg-green-600 text-white text-xs">Acknowledged</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => setIsExpanded(prev => !prev)}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
        {studentName && (
          <p className="text-xs text-muted-foreground">{studentName}</p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Pedal control */}
          {briefing.pedalOperator && (
            <div>
              <p className="text-xs font-semibold text-foreground/70 mb-1">Pedal control</p>
              <PedalControlBadge operator={briefing.pedalOperator} />
            </div>
          )}

          {/* Safety-critical notes */}
          {(briefing.safetyCriticalNotes?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-900 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Safety notes
              </p>
              <div className="space-y-2">
                {briefing.safetyCriticalNotes!.map(note => (
                  <div key={note.id} className="bg-white border border-amber-300 rounded-md px-3 py-2 text-xs">
                    <p className="font-medium text-amber-900">{note.note}</p>
                    {note.focusAreas && (
                      <p className="text-amber-700 mt-1 italic">Focus: {note.focusAreas}</p>
                    )}
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      {note.instructorName ? `${note.instructorName} · ` : ""}
                      {new Date(note.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical / allergy previews */}
          {(briefing.medicalConditionsPreview || briefing.allergiesPreview) && (
            <div className="bg-white border border-amber-300 rounded-md px-3 py-2 space-y-1">
              {briefing.medicalConditionsPreview && (
                <p className="text-xs flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-semibold">Medical:</span> {briefing.medicalConditionsPreview}
                </p>
              )}
              {briefing.allergiesPreview && (
                <p className="text-xs flex items-center gap-1.5 text-amber-900">
                  <Pill className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-semibold">Allergies:</span> {briefing.allergiesPreview}
                </p>
              )}
            </div>
          )}

          {/* Latest focus areas */}
          {briefing.latestFocusAreas && (
            <div>
              <p className="text-xs font-semibold text-foreground/70 mb-1 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Latest focus areas
              </p>
              <p className="text-sm text-foreground/80 italic">"{briefing.latestFocusAreas}"</p>
            </div>
          )}

          {/* No alerts */}
          {!hasAlerts && !briefing.pedalOperator && !briefing.latestFocusAreas && (
            <p className="text-xs text-green-700">No safety alerts on file. Proceed with lesson as normal.</p>
          )}

          {/* Acknowledge button */}
          {!readOnly && !isAcknowledged && onAcknowledge && (
            <div className="pt-1">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                {isAcknowledging ? "Acknowledging…" : "Acknowledge briefing"}
              </Button>
            </div>
          )}

          {isAcknowledged && acknowledgedAt && (
            <p className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Acknowledged {new Date(acknowledgedAt).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
