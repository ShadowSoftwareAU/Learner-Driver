import { useListManeuvers, useCreateAssessment, useSaveManeuverResults, useListStudents } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Save, Info, ChevronDown, ChevronUp, PlayCircle, Car, Bike, Truck, AlertTriangle, ShieldCheck } from "lucide-react";
import { StudentAvatar } from "@/components/StudentAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLocation, useSearch, Link } from "wouter";
import { useState, useMemo } from "react";
import { ManeuverResultItemCompetencyLevel, PedalOperator } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";
import { PreviousLessonCard } from "@/components/PreviousLessonCard";
import { QuickNoteChips } from "@/components/QuickNoteChips";
import { CategorySummary } from "@/components/CategorySummary";
import { PedalControlSelector } from "@/components/PedalControlSelector";

type AssessmentType = "qsafe" | "qride" | "heavy_vehicle";

const ASSESSMENT_TYPES: { value: AssessmentType; label: string; subtitle: string; reg: string; icon: React.ReactNode }[] = [
  {
    value: "qsafe",
    label: "QSAFE",
    subtitle: "Light Vehicle (Car, SUV, Van)",
    reg: "Driver Licensing Reg 2021, Ch. 3",
    icon: <Car className="w-6 h-6" />,
  },
  {
    value: "qride",
    label: "Q-Ride",
    subtitle: "Motorcycle / E-Bike",
    reg: "Accreditation Reg 2015, s. 33–41",
    icon: <Bike className="w-6 h-6" />,
  },
  {
    value: "heavy_vehicle",
    label: "Heavy Vehicle",
    subtitle: "MR / HR / HC / MC",
    reg: "Driver Licensing Reg 2021, s. 57–60",
    icon: <Truck className="w-6 h-6" />,
  },
];

