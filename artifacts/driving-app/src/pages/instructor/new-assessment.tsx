import { useListManeuvers, useCreateAssessment, useSaveManeuverResults, useListStudents, useUpdateAssessment, useGetAssessment, getGetAssessmentQueryKey, useGetMyVehicles } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, Check, Save, ChevronDown, ChevronUp, PlayCircle,
  Car, Bike, Truck, AlertTriangle, ShieldCheck, Sun, Cloud,
  CloudRain, Wind, Eye, Moon, Sunrise, Sunset, Pencil,
} from "lucide-react";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocation, useSearch, Link } from "wouter";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  ManeuverResultItemCompetencyLevel, PedalOperator, PedalOperatorLabel, PedalOperatorDescription,
  WeatherCondition, WeatherConditionLabel, LightingCondition, LightingConditionLabel,
} from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";
import { PreviousLessonCard } from "@/components/PreviousLessonCard";
import { QuickNoteChips } from "@/components/QuickNoteChips";
import { CategorySummary } from "@/components/CategorySummary";
import { getManeuverImage } from "@/lib/maneuver-images";
import { getManeuverChips } from "@/lib/maneuver-chips";
import { loadAssessmentDraft, saveAssessmentDraft, clearAssessmentDraft } from "@/lib/assessment-draft";
import { ViewToggle, useViewMode } from "@/components/assessment/ViewToggle";
import { AssessmentTileView } from "@/components/assessment/AssessmentTileView";
import { PedalControlSelector } from "@/components/PedalControlSelector";

type AssessmentType = "qsafe" | "qride" | "heavy_vehicle";

const ASSESSMENT_TYPES: { value: AssessmentType; label: string; subtitle: string; reg: string; icon: React.ReactNode }[] = [
  { value: "qsafe", label: "QSAFE", subtitle: "Light Vehicle (Car, SUV, Van)", reg: "Driver Licensing Reg 2021, Ch. 3", icon: <Car className="w-6 h-6" /> },
  { value: "qride", label: "Q-Ride", subtitle: "Motorcycle / E-Bike", reg: "Accreditation Reg 2015, s. 33–41", icon: <Bike className="w-6 h-6" /> },
  { value: "heavy_vehicle", label: "Heavy Vehicle", subtitle: "MR / HR / HC / MC", reg: "Driver Licensing Reg 2021, s. 57–60", icon: <Truck className="w-6 h-6" /> },
];

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; icon: React.ReactNode }[] = [
  { value: WeatherCondition.clear, label: WeatherConditionLabel.clear, icon: <Sun className="w-4 h-4" /> },
  { value: WeatherCondition.partly_cloudy, label: WeatherConditionLabel.partly_cloudy, icon: <Cloud className="w-4 h-4" /> },
  { value: WeatherCondition.overcast, label: WeatherConditionLabel.overcast, icon: <Cloud className="w-4 h-4" /> },
  { value: WeatherCondition.light_rain, label: WeatherConditionLabel.light_rain, icon: <CloudRain className="w-4 h-4" /> },
  { value: WeatherCondition.heavy_rain, label: WeatherConditionLabel.heavy_rain, icon: <CloudRain className="w-4 h-4" /> },
  { value: WeatherCondition.foggy, label: WeatherConditionLabel.foggy, icon: <Eye className="w-4 h-4" /> },
  { value: WeatherCondition.windy, label: WeatherConditionLabel.windy, icon: <Wind className="w-4 h-4" /> },
];

const LIGHTING_OPTIONS: { value: LightingCondition; label: string; icon: React.ReactNode }[] = [
  { value: LightingCondition.daylight, label: LightingConditionLabel.daylight, icon: <Sun className="w-4 h-4" /> },
  { value: LightingCondition.dawn, label: LightingConditionLabel.dawn, icon: <Sunrise className="w-4 h-4" /> },
  { value: LightingCondition.dusk, label: LightingConditionLabel.dusk, icon: <Sunset className="w-4 h-4" /> },
  { value: LightingCondition.night, label: LightingConditionLabel.night, icon: <Moon className="w-4 h-4" /> },
];

