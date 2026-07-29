import { useListManeuvers, useCreateAssessment, useSaveManeuverResults, useListStudents, useSubmitAssessment } from "@workspace/api-client-react";
import { StudentAvatar } from "@/components/StudentAvatar";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Save, ArrowRight, ArrowLeft, CheckCircle2, MapPin, Car, Bike, Truck, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { getManeuverImage } from "@/lib/maneuver-images";
import { getManeuverChips } from "@/lib/maneuver-chips";
import { Badge } from "@/components/ui/badge";
import { useLocation, useSearch } from "wouter";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ManeuverResultItemCompetencyLevel, PedalOperator } from "@/lib/enums";
import { PedalControlSelector } from "@/components/PedalControlSelector";
import { useToast } from "@/hooks/use-toast";
import { PreviousLessonCard } from "@/components/PreviousLessonCard";
import { QuickNoteChips } from "@/components/QuickNoteChips";
import { CategorySummary } from "@/components/CategorySummary";
import AssessmentRouteMap from "@/components/AssessmentRouteMap";
import { useLessonDraft } from "@/hooks/useLessonDraft";
import { ViewToggle, useViewMode } from "@/components/assessment/ViewToggle";
import { AssessmentTileView } from "@/components/assessment/AssessmentTileView";
import type { LessonDraftState } from "@/hooks/useLessonDraft";

type AssessmentType = "qsafe" | "qride" | "heavy_vehicle";
type GuidedStep = "type" | "setup" | "select" | "assess" | "summary";

const ASSESSMENT_TYPES: { value: AssessmentType; label: string; subtitle: string; reg: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "qsafe",
    label: "QSAFE",
    subtitle: "Light Vehicle (Car, SUV, Van)",
    reg: "Driver Licensing Reg 2021, Ch. 3",
    description: "Standard Queensland learner driver assessment for class C licences.",
    icon: <Car className="w-7 h-7" />,
  },
  {
    value: "qride",
    label: "Q-Ride",
    subtitle: "Motorcycle / E-Bike",
    reg: "Accreditation Reg 2015, s. 33–41",
    description: "Competency-based motorcycle training and assessment for class RE/R licences.",
    icon: <Bike className="w-7 h-7" />,
  },
  {
    value: "heavy_vehicle",
    label: "Heavy Vehicle",
    subtitle: "MR / HR / HC / MC",
    reg: "Driver Licensing Reg 2021, s. 57–60",
    description: "Assessment for medium and heavy vehicle licence classes.",
    icon: <Truck className="w-7 h-7" />,
  },
];

