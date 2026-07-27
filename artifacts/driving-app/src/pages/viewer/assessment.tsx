import { useGetViewerAssessmentDetail } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowLeft, ChevronDown, ChevronUp, Calendar, Clock,
  Cloud, CloudRain, Sun, Wind, Eye, Moon, Sunrise, Sunset,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { getManeuverImage } from "@/lib/maneuver-images";

const PEDAL_LABELS: Record<string, string> = {
  standard: "Standard dual-control",
  instructor: "Instructor pedals only",
  student: "Student pedals only",
  none: "No pedal control",
};

const LEVEL_CONFIG: Record<string, { label: string; className: string }> = {
  not_attempted: { label: "Not Attempted",       className: "bg-gray-100 text-gray-800 border-gray-200" },
  attempted:     { label: "Attempted",            className: "bg-red-100 text-red-800 border-red-200" },
  practiced:     { label: "Not yet Competent",   className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  mastered:      { label: "Competent",            className: "bg-green-100 text-green-800 border-green-200" },
};

const WEATHER_ICONS: Record<string, React.ReactNode> = {
  clear:         <Sun className="w-4 h-4" />,
  partly_cloudy: <Cloud className="w-4 h-4" />,
  overcast:      <Cloud className="w-4 h-4" />,
  light_rain:    <CloudRain className="w-4 h-4" />,
  heavy_rain:    <CloudRain className="w-4 h-4" />,
  foggy:         <Eye className="w-4 h-4" />,
  windy:         <Wind className="w-4 h-4" />,
};
const WEATHER_LABELS: Record<string, string> = {
  clear: "Clear", partly_cloudy: "Partly Cloudy", overcast: "Overcast",
  light_rain: "Light Rain", heavy_rain: "Heavy Rain", foggy: "Foggy", windy: "Windy",
};
const LIGHTING_ICONS: Record<string, React.ReactNode> = {
  daylight: <Sun className="w-4 h-4" />,
  dawn:     <Sunrise className="w-4 h-4" />,
  dusk:     <Sunset className="w-4 h-4" />,
  night:    <Moon className="w-4 h-4" />,
};
const LIGHTING_LABELS: Record<string, string> = {
  daylight: "Daylight", dawn: "Dawn/Sunrise", dusk: "Dusk/Sunset", night: "Night",
};

export default function ViewerAssessment() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useGetViewerAssessmentDetail(Number(id), {
    query: { queryKey: ["/api/viewer/assessments", id] },
  });

  // Track which maneuver guidance panels are open
  const [openGuidance, setOpenGuidance] = useState<Set<number>>(new Set());

  const toggleGuidance = (maneuverId: number) => {
    setOpenGuidance(prev => {
      const next = new Set(prev);
      if (next.has(maneuverId)) next.delete(maneuverId);
      else next.add(maneuverId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (isError || !data) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <p className="text-muted-foreground">Unable to load this assessment. You may not have access.</p>
          <Button variant="outline" onClick={() => navigate("/viewer/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to dashboard
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  const { assessment, maneuverResults } = data;

  // Group results by category
  const grouped = maneuverResults.reduce((acc, r) => {
    const cat = r.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {} as Record<string, typeof maneuverResults>);

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-2xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              {format(new Date(assessment.lessonDate), "EEEE d MMMM yyyy")}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Lesson for <span className="font-medium text-foreground">{assessment.studentName}</span>
            </p>
          </div>
        </div>

        {/* Lesson summary card */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">{assessment.durationMinutes} min</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Pedal Control</p>
                <p className="font-medium">{PEDAL_LABELS[assessment.pedalOperator] ?? assessment.pedalOperator}</p>
              </div>
            </div>
            {assessment.weatherCondition && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-sky-600">{WEATHER_ICONS[assessment.weatherCondition]}</span>
                <div>
                  <p className="text-xs text-muted-foreground">Weather</p>
                  <p className="font-medium">{WEATHER_LABELS[assessment.weatherCondition] ?? assessment.weatherCondition}</p>
                </div>
              </div>
            )}
            {assessment.lightingCondition && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-500">{LIGHTING_ICONS[assessment.lightingCondition]}</span>
                <div>
                  <p className="text-xs text-muted-foreground">Lighting</p>
                  <p className="font-medium">{LIGHTING_LABELS[assessment.lightingCondition] ?? assessment.lightingCondition}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guidance notice for viewers */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900 font-medium">Supervising this lesson?</p>
          <p className="text-sm text-blue-800 mt-0.5">
            Tap the <span className="font-semibold">Guidance</span> button on any maneuver to see the QSAFE compliance criteria and reference images. Use these to ensure the assessment quality meets the standard.
          </p>
        </div>

        {/* Maneuver results by category */}
        {maneuverResults.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 gap-3">
              <p className="text-sm text-muted-foreground">No maneuver results recorded yet for this lesson.</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="bg-gray-50 border-b p-4">
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(r => {
                    const level = LEVEL_CONFIG[r.competencyLevel ?? "not_attempted"] ?? LEVEL_CONFIG.not_attempted;
                    const isOpen = openGuidance.has(r.maneuverId);
                    const hasGuidance = !!(r.complianceCriteria || r.masteryDefinition);

                    return (
                      <div key={r.id} className="p-4 sm:p-5">
                        {/* Row: name + badge + guidance toggle */}
                        <div className="flex items-center gap-3">
                          {(() => {
                            const img = getManeuverImage(r.maneuverName ?? "", r.category ?? "");
                            return img ? (
                              <img
                                src={img}
                                alt={r.maneuverName ?? ""}
                                className="w-[100px] h-[100px] shrink-0 rounded-xl object-cover border border-border"
                              />
                            ) : null;
                          })()}
                          <p className="font-medium text-base flex-1 min-w-0 truncate">
                            {r.maneuverName ?? "Unknown maneuver"}
                          </p>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-sm px-2 py-0.5 ${level.className}`}
                          >
                            {level.label}
                          </Badge>
                          {hasGuidance && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 gap-1.5 text-sm text-primary h-8"
                              onClick={() => toggleGuidance(r.maneuverId)}
                            >
                              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {isOpen ? "Hide" : "Guidance"}
                            </Button>
                          )}
                        </div>

                        {/* Notes from instructor */}
                        {r.notes && (
                          <p className="mt-1.5 text-sm text-muted-foreground italic">
                            {r.notes}
                          </p>
                        )}

                        {/* Expandable guidance */}
                        {isOpen && (
                          <div className="mt-4 space-y-4 border-t pt-4">

                            {r.complianceCriteria && (
                              <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
                                <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1.5">
                                  QSAFE Compliance Criteria
                                </p>
                                <p className="text-sm text-blue-900/80 whitespace-pre-wrap leading-relaxed">
                                  {r.complianceCriteria}
                                </p>
                              </div>
                            )}
                            {r.masteryDefinition && (
                              <div className="rounded-md bg-purple-50 border border-purple-100 p-3">
                                <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1.5">
                                  Competency Definition
                                </p>
                                <p className="text-sm text-purple-900/80 whitespace-pre-wrap leading-relaxed">
                                  {r.masteryDefinition}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Instructor notes — visible to viewer as context */}
        {(assessment.confidenceNote || assessment.focusAreasNext) && (
          <Card>
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-base">Instructor Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {assessment.confidenceNote && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Overall</p>
                  <p className="text-sm">{assessment.confidenceNote}</p>
                </div>
              )}
              {assessment.focusAreasNext && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Focus for Next Lesson</p>
                  <p className="text-sm">{assessment.focusAreasNext}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