export default function NewAssessment() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const { data: maneuvers, isLoading: isManeuversLoading } = useListManeuvers();
  const createAssessment = useCreateAssessment();
  const saveResults = useSaveManeuverResults();
  const updateAssessment = useUpdateAssessment();

  const currentPositionRef = useRef<GeolocationCoordinates | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    // watchPosition keeps the ref current throughout the lesson.
    // A single getCurrentPosition call goes stale in seconds at driving speed.
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => { currentPositionRef.current = pos.coords; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, []);

  const urlParams = new URLSearchParams(search);
  const urlStudentId = urlParams.get("studentId") ?? "";
  const urlDuration = urlParams.get("durationMinutes") ?? "60";
  const resumeIdRaw = urlParams.get("resume");
  const resumeId = resumeIdRaw ? parseInt(resumeIdRaw, 10) : null;

  // Load existing assessment when resuming a saved in-progress session
  const { data: existingAssessment, isLoading: isResumeLoading } = useGetAssessment(resumeId ?? 0, {
    query: { enabled: !!resumeId, queryKey: getGetAssessmentQueryKey(resumeId ?? 0) },
  });

  // ── Draft hydration ───────────────────────────────────────────────────────
  // Loaded once synchronously in the useState initialiser so the correct
  // values are available on the very first render — no flash of empty state.
  const [initialDraft] = useState(() => loadAssessmentDraft());
  // Prevents the write-effect from re-saving after an explicit clear.
  const draftClearedRef = useRef(false);

  // ── Setup state (collected in the modal) ──────────────────────────────────
  // Skip the modal entirely when restoring a completed draft.
  const [setupOpen, setSetupOpen] = useState(() => !(initialDraft?.setupDone));
  const [setupDone, setSetupDone] = useState(() => initialDraft?.setupDone ?? false);

  const [assessmentType, setAssessmentType] = useState<AssessmentType>(
    () => (initialDraft?.assessmentType as AssessmentType) ?? "qsafe"
  );
  // URL param wins for studentId (e.g. "New Assessment" tapped from a student's profile)
  const [studentId, setStudentId] = useState<string>(
    () => urlStudentId || initialDraft?.studentId || ""
  );
  const [duration, setDuration] = useState(() => initialDraft?.duration ?? urlDuration);
  const [date, setDate] = useState(
    () => initialDraft?.date ?? new Date().toISOString().split("T")[0]
  );
  const [pedalOperator, setPedalOperator] = useState<PedalOperator | "">(
    () => (initialDraft?.pedalOperator as PedalOperator | "") ?? ""
  );
  const [fitnessConfirmed, setFitnessConfirmed] = useState(
    () => initialDraft?.fitnessConfirmed ?? false
  );
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition | "">(
    () => (initialDraft?.weatherCondition as WeatherCondition | "") ?? ""
  );
  const [lightingCondition, setLightingCondition] = useState<LightingCondition | "">(
    () => (initialDraft?.lightingCondition as LightingCondition | "") ?? ""
  );
  const [vehicleId, setVehicleId] = useState<number | null>(
    () => (initialDraft as any)?.vehicleId ?? null
  );

  // Fetch instructor's own active vehicles for the vehicle selector
  const { data: myVehiclesRaw } = useGetMyVehicles();
  const myVehicles = ((myVehiclesRaw as any[]) ?? []).filter((v: any) => v.status === "active");

  // ── Assessment state ──────────────────────────────────────────────────────
  const [results, setResults] = useState<Record<number, ManeuverResultItemCompetencyLevel>>(
    () => (initialDraft?.results as Record<number, ManeuverResultItemCompetencyLevel>) ?? {}
  );
  const [maneuverNotes, setManeuverNotes] = useState<Record<number, string>>(
    () => initialDraft?.maneuverNotes ?? {}
  );
  const [maneuverLocations, setManeuverLocations] = useState<Record<number, { lat: number; lng: number }>>(
    () => (initialDraft?.maneuverLocations as Record<number, { lat: number; lng: number }>) ?? {}
  );
  const [expandedManeuver, setExpandedManeuver] = useState<number | null>(null);
  const [confidenceNote, setConfidenceNote] = useState(
    () => initialDraft?.confidenceNote ?? ""
  );
  const [focusAreas, setFocusAreas] = useState(() => initialDraft?.focusAreas ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode();
  // Tracks whether we've already hydrated form state from an existing (resumed) assessment
  const [resumeHydrated, setResumeHydrated] = useState(false);

  // Toast once when a localStorage draft is restored (only when not in resume mode)
  useEffect(() => {
    if (!resumeId && initialDraft?.setupDone) {
      toast({
        title: "Draft restored",
        description: "Your in-progress assessment has been recovered.",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate form from an existing assessment when the ?resume=ID URL param is present.
  // Runs once after the API fetch resolves; overwrites any localStorage draft state.
  useEffect(() => {
    if (!resumeId || !existingAssessment || resumeHydrated) return;
    const a = existingAssessment as any;
    setAssessmentType((a.assessmentType as AssessmentType) ?? "qsafe");
    setStudentId(a.studentId?.toString() ?? "");
    setDate(a.lessonDate ?? new Date().toISOString().split("T")[0]);
    setDuration(a.durationMinutes?.toString() ?? "60");
    setPedalOperator((a.pedalOperator as PedalOperator) ?? "");
    setWeatherCondition((a.weatherCondition as WeatherCondition) ?? "");
    setLightingCondition((a.lightingCondition as LightingCondition) ?? "");
    setConfidenceNote(a.confidenceNote ?? "");
    setFocusAreas(a.focusAreasNext ?? "");
    setFitnessConfirmed(true); // already confirmed when the assessment was originally created
    setVehicleId((a as any).vehicleId ?? null);
    setSetupDone(true);
    setSetupOpen(false);
    // Rebuild maneuver result maps from saved results
    if (Array.isArray(a.maneuverResults)) {
      const resultsMap: Record<number, ManeuverResultItemCompetencyLevel> = {};
      const notesMap: Record<number, string> = {};
      const locationsMap: Record<number, { lat: number; lng: number }> = {};
      for (const r of a.maneuverResults) {
        if (r.competencyLevel && r.competencyLevel !== "not_attempted") {
          resultsMap[r.maneuverId] = r.competencyLevel as ManeuverResultItemCompetencyLevel;
        }
        if (r.notes) notesMap[r.maneuverId] = r.notes;
        if (r.lat != null && r.lng != null) locationsMap[r.maneuverId] = { lat: r.lat, lng: r.lng };
      }
      setResults(resultsMap);
      setManeuverNotes(notesMap);
      setManeuverLocations(locationsMap);
    }
    toast({ title: "Assessment loaded", description: "Pick up where you left off — existing ratings have been pre-filled." });
    setResumeHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, existingAssessment, resumeHydrated]);

  // Debounced sync — writes to localStorage 400 ms after the last state change.
  // The ref guard ensures we never re-save after an explicit clear.
  useEffect(() => {
    if (draftClearedRef.current) return;
    const timer = setTimeout(() => {
      if (draftClearedRef.current) return;
      saveAssessmentDraft({
        assessmentType, studentId, date, duration, pedalOperator,
        fitnessConfirmed, weatherCondition, lightingCondition,
        vehicleId,
        results, maneuverNotes, maneuverLocations, confidenceNote, focusAreas, setupDone,
      } as any);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    assessmentType, studentId, date, duration, pedalOperator,
    fitnessConfirmed, weatherCondition, lightingCondition, vehicleId,
    results, maneuverNotes, confidenceNote, focusAreas, setupDone,
  ]);

  const groupedManeuvers = useMemo(() => {
    if (!maneuvers) return {};
    return maneuvers.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, typeof maneuvers>);
  }, [maneuvers]);

  // Enrich with current competency level so tile summary badges stay live
  const groupedWithLevels = useMemo(() => {
    return Object.fromEntries(
      Object.entries(groupedManeuvers).map(([cat, items]) => [
        cat,
        items.map(m => ({ ...m, competencyLevel: results[m.id] ?? "not_attempted" })),
      ])
    );
  }, [groupedManeuvers, results]);

  const handleLevelSelect = (maneuverId: number, level: ManeuverResultItemCompetencyLevel) => {
    setResults(prev => ({ ...prev, [maneuverId]: level }));
    // Stamp current GPS position at the moment of rating selection.
    // Stored per-maneuver for the compliance route map and sent to the API.
    const pos = currentPositionRef.current;
    if (pos) {
      setManeuverLocations(prev => ({
        ...prev,
        [maneuverId]: { lat: pos.latitude, lng: pos.longitude },
      }));
    }
  };

  const handleManeuverNoteChange = (maneuverId: number, note: string) => {
    setManeuverNotes(prev => ({ ...prev, [maneuverId]: note }));
  };

  const toggleExpanded = (maneuverId: number) => {
    setExpandedManeuver(prev => prev === maneuverId ? null : maneuverId);
  };

  // Setup form validation
  const setupErrors = useMemo(() => {
    const errs: string[] = [];
    if (!studentId) errs.push("Please select a student.");
    if (!pedalOperator) errs.push("Please select who controls the pedals.");
    if (!weatherCondition) errs.push("Please select the weather condition.");
    if (!lightingCondition) errs.push("Please select the lighting condition.");
    if (!fitnessConfirmed) errs.push("Please confirm the pre-drive safety check.");
    return errs;
  }, [studentId, pedalOperator, weatherCondition, lightingCondition, fitnessConfirmed]);

  const handleSetupConfirm = () => {
    if (setupErrors.length > 0) {
      toast({ title: "Setup incomplete", description: setupErrors[0], variant: "destructive" });
      return;
    }
    setSetupOpen(false);
    setSetupDone(true);
  };

  const handleSave = async () => {
    if (!studentId || !pedalOperator || !fitnessConfirmed) {
      setSetupOpen(true);
      return;
    }
    setIsSubmitting(true);

    const maneuverResultsArray = Object.entries(results).map(([id, level]) => ({
      maneuverId: parseInt(id),
      competencyLevel: level,
      notes: maneuverNotes[parseInt(id)] || undefined,
      lat: maneuverLocations[parseInt(id)]?.lat ?? undefined,
      lng: maneuverLocations[parseInt(id)]?.lng ?? undefined,
    }));

    try {
      if (resumeId) {
        // ── Resuming an existing in-progress assessment ──────────────────────
        // PATCH the existing record with any updated details, then upsert results.
        await updateAssessment.mutateAsync({
          id: resumeId,
          data: {
            confidenceNote: confidenceNote || undefined,
            focusAreasNext: focusAreas || undefined,
            durationMinutes: parseInt(duration),
            pedalOperator: (pedalOperator || undefined) as any,
            weatherCondition: (weatherCondition || undefined) as any,
            lightingCondition: (lightingCondition || undefined) as any,
          } as any,
        });
        if (maneuverResultsArray.length > 0) {
          await saveResults.mutateAsync({ id: resumeId, data: { results: maneuverResultsArray } });
        }
        toast({ title: "Assessment updated", description: "Changes saved. Ready to submit when you're done." });
        draftClearedRef.current = true;
        clearAssessmentDraft();
        setLocation(`/instructor/assessments/${resumeId}`);
      } else {
        // ── Creating a fresh assessment ──────────────────────────────────────
        const assessment = await createAssessment.mutateAsync({
          data: {
            studentId: parseInt(studentId),
            lessonDate: new Date(date).toISOString(),
            durationMinutes: parseInt(duration),
            assessmentType,
            pedalOperator: pedalOperator || undefined,
            confidenceNote,
            focusAreasNext: focusAreas,
            acknowledgeFitness: true,
            weatherCondition: weatherCondition || undefined,
            lightingCondition: lightingCondition || undefined,
            vehicleId: vehicleId ?? undefined,
          } as any,
        });
        if (maneuverResultsArray.length > 0) {
          await saveResults.mutateAsync({ id: assessment.id, data: { results: maneuverResultsArray } });
        }
        toast({ title: "Assessment saved", description: "Assessment saved successfully." });
        draftClearedRef.current = true;
        clearAssessmentDraft();
        setLocation(`/instructor/assessments/${assessment.id}`);
      }
    } catch {
      toast({ title: "Error", description: "Failed to save assessment.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isStudentsLoading || isManeuversLoading || (resumeId && isResumeLoading)) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const selectedStudent = students?.find(s => s.id.toString() === studentId);

  const handleConfirmedCancel = () => {
    draftClearedRef.current = true;
    clearAssessmentDraft();
    setLocation(resumeId ? `/instructor/assessments/${resumeId}` : "/instructor/students");
  };

  return (
    <SidebarLayout>
      {/* ── Cancel confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              All maneuver ratings, notes, and setup details entered so far will be permanently lost.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Setup Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-xl w-full p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-xl">New Assessment Setup</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Complete these details before starting the assessment.
            </p>
          </DialogHeader>

          <ScrollArea className="max-h-[80vh]">
            <div className="px-6 pb-6 space-y-6 pt-4">

              {/* Assessment Program */}
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-base">Assessment Program</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Each program is governed by separate Queensland transport legislation.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ASSESSMENT_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setAssessmentType(type.value)}
                      className={`rounded-lg border-2 p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        assessmentType === type.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className={`mb-1.5 ${assessmentType === type.value ? "text-primary" : "text-muted-foreground"}`}>
                        {type.icon}
                      </div>
                      <p className="font-semibold text-sm">{type.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{type.subtitle}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{type.reg}</p>
                      {assessmentType === type.value && (
                        <Badge className="mt-1.5 bg-primary/10 text-primary border-primary/20 text-xs" variant="outline">Selected</Badge>
                      )}
                    </button>
                  ))}
                </div>
                {assessmentType !== "qsafe" && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">{assessmentType === "qride" ? "Q-Ride" : "Heavy Vehicle"} checklist coming soon.</span>{" "}
                      Using the QSAFE checklist as a placeholder.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Lesson Details */}
              <div className="space-y-3">
                <p className="font-semibold text-base">Lesson Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-student">Student</Label>
                    <select
                      id="setup-student"
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                      className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Select student</option>
                      {students?.map(s => (
                        <option key={s.id} value={s.id.toString()}>{s.fullName}</option>
                      ))}
                    </select>
                    {selectedStudent && (
                      <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md bg-muted/50 border border-border">
                        <StudentAvatar fullName={selectedStudent.fullName} headshotPath={selectedStudent.headshotPath} className="w-8 h-8" textClassName="text-xs" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs truncate">{selectedStudent.fullName}</p>
                          {selectedStudent.totalHours != null && <p className="text-xs text-muted-foreground">{selectedStudent.totalHours}h logged</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration (mins)</Label>
                    <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="h-12" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Vehicle */}
              {myVehicles.length > 0 && (
                <>
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-base">Vehicle</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Which vehicle is being used for this lesson?</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {myVehicles.map((v: any) => {
                        const selected = vehicleId === v.id;
                        const label = [v.year, v.make, v.model].filter(Boolean).join(" ");
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVehicleId(selected ? null : v.id)}
                            className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              selected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <Car className={`w-5 h-5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium leading-tight ${selected ? "text-primary" : ""}`}>{label}</p>
                              <p className="text-xs text-muted-foreground">
                                {v.transmissionType === "auto" ? "Automatic" : "Manual"}
                                {v.controlType === "dual_control" ? " · Dual controls" : ""}
                                {v.rego ? ` · ${v.rego}` : ""}
                              </p>
                            </div>
                            {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {vehicleId === null && (
                      <p className="text-xs text-muted-foreground">No vehicle selected — leave blank if not applicable.</p>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* Pedal Control */}
              <div className="space-y-3">
                <p className="font-semibold text-base">Pedal Control</p>
                <PedalControlSelector value={pedalOperator} onChange={setPedalOperator} />
              </div>

              <Separator />

              {/* Weather Condition */}
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-base">Weather Condition</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Select the weather at the time of this lesson.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WEATHER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setWeatherCondition(opt.value)}
                      className={`rounded-lg border-2 p-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col items-center gap-1.5 ${
                        weatherCondition === opt.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <span className={weatherCondition === opt.value ? "text-primary" : "text-muted-foreground"}>
                        {opt.icon}
                      </span>
                      <span className="text-xs font-medium text-center leading-tight">{opt.label}</span>
                      {weatherCondition === opt.value && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
                {!weatherCondition && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Please select a weather condition.
                  </p>
                )}
              </div>

              <Separator />

              {/* Lighting Condition */}
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-base">Lighting Condition</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Select the light level at the time of this lesson.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LIGHTING_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLightingCondition(opt.value)}
                      className={`rounded-lg border-2 p-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col items-center gap-1.5 ${
                        lightingCondition === opt.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <span className={lightingCondition === opt.value ? "text-primary" : "text-muted-foreground"}>
                        {opt.icon}
                      </span>
                      <span className="text-xs font-medium text-center">{opt.label}</span>
                      {lightingCondition === opt.value && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
                {!lightingCondition && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Please select a lighting condition.
                  </p>
                )}
              </div>

              <Separator />

              {/* Pre-drive Safety Check */}
              <div className={`rounded-lg border p-4 ${fitnessConfirmed ? "border-green-300 bg-green-50/40" : "border-amber-200 bg-amber-50/40"}`}>
                <div className="flex items-start gap-3">
                  <ShieldCheck className={`w-5 h-5 mt-0.5 shrink-0 ${fitnessConfirmed ? "text-green-600" : "text-amber-600"}`} />
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="font-semibold text-sm">Pre-drive Safety Check</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Must be confirmed before the assessment can be saved.</p>
                    </div>
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <Checkbox
                        checked={fitnessConfirmed}
                        onCheckedChange={(v) => setFitnessConfirmed(!!v)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span className="text-sm leading-relaxed">
                        Student confirms they are well-rested, not stressed, and not affected by any medication, alcohol, or drugs.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Confirm button */}
              <Button
                className="w-full h-12 text-base"
                onClick={handleSetupConfirm}
                disabled={setupErrors.length > 0}
              >
                <PlayCircle className="w-5 h-5 mr-2" />
                Start Assessment
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Main page ─────────────────────────────────────────────────────────── */}
      <div className="space-y-6 max-w-4xl mx-auto pb-28">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {resumeId ? "Continue Assessment" : "New Assessment"}
            </h1>
            <p className="text-muted-foreground">
              {resumeId
                ? "Pick up where you left off — existing ratings are pre-filled."
                : "Log lesson details and maneuver proficiency."}
            </p>
          </div>
          <Link href="/instructor/assessments/guided">
            <Button variant="outline" className="h-16 text-base px-6 gap-2">
              <PlayCircle className="w-5 h-5" />
              Start Guided Lesson
            </Button>
          </Link>
        </div>

        {/* Setup summary — shown once setup is done */}
        {setupDone && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Student</p>
                    <p className="font-medium">{selectedStudent?.fullName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{duration} mins</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Program</p>
                    <p className="font-medium">{ASSESSMENT_TYPES.find(t => t.value === assessmentType)?.label ?? assessmentType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pedal Control</p>
                    <p className="font-medium">{pedalOperator ? PedalOperatorLabel[pedalOperator as PedalOperator] : "—"}</p>
                  </div>
                  {vehicleId && myVehicles.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle</p>
                      <p className="font-medium">
                        {(() => {
                          const v = myVehicles.find((v: any) => v.id === vehicleId);
                          return v ? [v.year, v.make, v.model].filter(Boolean).join(" ") : "—";
                        })()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Conditions</p>
                    <p className="font-medium">
                      {weatherCondition ? WeatherConditionLabel[weatherCondition as WeatherCondition] : "—"}
                      {lightingCondition ? ` · ${LightingConditionLabel[lightingCondition as LightingCondition]}` : ""}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setSetupOpen(true)}>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <PreviousLessonCard
          studentId={studentId ? parseInt(studentId) : null}
          onUseFocus={(focus) => {
            setFocusAreas(prev => (prev.trim().length === 0 ? focus : `${prev.trimEnd()}\n${focus}`));
            toast({ title: "Carried forward", description: "Previous focus areas copied into today's focus." });
          }}
        />

        {/* View toggle */}
        {Object.keys(groupedManeuvers).length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {Object.keys(groupedManeuvers).length} categories &bull; {Object.values(groupedManeuvers).flat().length} maneuvers
            </p>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        )}

        {viewMode === "tile" ? (
          <AssessmentTileView
            grouped={groupedWithLevels}
            getImage={(item: any) => getManeuverImage(item.name as string, item.category as string)}
            renderRating={(item: any, onRatingSelected) => {
              const m = item;
              return (
                <div className="space-y-3">
                  {/* QSAFE Compliance Criteria — visible in tile view so instructors know what they're assessing */}
                  {m.complianceCriteria && (
                    <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
                      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
                        QSAFE Compliance Criteria
                      </p>
                      <p className="text-xs text-blue-900/80 whitespace-pre-wrap leading-relaxed">
                        {m.complianceCriteria}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: ManeuverResultItemCompetencyLevel.not_attempted, label: "Not Attempted",    color: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200", active: "bg-gray-200 border-gray-400 text-gray-900 ring-2 ring-gray-400" },
                      { val: ManeuverResultItemCompetencyLevel.attempted,     label: "Developing",       color: "bg-red-50  hover:bg-red-100  text-red-700  border-red-100",   active: "bg-red-100  border-red-400  text-red-900  ring-2 ring-red-400"  },
                      { val: ManeuverResultItemCompetencyLevel.practiced,     label: "Competent",        color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-100", active: "bg-yellow-100 border-yellow-400 text-yellow-900 ring-2 ring-yellow-400" },
                      { val: ManeuverResultItemCompetencyLevel.mastered,      label: "Consistent Skills", color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-100", active: "bg-green-100 border-green-400 text-green-900 ring-2 ring-green-400" },
                    ].map(level => (
                      <button
                        key={level.val}
                        type="button"
                        onClick={() => {
                          handleLevelSelect(m.id, level.val);
                          onRatingSelected();
                        }}
                        className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all text-sm font-semibold min-w-0 ${results[m.id] === level.val ? level.active : level.color}`}
                      >
                        {results[m.id] === level.val && <Check className="w-5 h-5" />}
                        {level.label}
                      </button>
                    ))}
                  </div>
                  {results[m.id] === ManeuverResultItemCompetencyLevel.mastered && m.masteryDefinition && (
                    <div className="rounded-md bg-green-50 border border-green-100 px-3 py-2">
                      <p className="text-xs font-medium text-green-800 mb-0.5">Consistent Skills means:</p>
                      <p className="text-xs text-green-900/80 whitespace-pre-wrap italic">{m.masteryDefinition}</p>
                    </div>
                  )}
                </div>
              );
            }}
            renderNotes={(item: any, onSave, onSkip) => {
              const m = item;
              return (
                <div className="space-y-3 pt-1">
                  <QuickNoteChips
                    value={maneuverNotes[m.id] || ""}
                    onChange={(next) => handleManeuverNoteChange(m.id, next)}
                    chips={getManeuverChips(m.name, m.category)}
                  />
                  <Textarea
                    placeholder="Add instructor notes for this maneuver…"
                    value={maneuverNotes[m.id] || ""}
                    onChange={e => handleManeuverNoteChange(m.id, e.target.value)}
                    rows={4}
                    className="text-base"
                    autoFocus
                  />
                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" onClick={onSkip} className="flex-1 h-12 text-base">
                      Skip
                    </Button>
                    <Button onClick={onSave} className="flex-1 h-12 text-base">
                      Done
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        ) : (
          Object.entries(groupedManeuvers).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="bg-gray-50 border-b pb-4 p-6">
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(m => (
                    <div key={m.id} className="p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-3">
                        {(() => {
                          const img = getManeuverImage(m.name, m.category);
                          return img ? (
                            <img
                              src={img}
                              alt={m.name}
                              className="w-[100px] h-[100px] shrink-0 rounded-xl object-cover border border-border"
                            />
                          ) : null;
                        })()}
                        <p className="font-medium text-base flex-1">{m.name}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => toggleExpanded(m.id)}
                          aria-label={expandedManeuver === m.id ? "Collapse guidance and notes" : "Expand guidance and notes"}
                        >
                          {expandedManeuver === m.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { val: ManeuverResultItemCompetencyLevel.not_attempted, label: "Not Attempted",    color: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200", active: "bg-gray-200 border-gray-400 text-gray-900 ring-2 ring-gray-400" },
                          { val: ManeuverResultItemCompetencyLevel.attempted,     label: "Developing",        color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-100", active: "bg-red-100 border-red-400 text-red-900 ring-2 ring-red-400" },
                          { val: ManeuverResultItemCompetencyLevel.practiced,     label: "Competent",         color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-100", active: "bg-yellow-100 border-yellow-400 text-yellow-900 ring-2 ring-yellow-400" },
                          { val: ManeuverResultItemCompetencyLevel.mastered,      label: "Consistent Skills", color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-100", active: "bg-green-100 border-green-400 text-green-900 ring-2 ring-green-400" },
                        ].map(level => (
                          <button
                            key={level.val}
                            type="button"
                            onClick={() => handleLevelSelect(m.id, level.val)}
                            className={`
                              h-16 rounded-md border flex flex-col items-center justify-center transition-all text-sm font-medium min-w-0
                              ${results[m.id] === level.val ? level.active : level.color}
                            `}
                          >
                            {results[m.id] === level.val && <Check className="w-4 h-4 mb-0.5" />}
                            {level.label}
                          </button>
                        ))}
                      </div>
                      {/* QSAFE Compliance Criteria — always visible so instructors know what to assess against */}
                      {m.complianceCriteria && (
                        <div className="mt-3 rounded-md bg-blue-50 border border-blue-100 p-3">
                          <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1.5">
                            QSAFE Compliance Criteria
                          </p>
                          <p className="text-sm text-blue-900/80 whitespace-pre-wrap leading-relaxed">
                            {m.complianceCriteria}
                          </p>
                        </div>
                      )}
                      {/* Mastered hint — shown when instructor selects Consistent Skills */}
                      {results[m.id] === ManeuverResultItemCompetencyLevel.mastered && m.masteryDefinition && (
                        <div className="mt-3 rounded-md bg-green-50 border border-green-100 px-3 py-2">
                          <p className="text-xs font-medium text-green-800 mb-0.5">Consistent Skills means:</p>
                          <p className="text-xs text-green-900/80 whitespace-pre-wrap italic">{m.masteryDefinition}</p>
                        </div>
                      )}
                      {/* Expand section — competency definition + notes */}
                      {expandedManeuver === m.id && (
                        <div className="mt-4 space-y-4">
                          {/* Competency definition (full) */}
                          {m.masteryDefinition && (
                            <div className="rounded-md bg-purple-50 border border-purple-100 p-3">
                              <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1.5">
                                Competency Definition
                              </p>
                              <p className="text-sm text-purple-900/80 whitespace-pre-wrap leading-relaxed">
                                {m.masteryDefinition}
                              </p>
                            </div>
                          )}
                          {/* Maneuver notes */}
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Notes for {m.name}</Label>
                            <QuickNoteChips
                              value={maneuverNotes[m.id] || ""}
                              onChange={(next) => handleManeuverNoteChange(m.id, next)}
                              chips={getManeuverChips(m.name, m.category)}
                            />
                            <Textarea
                              placeholder="Add notes for this maneuver..."
                              value={maneuverNotes[m.id] || ""}
                              onChange={e => handleManeuverNoteChange(m.id, e.target.value)}
                              rows={2}
                              className="text-base"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <Card>
          <CardHeader className="p-6">
            <CardTitle>Lesson Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6 pt-0">
            <div className="space-y-2">
              <Label className="text-base">Overall Confidence & Notes</Label>
              <Textarea
                placeholder="How did the student perform overall?"
                value={confidenceNote}
                onChange={e => setConfidenceNote(e.target.value)}
                rows={3}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Focus Areas for Next Lesson</Label>
              <Textarea
                placeholder="What should be the priority next time?"
                value={focusAreas}
                onChange={e => setFocusAreas(e.target.value)}
                rows={2}
                className="text-base"
              />
            </div>
          </CardContent>
        </Card>

        {maneuvers && Object.keys(results).length > 0 && (
          <CategorySummary
            maneuvers={maneuvers}
            results={results}
            notes={maneuverNotes}
            title="Pre-save Summary"
            onlyAssessed
          />
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border shadow-lg md:left-64 flex justify-end gap-4 z-10">
          <Button
            variant="outline"
            onClick={() => setCancelConfirmOpen(true)}
            className="h-16 text-base px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !setupDone}
            className="h-16 text-base px-6"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            {resumeId ? "Save & Return" : "Save Assessment"}
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
