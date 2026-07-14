import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, User, Calendar, Clock, CheckCircle2, AlertCircle, Mail, Star, MapPin } from "lucide-react";
import AssessmentRouteMap from "@/components/AssessmentRouteMap";

// ─── Competency helpers ───────────────────────────────────────────────────────

const COMPETENCY_CONFIG: Record<string, { label: string; className: string; rank: number }> = {
  mastered:      { label: "Competent",         className: "bg-green-100 text-green-800 border-green-200",  rank: 3 },
  practiced:     { label: "Not yet Competent", className: "bg-yellow-100 text-yellow-800 border-yellow-200", rank: 2 },
  attempted:     { label: "Attempted",     className: "bg-red-100 text-red-800 border-red-200",     rank: 1 },
  not_attempted: { label: "Not Attempted", className: "bg-gray-100 text-gray-600 border-gray-200",  rank: 0 },
};

const FINALIZATION_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft:            { label: "Draft",            className: "bg-gray-100 text-gray-700 border-gray-200", icon: <BookOpen className="w-3.5 h-3.5" /> },
  pending_approval: { label: "Pending Approval", className: "bg-amber-100 text-amber-800 border-amber-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  approved:         { label: "Approved",         className: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  dispatched:       { label: "Report Dispatched", className: "bg-teal-100 text-teal-800 border-teal-200", icon: <Mail className="w-3.5 h-3.5" /> },
};

const PEDAL_LABEL: Record<string, string> = {
  student: "Student controls pedals",
  instructor: "Instructor controls pedals (dual control)",
  shared: "Shared pedal control",
};

// ─── Component ────────────────────────────────────────────────────────────────

type ManeuverResult = {
  id: number;
  maneuverId: number;
  maneuverName?: string | null;
  category?: string | null;
  competencyLevel: string;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  qsafe: "QSAFE — Light Vehicle",
  qride: "Q-Ride — Motorcycle / E-Bike",
  heavy_vehicle: "Heavy Vehicle (MR/HR/HC/MC)",
};

type ReportPreviewProps = {
  assessment: {
    id: number;
    studentName?: string | null;
    instructorName?: string | null;
    lessonDate: string;
    durationMinutes: number;
    status: string;
    assessmentType?: string | null;
    pedalOperator?: string | null;
    confidenceNote?: string | null;
    focusAreasNext?: string | null;
    finalizationStatus?: string | null;
    approvedAt?: string | null;
    approvedByUserId?: number | null;
    reportDispatchedAt?: string | null;
    reportDispatchedTo?: string | null;
    maneuverResults?: ManeuverResult[];
    routePath?: Array<{ lat: number; lng: number; ts: number }> | null;
  };
  /** Compact mode for inline rendering inside a Sheet — omits outer padding */
  compact?: boolean;
};