export default function NewAssessment() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const { data: maneuvers, isLoading: isManeuversLoading } = useListManeuvers();
  const createAssessment = useCreateAssessment();
  const saveResults = useSaveManeuverResults();

  // Pre-populate from URL params (e.g. from student profile or booking)
  const urlParams = new URLSearchParams(search);
  const urlStudentId = urlParams.get("studentId") ?? "";
  const urlDuration = urlParams.get("durationMinutes") ?? "60";

  const [assessmentType, setAssessmentType] = useState<AssessmentType>("qsafe");
  const [studentId, setStudentId] = useState<string>(urlStudentId);
  const [duration, setDuration] = useState(urlDuration);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [pedalOperator, setPedalOperator] = useState<PedalOperator | "">("");
  const [fitnessConfirmed, setFitnessConfirmed] = useState(false);
  const [results, setResults] = useState<Record<number, ManeuverResultItemCompetencyLevel>>({});
  const [maneuverNotes, setManeuverNotes] = useState<Record<number, string>>({});
  const [expandedManeuver, setExpandedManeuver] = useState<number | null>(null);
  const [confidenceNote, setConfidenceNote] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groupedManeuvers = useMemo(() => {
    if (!maneuvers) return {};
    return maneuvers.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, typeof maneuvers>);
  }, [maneuvers]);

  const handleLevelSelect = (maneuverId: number, level: ManeuverResultItemCompetencyLevel) => {
    setResults(prev => ({ ...prev, [maneuverId]: level }));
  };

  const handleManeuverNoteChange = (maneuverId: number, note: string) => {
    setManeuverNotes(prev => ({ ...prev, [maneuverId]: note }));
  };

  const toggleExpanded = (maneuverId: number) => {
    setExpandedManeuver(prev => prev === maneuverId ? null : maneuverId);
  };

  const handleSave = async () => {
    if (!studentId) {
      toast({ title: "Error", description: "Please select a student", variant: "destructive" });
      return;
    }
    if (!pedalOperator) {
      toast({ title: "Pedal control required", description: "Please select who controls the pedals for this lesson.", variant: "destructive" });
      return;
    }
    if (!fitnessConfirmed) {
      toast({ title: "Fitness check required", description: "Please confirm the pre-drive fitness check before saving.", variant: "destructive" });
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
          pedalOperator: pedalOperator || undefined,
          confidenceNote,
          focusAreasNext: focusAreas,
          acknowledgeFitness: true,
        } as any
      });

      const maneuverResultsArray = Object.entries(results).map(([id, level]) => ({
        maneuverId: parseInt(id),
        competencyLevel: level,
        notes: maneuverNotes[parseInt(id)] || undefined,
      }));

      if (maneuverResultsArray.length > 0) {
        await saveResults.mutateAsync({
          id: assessment.id,
          data: { results: maneuverResultsArray }
        });
      }

      toast({ title: "Success", description: "Assessment saved successfully." });
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

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-28">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Assessment</h1>
            <p className="text-muted-foreground">Log lesson details and maneuver proficiency.</p>
          </div>
          <Link href="/instructor/assessments/guided">
            <Button variant="outline" className="h-16 text-base px-6 gap-2">
              <PlayCircle className="w-5 h-5" />
              Start Guided Lesson
            </Button>
          </Link>
        </div>

        {/* Assessment Program Type */}
        <Card>
          <CardHeader className="p-6 pb-4">
            <CardTitle>Assessment Program</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Select the program type before logging this assessment. Each program is governed by separate Queensland transport legislation.</p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ASSESSMENT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAssessmentType(type.value)}
                  className={`rounded-lg border-2 p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    assessmentType === type.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className={`mb-2 ${assessmentType === type.value ? "text-primary" : "text-muted-foreground"}`}>
                    {type.icon}
                  </div>
                  <p className="font-semibold text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.subtitle}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 italic">{type.reg}</p>
                  {assessmentType === type.value && (
                    <Badge className="mt-2 bg-primary/10 text-primary border-primary/20 text-xs" variant="outline">Selected</Badge>
                  )}
                </button>
              ))}
            </div>
            {assessmentType !== "qsafe" && (
              <div className="mt-4 flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{assessmentType === "qride" ? "Q-Ride" : "Heavy Vehicle"} checklist coming soon.</span>{" "}
                  This assessment is using the QSAFE maneuver checklist as a placeholder until the dedicated checklist is available.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-6">
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 pt-0">
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
                    <StudentAvatar fullName={s.fullName} headshotPath={s.headshotPath} className="w-10 h-10" textClassName="text-sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{s.fullName}</p>
                      {s.totalHours != null && <p className="text-xs text-muted-foreground">{s.totalHours}h logged</p>}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="space-y-2">
              <Label className="text-base">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-16 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Duration (mins)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="h-16 text-base" />
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

        {/* Pre-drive fitness & sobriety check — must be acknowledged before assessment can be saved */}
        <Card className={fitnessConfirmed ? "border-green-300 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <ShieldCheck className={`w-6 h-6 mt-0.5 shrink-0 ${fitnessConfirmed ? "text-green-600" : "text-amber-600"}`} />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-semibold text-base">Pre-drive Safety Check</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Must be confirmed before the assessment can be saved.</p>
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

        {Object.entries(groupedManeuvers).map(([category, items]) => (
          <Card key={category}>
            <CardHeader className="bg-gray-50 border-b pb-4 p-6">
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.map(m => (
                  <div key={m.id} className="p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="font-medium text-base flex-1">{m.name}</p>
                      {(m.complianceCriteria || m.masteryDefinition) && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                              <Info className="w-5 h-5 text-blue-500" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>{m.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-2">
                              {m.complianceCriteria && (
                                <div>
                                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">QSAFE Compliance Criteria</h4>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">{m.complianceCriteria}</p>
                                </div>
                              )}
                              {m.masteryDefinition && (
                                <div>
                                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Competency Definition</h4>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">{m.masteryDefinition}</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => toggleExpanded(m.id)}
                      >
                        {expandedManeuver === m.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { val: ManeuverResultItemCompetencyLevel.not_attempted, label: "Not Attempted", color: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200", active: "bg-gray-200 border-gray-400 text-gray-900 ring-2 ring-gray-400" },
                        { val: ManeuverResultItemCompetencyLevel.attempted, label: "Attempted", color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-100", active: "bg-red-100 border-red-400 text-red-900 ring-2 ring-red-400" },
                        { val: ManeuverResultItemCompetencyLevel.practiced, label: "Not yet Competent", color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-100", active: "bg-yellow-100 border-yellow-400 text-yellow-900 ring-2 ring-yellow-400" },
                        { val: ManeuverResultItemCompetencyLevel.mastered, label: "Competent", color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-100", active: "bg-green-100 border-green-400 text-green-900 ring-2 ring-green-400" }
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
                    {results[m.id] === ManeuverResultItemCompetencyLevel.mastered && m.masteryDefinition && (
                      <div className="mt-3 rounded-md bg-green-50 border border-green-100 px-3 py-2">
                        <p className="text-xs font-medium text-green-800 mb-0.5">Competent means:</p>
                        <p className="text-xs text-green-900/80 whitespace-pre-wrap italic">{m.masteryDefinition}</p>
                      </div>
                    )}
                    {expandedManeuver === m.id && (
                      <div className="mt-4 space-y-2">
                        <Label className="text-sm text-muted-foreground">Notes for {m.name}</Label>
                        <QuickNoteChips
                          value={maneuverNotes[m.id] || ""}
                          onChange={(next) => handleManeuverNoteChange(m.id, next)}
                        />
                        <Textarea
                          placeholder="Add notes for this maneuver..."
                          value={maneuverNotes[m.id] || ""}
                          onChange={e => handleManeuverNoteChange(m.id, e.target.value)}
                          rows={2}
                          className="text-base"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

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
          <Button variant="outline" onClick={() => setLocation("/instructor/students")} className="h-16 text-base px-6">Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting || !studentId || !pedalOperator || !fitnessConfirmed} className="h-16 text-base px-6">
            {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Save Assessment
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