export default function GuidedAssessment() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const { data: maneuvers, isLoading: isManeuversLoading } = useListManeuvers();
  const createAssessment = useCreateAssessment();
  const saveResults = useSaveManeuverResults();
  const submitForApproval = useSubmitAssessment();

  // Pre-populate from URL params (e.g. from student profile or booking)
  const urlParams = new URLSearchParams(search);
  const urlStudentId = urlParams.get("studentId") ?? "";
  const urlDuration = urlParams.get("durationMinutes") ?? "60";

  // Assessment type — must be selected first
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("qsafe");

  // Setup state
  const [studentId, setStudentId] = useState<string>(urlStudentId);
  const [duration, setDuration] = useState(urlDuration);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Pedal control — required before saving
  const [pedalOperator, setPedalOperator] = useState<PedalOperator | "">("");

  // Pre-drive fitness confirmation — must be acknowledged before assessment can proceed
  const [fitnessConfirmed, setFitnessConfirmed] = useState(false);

  // Flow state — starts at "type" selection
  const [step, setStep] = useState<GuidedStep>("type");
  const [selectedManeuverIds, setSelectedManeuverIds] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, ManeuverResultItemCompetencyLevel>>({});
  const [maneuverNotes, setManeuverNotes] = useState<Record<number, string>>({});
  const [confidenceNote, setConfidenceNote] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useViewMode();

  // Guidance panel — expanded per-maneuver in the assess step
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  useEffect(() => { setGuidanceOpen(false); }, [currentIndex]);

  // Geolocation tracking
  const currentPositionRef = useRef<GeolocationCoordinates | null>(null);
  const routePointsRef = useRef<Array<{ lat: number; lng: number; ts: number }>>([]);
  const watchIdRef = useRef<number | null>(null);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [maneuverLocations, setManeuverLocations] = useState<Record<number, { lat: number; lng: number }>>({});

  // Proactively request geolocation permission on page load so the OS dialog
  // appears before the lesson starts, not mid-lesson when tracking begins.
  // The one-shot position reading is discarded — this is purely a permission warm-up.
  // Web browsers only track location while the tab is active (no background access).
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { currentPositionRef.current = pos.coords; },
      () => { /* permission denied or unavailable — tracking will be skipped */ },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Draft persistence (Fix #1: lesson data survives network drops) ──────────
  const { saveDraft, loadDraft, clearDraft } = useLessonDraft();
  const [hasDraft, setHasDraft] = useState(false);
  const [draftAge, setDraftAge] = useState("");

  // Always-current state snapshot used by the GPS interval to avoid stale closures.
  const currentStateRef = useRef<Omit<LessonDraftState, "routePoints" | "savedAt">>({
    studentId: "", duration: "60", date: new Date().toISOString().split("T")[0],
    pedalOperator: "",
    results: {},
    maneuverNotes: {},
    maneuverLocations: {},
    selectedManeuverIds: [],
    confidenceNote: "",
    focusAreas: "",
  });

  useEffect(() => {
    currentStateRef.current = {
      studentId, duration, date, pedalOperator,
      results, maneuverNotes, maneuverLocations,
      selectedManeuverIds: [...selectedManeuverIds],
      confidenceNote, focusAreas,
    };
  }, [studentId, duration, date, pedalOperator, results, maneuverNotes, maneuverLocations, selectedManeuverIds, confidenceNote, focusAreas]);

  // Check for a recoverable draft when the component first mounts.
  useEffect(() => {
    loadDraft().then((draft) => {
      if (!draft) return;
      const ageMs = Date.now() - draft.savedAt;
      if (ageMs > 24 * 60 * 60 * 1000) return; // discard drafts older than 24 h
      const ageMins = Math.round(ageMs / 60_000);
      setDraftAge(ageMins < 1 ? "just now" : `${ageMins} min${ageMins !== 1 ? "s" : ""} ago`);
      setHasDraft(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreDraft = async () => {
    const draft = await loadDraft();
    if (!draft) return;
    setStudentId(draft.studentId);
    setDuration(draft.duration);
    setDate(draft.date);
    if (draft.pedalOperator) setPedalOperator(draft.pedalOperator as PedalOperator);
    setResults(draft.results as Record<number, ManeuverResultItemCompetencyLevel>);
    setManeuverNotes(draft.maneuverNotes);
    setManeuverLocations(draft.maneuverLocations);
    setSelectedManeuverIds(new Set(draft.selectedManeuverIds));
    setConfidenceNote(draft.confidenceNote);
    setFocusAreas(draft.focusAreas);
    routePointsRef.current = draft.routePoints;
    setHasDraft(false);
    toast({ title: "Lesson restored", description: "Your previous lesson has been recovered." });
  };
  // ────────────────────────────────────────────────────────────────────────────

  const groupedManeuvers = useMemo(() => {
    if (!maneuvers) return {};
    return maneuvers.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, typeof maneuvers>);
  }, [maneuvers]);

  const selectedManeuvers = useMemo(() => {
    if (!maneuvers) return [];
    return maneuvers.filter(m => selectedManeuverIds.has(m.id));
  }, [maneuvers, selectedManeuverIds]);

  const currentManeuver = selectedManeuvers[currentIndex];

  const toggleManeuver = (id: number) => {
    setSelectedManeuverIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (ids: number[]) => {
    setSelectedManeuverIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleLevelSelect = (level: ManeuverResultItemCompetencyLevel) => {
    if (!currentManeuver) return;
    setResults(prev => ({ ...prev, [currentManeuver.id]: level }));
    const pos = currentPositionRef.current;
    if (pos) {
      setManeuverLocations(prev => ({
        ...prev,
        [currentManeuver.id]: { lat: pos.latitude, lng: pos.longitude },
      }));
    }
  };

  // Start GPS tracking when assess step begins, stop when leaving
  useEffect(() => {
    if (step !== "assess") return;
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { currentPositionRef.current = pos.coords; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    trackingIntervalRef.current = setInterval(() => {
      const pos = currentPositionRef.current;
      if (pos) {
        routePointsRef.current.push({ lat: pos.latitude, lng: pos.longitude, ts: Date.now() });
      }
      // Persist draft every 5 s — reads currentStateRef to avoid stale closures.
      saveDraft({
        ...currentStateRef.current,
        routePoints: routePointsRef.current,
        savedAt: Date.now(),
      });
    }, 5000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (trackingIntervalRef.current !== null) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [step]);

  const handleNext = () => {
    if (currentIndex < selectedManeuvers.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setStep("summary");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Swipe & keyboard navigation — active only during the assess step
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    // Only trigger on primarily horizontal swipes (more horizontal than vertical)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) handleNext();   // swipe left → next
    else handlePrev();           // swipe right → previous
  }, [currentIndex, selectedManeuvers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== "assess") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); handleNext(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, currentIndex, selectedManeuvers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!studentId) {
      toast({ title: "Error", description: "Please select a student", variant: "destructive" });
      return;
    }
    if (!pedalOperator) {
      toast({ title: "Pedal control required", description: "Please go back to setup and select pedal control.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const assessment = await createAssessment.mutateAsync({
        data: {
          studentId: parseInt(studentId),
          lessonDate: new Date(date).toISOString(),
          durationMinutes: parseInt(duration),
          assessmentType,
          pedalOperator,
          confidenceNote,
          focusAreasNext: focusAreas,
          routePath: routePointsRef.current.length > 0 ? routePointsRef.current : undefined,
          acknowledgeFitness: fitnessConfirmed ? true : undefined,
        } as any
      });

      const maneuverResultsArray = Object.entries(results).map(([id, level]) => ({
        maneuverId: parseInt(id),
        competencyLevel: level,
        notes: maneuverNotes[parseInt(id)] || undefined,
        lat: maneuverLocations[parseInt(id)]?.lat,
        lng: maneuverLocations[parseInt(id)]?.lng,
      }));

      if (maneuverResultsArray.length > 0) {
        await saveResults.mutateAsync({
          id: assessment.id,
          data: { results: maneuverResultsArray }
        });
      }

      // Auto-submit for approval — moves to pending_approval state
      await submitForApproval.mutateAsync({ id: assessment.id });

      toast({ title: "Lesson saved", description: "Assessment is ready for your review and approval." });
      clearDraft();
      setLocation(`/instructor/assessments/${assessment.id}`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save assessment.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isStudentsLoading || isManeuversLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  // Step 0: Assessment Type selection
  if (step === "type") {
    return (
      <SidebarLayout>
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Guided Lesson</h1>
            <p className="text-muted-foreground text-lg mt-1">Step 1 of 4 — Select the assessment program.</p>
          </div>

          <Card>
            <CardHeader className="p-6 pb-4">
              <CardTitle>Assessment Program</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Select the program that governs this lesson. Each type is regulated under separate Queensland transport legislation.</p>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-3">
              {ASSESSMENT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAssessmentType(type.value)}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-start gap-4 ${
                    assessmentType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${assessmentType === type.value ? "text-primary" : "text-muted-foreground"}`}>
                    {type.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{type.label}</p>
                      <span className="text-sm text-muted-foreground">— {type.subtitle}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{type.description}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 italic">{type.reg}</p>
                  </div>
                  {assessmentType === type.value && (
                    <Check className="w-5 h-5 text-primary shrink-0 mt-1" />
                  )}
                </button>
              ))}
              {assessmentType !== "qsafe" && (
                <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{assessmentType === "qride" ? "Q-Ride" : "Heavy Vehicle"} checklist coming soon.</span>{" "}
                    This assessment will use the QSAFE maneuver checklist as a placeholder until the dedicated checklist is available.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep("setup")} className="gap-2">
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Step 2: Setup (student, date, duration)
  if (step === "setup") {
    return (
      <SidebarLayout>
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Guided Lesson</h1>
            <p className="text-muted-foreground text-lg mt-1">Step 2 of 4 — Enter lesson details.</p>
          </div>

          {hasDraft && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-amber-900">Unsaved lesson found</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A lesson was saved {draftAge}. Would you like to restore it?
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => { setHasDraft(false); clearDraft(); }}>
                  Dismiss
                </Button>
                <Button size="sm" onClick={restoreDraft}>
                  Restore
                </Button>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="p-6">
              <CardTitle>Lesson Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-0">
              <div className="space-y-2">
                <Label className="text-base">Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="h-16 text-base">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()} className="text-base py-3">{s.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {studentId && (() => {
                  const s = students?.find(x => x.id.toString() === studentId);
                  return s ? (
                    <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <StudentAvatar fullName={s.fullName} headshotPath={s.headshotPath} className="w-12 h-12" textClassName="text-base" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{s.fullName}</p>
                        {s.totalHours != null && <p className="text-sm text-muted-foreground">{s.totalHours}h logged</p>}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base">Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-16 text-base" />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Duration (mins)</Label>
                  <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="h-16 text-base" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-6 pb-4">
              <CardTitle>Pedal Control</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <PedalControlSelector value={pedalOperator} onChange={setPedalOperator} />
            </CardContent>
          </Card>

          {/* Pre-drive fitness & sobriety check — must be acknowledged before maneuver selection */}
          <Card className={fitnessConfirmed ? "border-green-300 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <ShieldCheck className={`w-6 h-6 mt-0.5 shrink-0 ${fitnessConfirmed ? "text-green-600" : "text-amber-600"}`} />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold text-base">Pre-drive Safety Check</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Must be confirmed before the assessment can begin.</p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <Checkbox
                      checked={fitnessConfirmed}
                      onCheckedChange={(v) => setFitnessConfirmed(!!v)}
                      className="mt-0.5 h-5 w-5"
                    />
                    <span className="text-sm leading-relaxed group-hover:text-foreground transition-colors">
                      Student confirms they are well-rested, not stressed, and not affected by any medication, alcohol, or drugs.
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <PreviousLessonCard
            studentId={studentId ? parseInt(studentId) : null}
            onUseFocus={(focus) => {
              setFocusAreas(prev => (prev.trim().length === 0 ? focus : `${prev.trimEnd()}\n${focus}`));
              toast({ title: "Carried forward", description: "Previous focus areas copied into today's focus." });
            }}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep("type")}
              className="h-16 text-base px-6"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </Button>
            <Button
              className="flex-1 h-16 text-lg"
              onClick={() => setStep("select")}
              disabled={!studentId || !pedalOperator || !fitnessConfirmed}
            >
              Choose Maneuvers <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Step 2: Select maneuvers
  if (step === "select") {
    return (
      <SidebarLayout>
        <div className="space-y-6 max-w-2xl mx-auto pb-28">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Select Maneuvers</h1>
            <p className="text-muted-foreground text-lg mt-1">
              Choose which maneuvers to work on this lesson.
              <span className="font-semibold text-foreground ml-2">{selectedManeuverIds.size} selected</span>
            </p>
          </div>

          {assessmentType !== "qsafe" && (
            <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{assessmentType === "qride" ? "Q-Ride" : "Heavy Vehicle"} checklist coming soon.</span>{" "}
                Using the QSAFE maneuver list as a placeholder until the dedicated checklist is available.
              </p>
            </div>
          )}

          {Object.entries(groupedManeuvers).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="bg-gray-50 border-b p-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{category}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm h-10"
                  onClick={() => selectAll(items.map(m => m.id))}
                >
                  {items.every(m => selectedManeuverIds.has(m.id)) ? "Deselect All" : "Select All"}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map(m => (
                    <label
                      key={m.id}
                      className="flex items-center gap-4 p-4 sm:p-5 cursor-pointer hover:bg-gray-50 transition-colors min-h-[64px]"
                    >
                      <Checkbox
                        checked={selectedManeuverIds.has(m.id)}
                        onCheckedChange={() => toggleManeuver(m.id)}
                        className="h-6 w-6"
                      />
                      <span className="text-base font-medium flex-1">{m.name}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border shadow-lg md:left-64 flex justify-between gap-4 z-10">
            <Button variant="outline" onClick={() => setStep("setup")} className="h-16 text-base px-6">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </Button>
            <Button
              onClick={() => { setCurrentIndex(0); setStep("assess"); }}
              disabled={selectedManeuverIds.size === 0}
              className="h-16 text-base px-6"
            >
              Start Assessment ({selectedManeuverIds.size}) <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Step 3: Assess one maneuver at a time
  if (step === "assess" && currentManeuver) {
    const levels = [
      { val: ManeuverResultItemCompetencyLevel.not_attempted, label: "Not Attempted", color: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300", active: "bg-gray-300 border-gray-500 text-gray-900 ring-2 ring-gray-500" },
      { val: ManeuverResultItemCompetencyLevel.attempted, label: "Developing",        color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-200", active: "bg-red-200 border-red-500 text-red-900 ring-2 ring-red-500" },
      { val: ManeuverResultItemCompetencyLevel.practiced, label: "Competent",         color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200", active: "bg-yellow-200 border-yellow-500 text-yellow-900 ring-2 ring-yellow-500" },
      { val: ManeuverResultItemCompetencyLevel.mastered,  label: "Consistent Skills", color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200", active: "bg-green-200 border-green-500 text-green-900 ring-2 ring-green-500" },
    ];

    const isFirst = currentIndex === 0;
    const isLast  = currentIndex === selectedManeuvers.length - 1;

    return (
      <SidebarLayout>
        <div
          className="flex flex-col min-h-[calc(100dvh-4rem)] max-w-2xl mx-auto"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <span className="text-sm text-muted-foreground font-medium">
              {currentIndex + 1} of {selectedManeuvers.length}
            </span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / selectedManeuvers.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">← → to navigate</span>
          </div>

          {/* Maneuver card */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="p-4 sm:p-6 border-b">
              <div className="flex items-start gap-2">
                {(() => {
                  const img = getManeuverImage(currentManeuver.name, currentManeuver.category);
                  return img ? (
                    <img
                      src={img}
                      alt={currentManeuver.name}
                      className="w-[100px] h-[100px] shrink-0 rounded-xl object-cover border border-border mt-0.5"
                    />
                  ) : null;
                })()}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl">{currentManeuver.name}</CardTitle>
                  <p className="text-muted-foreground text-sm sm:text-base mt-0.5">{currentManeuver.category}</p>
                </div>
                {(getManeuverImage(currentManeuver.name, currentManeuver.category) || currentManeuver.complianceCriteria || currentManeuver.masteryDefinition) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-sm text-primary h-9 mt-0.5"
                    onClick={() => setGuidanceOpen(prev => !prev)}
                  >
                    {guidanceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {guidanceOpen ? "Hide" : "Guidance"}
                  </Button>
                )}
              </div>

              {guidanceOpen && (
                <div className="mt-4 space-y-4 border-t pt-4">

                  {currentManeuver.complianceCriteria && (
                    <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
                      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1.5">QSAFE Compliance Criteria</p>
                      <p className="text-sm text-blue-900/80 whitespace-pre-wrap leading-relaxed">{currentManeuver.complianceCriteria}</p>
                    </div>
                  )}
                  {currentManeuver.masteryDefinition && (
                    <div className="rounded-md bg-purple-50 border border-purple-100 p-3">
                      <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1.5">Competency Definition</p>
                      <p className="text-sm text-purple-900/80 whitespace-pre-wrap leading-relaxed">{currentManeuver.masteryDefinition}</p>
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Score buttons */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {levels.map(level => (
                  <button
                    key={level.val}
                    type="button"
                    onClick={() => handleLevelSelect(level.val)}
                    className={`
                      min-h-[4.5rem] sm:min-h-[5rem] rounded-xl border-2 flex flex-col items-center justify-center transition-all text-base sm:text-lg font-semibold px-2
                      ${results[currentManeuver.id] === level.val ? level.active : level.color}
                    `}
                  >
                    {results[currentManeuver.id] === level.val && <Check className="w-4 h-4 sm:w-5 sm:h-5 mb-1" />}
                    {level.label}
                  </button>
                ))}
              </div>

              {results[currentManeuver.id] === ManeuverResultItemCompetencyLevel.mastered && currentManeuver.masteryDefinition && (
                <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
                  <p className="text-sm font-semibold text-green-900 mb-1">Consistent Skills means:</p>
                  <p className="text-sm text-green-900/80 whitespace-pre-wrap italic">{currentManeuver.masteryDefinition}</p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-base">Notes</Label>
                <QuickNoteChips
                  value={maneuverNotes[currentManeuver.id] || ""}
                  onChange={(next) => setManeuverNotes(prev => ({ ...prev, [currentManeuver.id]: next }))}
                  chips={getManeuverChips(currentManeuver.name, currentManeuver.category)}
                />
                <Textarea
                  placeholder="Quick notes for this maneuver..."
                  value={maneuverNotes[currentManeuver.id] || ""}
                  onChange={e => setManeuverNotes(prev => ({ ...prev, [currentManeuver.id]: e.target.value }))}
                  rows={3}
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between gap-3 sm:gap-4 mt-4 sm:mt-6 pb-6">
            {isFirst ? (
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                className="h-14 sm:h-16 text-sm sm:text-base px-4 sm:px-6 flex-1"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Back to Selection
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="h-14 sm:h-16 text-sm sm:text-base px-4 sm:px-6 flex-1"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Previous
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="h-14 sm:h-16 text-sm sm:text-base px-4 sm:px-6 flex-1"
            >
              {isLast ? (
                <>Review Summary <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 ml-2" /></>
              ) : (
                <>Next <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Step 4: Summary
  if (step === "summary") {
    const levelLabel: Record<string, string> = {
      not_attempted: "Not Attempted",
      attempted: "Developing",
      practiced: "Competent",
      mastered: "Consistent Skills",
    };
    const levelColor: Record<string, string> = {
      not_attempted: "bg-gray-100 text-gray-800 border-gray-200",
      attempted: "bg-red-100 text-red-800 border-red-200",
      practiced: "bg-yellow-100 text-yellow-800 border-yellow-200",
      mastered: "bg-green-100 text-green-800 border-green-200",
    };

    return (
      <SidebarLayout>
        <div className="space-y-6 max-w-2xl mx-auto pb-28">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lesson Summary</h1>
            <p className="text-muted-foreground text-lg mt-1">Review and save your assessment.</p>
          </div>

          <CategorySummary
            maneuvers={selectedManeuvers}
            results={results}
            notes={maneuverNotes}
            title="Lesson Breakdown"
          />

          {(routePointsRef.current.length > 0 || Object.keys(maneuverLocations).length > 0) && (
            <Card>
              <CardHeader className="bg-gray-50 border-b p-6">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Lesson Route
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <AssessmentRouteMap
                  routePath={routePointsRef.current}
                  maneuverPoints={Object.entries(maneuverLocations).map(([id, loc]) => ({
                    ...loc,
                    maneuverId: parseInt(id),
                    name: selectedManeuvers.find(m => m.id === parseInt(id))?.name ?? "Unknown",
                    level: results[parseInt(id)] ?? "not_attempted",
                  }))}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="bg-gray-50 border-b p-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Maneuver Results</CardTitle>
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-2">
              {(() => {
                // Build grouped + level data for tile view
                const groupedSummary = selectedManeuvers.reduce<Record<string, any[]>>((acc, m) => {
                  const cat = m.category ?? "General";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push({ ...m, competencyLevel: results[m.id] ?? "not_attempted" });
                  return acc;
                }, {});

                const renderSummaryRow = (item: any) => (
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base truncate">{item.name}</p>
                      {maneuverNotes[item.id] && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{maneuverNotes[item.id]}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-sm px-3 py-1 ${levelColor[results[item.id] || "not_attempted"]}`}
                    >
                      {levelLabel[results[item.id] || "not_attempted"]}
                    </Badge>
                  </div>
                );

                if (viewMode === "tile") {
                  return (
                    <AssessmentTileView
                      grouped={groupedSummary}
                      getImage={(item: any) => getManeuverImage(item.name as string, item.category as string)}
                      renderItem={(item: any) => (
                        <div className="p-4 sm:p-5 space-y-2">
                          <Badge
                            variant="outline"
                            className={`text-sm px-3 py-1 ${levelColor[results[item.id] || "not_attempted"]}`}
                          >
                            {levelLabel[results[item.id] || "not_attempted"]}
                          </Badge>
                          {maneuverNotes[item.id] && (
                            <p className="text-sm text-muted-foreground">{maneuverNotes[item.id]}</p>
                          )}
                        </div>
                      )}
                    />
                  );
                }

                return (
                  <div className="divide-y -mx-4 -mb-2 border rounded-lg overflow-hidden">
                    {selectedManeuvers.map(m => (
                      <div key={m.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-base truncate">{m.name}</p>
                          {maneuverNotes[m.id] && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">{maneuverNotes[m.id]}</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-sm px-3 py-1 ${levelColor[results[m.id] || "not_attempted"]}`}
                        >
                          {levelLabel[results[m.id] || "not_attempted"]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

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

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border shadow-lg md:left-64 flex justify-between gap-4 z-10">
            <Button
              variant="outline"
              onClick={() => { setCurrentIndex(selectedManeuvers.length - 1); setStep("assess"); }}
              className="h-16 text-base px-6"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting} className="h-16 text-base px-6">
              {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Save Assessment
            </Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Fallback
  return null;
}