export function ReportPreview({ assessment, compact = false }: ReportPreviewProps) {
  // Group maneuver results by category
  const grouped = useMemo(() => {
    const results = assessment.maneuverResults ?? [];
    const map = new Map<string, ManeuverResult[]>();
    for (const r of results) {
      const cat = r.category ?? "Uncategorised";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return map;
  }, [assessment.maneuverResults]);

  const masteredCount = (assessment.maneuverResults ?? []).filter(r => r.competencyLevel === "mastered").length;
  const totalCount = (assessment.maneuverResults ?? []).length;

  const finConfig = FINALIZATION_CONFIG[assessment.finalizationStatus ?? "draft"] ?? FINALIZATION_CONFIG.draft;

  const dispatchEmails: string[] = useMemo(() => {
    if (!assessment.reportDispatchedTo) return [];
    try { return JSON.parse(assessment.reportDispatchedTo); } catch { return []; }
  }, [assessment.reportDispatchedTo]);

  const formattedDate = useMemo(() => {
    try { return format(new Date(assessment.lessonDate), "EEEE d MMMM yyyy"); }
    catch { return assessment.lessonDate; }
  }, [assessment.lessonDate]);

  const maneuverPoints = useMemo(() => {
    return (assessment.maneuverResults ?? [])
      .filter(r => typeof r.lat === "number" && typeof r.lng === "number")
      .map(r => ({
        lat: r.lat as number,
        lng: r.lng as number,
        maneuverId: r.maneuverId,
        name: r.maneuverName ?? "Maneuver",
        level: r.competencyLevel,
      }));
  }, [assessment.maneuverResults]);

  const hasRoutePath = (assessment.routePath?.length ?? 0) > 0 || maneuverPoints.length > 0;

  const wrapClass = compact ? "space-y-5" : "space-y-5 p-1";

  return (
    <div className={wrapClass}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base text-foreground">Learner Log</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Lesson Assessment Report</h2>
          <p className="text-sm text-muted-foreground">Report #{assessment.id}</p>
        </div>
        <Badge
          variant="outline"
          className={`flex items-center gap-1.5 shrink-0 ${finConfig.className}`}
        >
          {finConfig.icon}
          {finConfig.label}
        </Badge>
      </div>

      <Separator />

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Student</p>
            <p className="font-medium">{assessment.studentName ?? "Unknown"}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Star className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Instructor</p>
            <p className="font-medium">{assessment.instructorName ?? "Unknown"}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Lesson Date</p>
            <p className="font-medium">{formattedDate}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium">{assessment.durationMinutes} minutes</p>
          </div>
        </div>
        {assessment.assessmentType && (
          <div className="col-span-2 flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Assessment Program</p>
              <p className="font-medium">{ASSESSMENT_TYPE_LABELS[assessment.assessmentType] ?? assessment.assessmentType}</p>
            </div>
          </div>
        )}
      </div>

      {assessment.pedalOperator && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 border border-border">
          <strong>Pedal control:</strong> {PEDAL_LABEL[assessment.pedalOperator] ?? assessment.pedalOperator}
        </p>
      )}

      <Separator />

      {/* Maneuver summary stats */}
      {totalCount > 0 && (
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Maneuvers assessed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-700">{masteredCount}</p>
            <p className="text-xs text-muted-foreground">Competent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-700">
              {(assessment.maneuverResults ?? []).filter(r => r.competencyLevel === "practiced").length}
            </p>
            <p className="text-xs text-muted-foreground">Practiced</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-700">
              {(assessment.maneuverResults ?? []).filter(r => r.competencyLevel === "attempted").length}
            </p>
            <p className="text-xs text-muted-foreground">Attempted</p>
          </div>
        </div>
      )}

      {/* Maneuvers grouped by category */}
      {grouped.size > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Maneuver Results</h3>
          {Array.from(grouped.entries()).map(([category, results]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category}</p>
              <div className="space-y-1.5">
                {results.map(r => {
                  const cfg = COMPETENCY_CONFIG[r.competencyLevel] ?? COMPETENCY_CONFIG.not_attempted;
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-2 p-2.5 rounded-md border border-border bg-white">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{r.maneuverName ?? "Unknown"}</p>
                        {r.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-xs ${cfg.className}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <CheckCircle2 className="w-5 h-5 mr-2 text-gray-300" />
          No maneuver results recorded.
        </div>
      )}

      <Separator />

      {/* Notes */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Overall Confidence & Notes</h3>
          <p className="text-sm bg-gray-50 rounded-md border border-border p-3 whitespace-pre-wrap min-h-[3rem]">
            {assessment.confidenceNote || <span className="text-muted-foreground italic">No notes provided.</span>}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Focus Areas for Next Lesson</h3>
          <p className="text-sm bg-gray-50 rounded-md border border-border p-3 whitespace-pre-wrap min-h-[2.5rem]">
            {assessment.focusAreasNext || <span className="text-muted-foreground italic">No focus areas provided.</span>}
          </p>
        </div>
      </div>

      {/* Lesson route map — GPS trail recorded during the drive */}
      <Separator />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Lesson Route
        </h3>
        {/* Map is hidden in print — Leaflet canvas doesn't reproduce in PDF */}
        <div className="print:hidden">
          <AssessmentRouteMap
            routePath={assessment.routePath}
            maneuverPoints={maneuverPoints}
          />
        </div>
        {/* Print-only substitute */}
        <p className="hidden print:block text-xs text-muted-foreground border border-dashed border-gray-300 rounded px-3 py-4 text-center">
          {hasRoutePath
            ? "GPS route recorded — view the interactive map in the Learner Log app."
            : "No GPS route was recorded for this lesson."}
        </p>
        {!hasRoutePath && (
          <p className="text-xs text-muted-foreground print:hidden">
            No GPS route was recorded for this lesson.
          </p>
        )}
      </div>

      {/* Dispatch record */}
      {assessment.reportDispatchedAt && (
        <>
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1 bg-teal-50/60 border border-teal-100 rounded-md px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-teal-700 font-medium mb-1">
              <Mail className="w-3.5 h-3.5" />
              Report Dispatched
            </div>
            <p>
              Dispatched on{" "}
              {format(new Date(assessment.reportDispatchedAt), "d MMM yyyy 'at' HH:mm")}
            </p>
            {dispatchEmails.length > 0 && (
              <p>To: {dispatchEmails.join(", ")}</p>
            )}
            {dispatchEmails.length === 0 && (
              <p className="text-muted-foreground">No email recipients recorded.</p>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <Separator />
      <p className="text-xs text-muted-foreground text-center">
        Learner Log — Driving Assessment Platform &bull; Generated {format(new Date(), "d MMM yyyy")}
      </p>
    </div>
  );
}
