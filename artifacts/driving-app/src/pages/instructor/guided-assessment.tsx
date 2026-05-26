import { useListManeuvers, useCreateAssessment, useSaveManeuverResults, useListStudents } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Save, ArrowRight, ArrowLeft, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { ManeuverResultItemCompetencyLevel } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";
import { PreviousLessonCard } from "@/components/PreviousLessonCard";
import { QuickNoteChips } from "@/components/QuickNoteChips";
import { CategorySummary } from "@/components/CategorySummary";

type GuidedStep = "setup" | "select" | "assess" | "summary";

export default function GuidedAssessment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: students, isLoading: isStudentsLoading } = useListStudents();
  const { data: maneuvers, isLoading: isManeuversLoading } = useListManeuvers();
  const createAssessment = useCreateAssessment();
  const saveResults = useSaveManeuverResults();

  // Setup state
  const [studentId, setStudentId] = useState<string>("");
  const [duration, setDuration] = useState("60");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Flow state
  const [step, setStep] = useState<GuidedStep>("setup");
  const [selectedManeuverIds, setSelectedManeuverIds] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, ManeuverResultItemCompetencyLevel>>({});
  const [maneuverNotes, setManeuverNotes] = useState<Record<number, string>>({});
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
  };

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

  const handleSave = async () => {
    if (!studentId) {
      toast({ title: "Error", description: "Please select a student", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const assessment = await createAssessment.mutateAsync({
        data: {
          studentId: parseInt(studentId),
          lessonDate: new Date(date).toISOString(),
          durationMinutes: parseInt(duration),
          confidenceNote,
          focusAreasNext: focusAreas,
        }
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

  // Step 1: Setup (student, date, duration)
  if (step === "setup") {
    return (
      <SidebarLayout>
        <div className="space-y-6 max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Guided Lesson</h1>
            <p className="text-muted-foreground text-lg mt-1">Step through maneuvers one at a time.</p>
          </div>

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

          <PreviousLessonCard
            studentId={studentId ? parseInt(studentId) : null}
            onUseFocus={(focus) => {
              setFocusAreas(prev => (prev.trim().length === 0 ? focus : `${prev.trimEnd()}\n${focus}`));
              toast({ title: "Carried forward", description: "Previous focus areas copied into today's focus." });
            }}
          />

          <Button
            className="w-full h-16 text-lg"
            onClick={() => setStep("select")}
            disabled={!studentId}
          >
            Choose Maneuvers <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
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
      { val: ManeuverResultItemCompetencyLevel.attempted, label: "Attempted", color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-200", active: "bg-red-200 border-red-500 text-red-900 ring-2 ring-red-500" },
      { val: ManeuverResultItemCompetencyLevel.practiced, label: "Practiced", color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200", active: "bg-yellow-200 border-yellow-500 text-yellow-900 ring-2 ring-yellow-500" },
      { val: ManeuverResultItemCompetencyLevel.mastered, label: "Mastered", color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200", active: "bg-green-200 border-green-500 text-green-900 ring-2 ring-green-500" },
    ];

    return (
      <SidebarLayout>
        <div className="flex flex-col min-h-[calc(100dvh-4rem)] max-w-2xl mx-auto">
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-muted-foreground font-medium">
              {currentIndex + 1} of {selectedManeuvers.length}
            </span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / selectedManeuvers.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Maneuver card */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="p-6 border-b">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl flex-1">{currentManeuver.name}</CardTitle>
                {(currentManeuver.complianceCriteria || currentManeuver.masteryDefinition) && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0">
                        <Info className="w-6 h-6 text-blue-500" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{currentManeuver.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        {currentManeuver.complianceCriteria && (
                          <div>
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">QSAFE Compliance Criteria</h4>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{currentManeuver.complianceCriteria}</p>
                          </div>
                        )}
                        {currentManeuver.masteryDefinition && (
                          <div>
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mastery Definition</h4>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{currentManeuver.masteryDefinition}</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <p className="text-muted-foreground">{currentManeuver.category}</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center p-6 space-y-6">
              {/* Score buttons */}
              <div className="grid grid-cols-2 gap-4">
                {levels.map(level => (
                  <button
                    key={level.val}
                    type="button"
                    onClick={() => handleLevelSelect(level.val)}
                    className={`
                      h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all text-lg font-semibold
                      ${results[currentManeuver.id] === level.val ? level.active : level.color}
                    `}
                  >
                    {results[currentManeuver.id] === level.val && <Check className="w-5 h-5 mb-1" />}
                    {level.label}
                  </button>
                ))}
              </div>

              {results[currentManeuver.id] === ManeuverResultItemCompetencyLevel.mastered && currentManeuver.masteryDefinition && (
                <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
                  <p className="text-sm font-semibold text-green-900 mb-1">Mastered means:</p>
                  <p className="text-sm text-green-900/80 whitespace-pre-wrap italic">{currentManeuver.masteryDefinition}</p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-base">Notes</Label>
                <QuickNoteChips
                  value={maneuverNotes[currentManeuver.id] || ""}
                  onChange={(next) => setManeuverNotes(prev => ({ ...prev, [currentManeuver.id]: next }))}
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
          <div className="flex justify-between gap-4 mt-6 pb-6">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="h-16 text-base px-6 flex-1"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Previous
            </Button>
            <Button
              onClick={handleNext}
              className="h-16 text-base px-6 flex-1"
            >
              {currentIndex < selectedManeuvers.length - 1 ? (
                <>Next <ArrowRight className="w-5 h-5 ml-2" /></>
              ) : (
                <>Finish <CheckCircle2 className="w-5 h-5 ml-2" /></>
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
      attempted: "Attempted",
      practiced: "Practiced",
      mastered: "Mastered",
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

          <Card>
            <CardHeader className="bg-gray-50 border-b p-6">
              <CardTitle>Maneuver Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
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
