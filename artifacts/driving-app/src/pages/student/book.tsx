import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetInstructorCalendar,
  useCreateBooking,
  useGetBookingWizardSummary,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ChevronLeft, ChevronRight, ArrowLeft, Car, Bike, Truck,
  GraduationCap, Clock, DollarSign, CheckCircle2, User,
  AlertCircle, Wallet, FileText, Info,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayHeader(dateStr: string): { weekday: string; dayMonth: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-AU", { weekday: "short" }),
    dayMonth: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
  };
}

function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}

function isPast(dateStr: string, timeStr: string): boolean {
  const now = new Date();
  const slot = new Date(dateStr + "T" + timeStr + ":00");
  return slot <= now;
}

function generateSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let mins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (mins < endMins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    mins += 30;
  }
  return slots;
}

function isBooked(
  time: string,
  bookedSlots: Array<{ startTime: string; durationMinutes: number | null }>,
): boolean {
  const [sh, sm] = time.split(":").map(Number);
  const slotStart = sh * 60 + sm;
  const slotEnd = slotStart + 30;
  return bookedSlots.some((b) => {
    const [bh, bm] = b.startTime.split(":").map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = bStart + (b.durationMinutes ?? 60);
    return slotStart < bEnd && bStart < slotEnd;
  });
}

function formatRate(cents: number | null | undefined): string {
  if (!cents) return "";
  return `$${Math.round(cents / 100)}/hr`;
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLongDate(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayLabel = d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  return `${dayLabel} at ${timeStr}`;
}

// ─── Training categories ──────────────────────────────────────────────────────

const TRAINING_CATEGORIES = [
  { value: "car_learner", label: "Car — Learner", Icon: Car },
  { value: "car_probationary", label: "Car — Provisional", Icon: Car },
  { value: "q_ride_re", label: "Q-RIDE RE (Learner Rider)", Icon: Bike },
  { value: "q_ride_r", label: "Q-RIDE R (Unrestricted Rider)", Icon: Bike },
  { value: "q_ride_re_to_r", label: "Q-RIDE RE→R Progression", Icon: Bike },
  { value: "mr", label: "MR — Medium Rigid", Icon: Truck },
  { value: "hr", label: "HR — Heavy Rigid", Icon: Truck },
  { value: "hc", label: "HC — Heavy Combination", Icon: Truck },
  { value: "mc", label: "MC — Multi-Combination", Icon: Truck },
] as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

type WizardStep = "pick-time" | "details" | "summary";

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { key: WizardStep; label: string }[] = [
    { key: "pick-time", label: "Pick a time" },
    { key: "details", label: "Lesson details" },
    { key: "summary", label: "Confirm & pay" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = s.key === step;
        return (
          <div key={s.key} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${done ? "bg-green-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day column for the calendar ──────────────────────────────────────────────

function DayColumn({
  date, windows, bookedSlots, selectedDate, selectedTime, onSelect,
}: {
  date: string;
  windows: Array<{ startTime: string; endTime: string }>;
  bookedSlots: Array<{ startTime: string; durationMinutes: number | null }>;
  selectedDate: string | null;
  selectedTime: string | null;
  onSelect: (date: string, time: string) => void;
}) {
  const { weekday, dayMonth } = formatDayHeader(date);
  const today = isToday(date);
  const now = new Date();
  const isPastDay = new Date(date + "T23:59:59") < now;

  const allSlots = windows.flatMap((w) => generateSlots(w.startTime, w.endTime));
  const uniqueSlots = [...new Set(allSlots)].sort();

  return (
    <div className="flex flex-col min-w-[88px]">
      <div
        className={`text-center rounded-lg py-2 px-1 mb-2 ${
          today ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        <p className="text-xs font-semibold">{weekday}</p>
        <p className="text-[11px]">{dayMonth}</p>
      </div>
      {uniqueSlots.length === 0 || isPastDay ? (
        <div className="flex-1 flex items-start justify-center pt-3">
          <span className="text-[11px] text-muted-foreground text-center leading-snug">Not<br />available</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {uniqueSlots.map((time) => {
            const booked = isBooked(time, bookedSlots);
            const past = isPast(date, time);
            const selected = selectedDate === date && selectedTime === time;
            const disabled = booked || past;
            return (
              <button
                key={time}
                disabled={disabled}
                onClick={() => onSelect(date, time)}
                className={`text-[12px] font-medium py-1.5 rounded-md border transition-all leading-none ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : booked
                    ? "bg-muted/40 text-muted-foreground/50 border-transparent cursor-not-allowed line-through"
                    : past
                    ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed"
                    : "bg-background border-border hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer"
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentBookWizard() {
  const [, params] = useRoute<{ instructorId: string }>("/student/book/:instructorId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const instructorId = parseInt(params?.instructorId ?? "0", 10);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("pick-time");
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Step 2 form state
  const [duration, setDuration] = useState(60);
  const [transmissionType, setTransmissionType] = useState<"auto" | "manual">("auto");
  const [trainingCategory, setTrainingCategory] = useState("car_learner");
  const [carType, setCarType] = useState<"trainer_car" | "learner_car">("trainer_car");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");

  const fromDate = toDateStr(weekMonday);
  const toDate = toDateStr(addDays(weekMonday, 6));

  const { data: calendarData, isLoading } = useGetInstructorCalendar(
    instructorId,
    { from: fromDate, to: toDate },
    { query: { queryKey: ["/api/availability/instructor", instructorId, "calendar", fromDate, toDate] } },
  );

  // Step 3: booking wizard summary — only fetched when we reach the summary step
  const { data: wizardSummary, isLoading: summaryLoading } = useGetBookingWizardSummary(
    { instructorId, durationMinutes: duration },
    {
      query: {
        queryKey: ["/api/bookings/wizard-summary", instructorId, duration],
        enabled: step === "summary" && !!instructorId,
      },
    },
  );

  const createBooking = useCreateBooking();

  const instructor = (calendarData as any)?.instructor;
  const days: any[] = (calendarData as any)?.days ?? [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const canGoPrev = addDays(weekMonday, -1) >= today;

  const weekDates = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(weekMonday, i)));

  const weekLabel = (() => {
    const start = new Date(fromDate + "T00:00:00");
    const end = new Date(toDate + "T00:00:00");
    const startLabel = start.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const endLabel = end.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  })();

  // Derived payment state (Step 3)
  const isBypassWallet = wizardSummary?.isBypassWallet ?? false;
  const costCents = wizardSummary?.costCents ?? null;
  const balanceCents = wizardSummary?.balanceCents ?? 0;
  const walletInsufficient =
    !isBypassWallet && costCents !== null && balanceCents < costCents;

  const handleSlotSelect = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };

  const handleToSummary = () => {
    if (!suburb.trim() || !postcode.trim()) {
      toast({ title: "Pickup suburb and postcode are required", variant: "destructive" });
      return;
    }
    setStep("summary");
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    const paymentMethod = isBypassWallet ? "invoice" : "wallet";
    try {
      await createBooking.mutateAsync({
        data: {
          instructorId,
          requestedDate: selectedDate,
          requestedTime: selectedTime,
          durationMinutes: duration,
          transmissionType: transmissionType as any,
          trainingCategory: trainingCategory as any,
          carType: carType as any,
          suburb: suburb.trim(),
          postcode: postcode.trim(),
          studentNotes: notes.trim() || undefined,
          paymentMethod: paymentMethod as any,
        } as any,
      });
      toast({
        title: isBypassWallet ? "Booking request sent!" : "Booking confirmed!",
        description: isBypassWallet
          ? `Your lesson on ${formatLongDate(selectedDate, selectedTime)} has been requested. It will be invoiced to your plan manager.`
          : instructor
          ? `Your lesson with ${instructor.fullName} on ${formatLongDate(selectedDate, selectedTime)} has been booked.`
          : "Your lesson has been booked.",
      });
      setLocation("/student/bookings");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to confirm booking";
      toast({ title: msg, variant: "destructive" });
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-3xl space-y-5">
        {/* Back link */}
        <Button variant="ghost" size="sm" onClick={() => setLocation("/student/search")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to search
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Book a Lesson</h1>
          {instructor && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">{instructor.fullName}</span>
              </div>
              {instructor.hourlyRateCents && (
                <Badge variant="secondary" className="gap-1">
                  <DollarSign className="w-3 h-3" />
                  From {formatRate(instructor.hourlyRateCents)}
                </Badge>
              )}
              {instructor.qualifications && (
                <span className="text-sm text-muted-foreground">{instructor.qualifications}</span>
              )}
            </div>
          )}
        </div>

        <StepIndicator step={step} />

        {/* ── Step 1: Pick a time ─────────────────────────────────────────── */}
        {step === "pick-time" && (
          <div className="space-y-4">
            {/* Week navigation */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline" size="sm"
                onClick={() => setWeekMonday((d) => addDays(d, -7))}
                disabled={!canGoPrev}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <span className="text-sm font-medium text-center">{weekLabel}</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setWeekMonday((d) => addDays(d, 7))}
                className="gap-1.5"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Calendar grid */}
            <Card>
              <CardContent className="pt-4 pb-5">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <div className="flex gap-2 min-w-max">
                      {weekDates.map((date) => {
                        const dayData = days.find((d: any) => d.date === date);
                        return (
                          <DayColumn
                            key={date}
                            date={date}
                            windows={dayData?.windows ?? []}
                            bookedSlots={dayData?.bookedSlots ?? []}
                            selectedDate={selectedDate}
                            selectedTime={selectedTime}
                            onSelect={handleSlotSelect}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                {!isLoading && (
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded border border-primary bg-primary/10 inline-block" />
                      Selected
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded border border-border bg-background inline-block" />
                      Available
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-muted/40 inline-block" />
                      Taken / past
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedDate && selectedTime ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-primary/5 border-primary/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {formatLongDate(selectedDate, selectedTime)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tap "Next" to set lesson details</p>
                </div>
                <Button onClick={() => setStep("details")} className="gap-1.5 shrink-0">
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Select an available time slot above to continue.
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Lesson details ──────────────────────────────────────── */}
        {step === "details" && selectedDate && selectedTime && (
          <div className="space-y-5">
            {/* Selected time summary */}
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-green-50 border-green-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {formatLongDate(selectedDate, selectedTime)}
                  </p>
                  {instructor && (
                    <p className="text-xs text-green-700">with {instructor.fullName}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={() => setStep("pick-time")}
                className="text-muted-foreground gap-1 shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Change
              </Button>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" /> Duration
              </Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 60, label: "1 hour" },
                  { value: 90, label: "1.5 hours" },
                  { value: 120, label: "2 hours" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDuration(value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      duration === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {label}
                    {instructor?.hourlyRateCents && (
                      <span className="ml-1.5 text-xs opacity-70">
                        {formatCents(Math.round((instructor.hourlyRateCents * value) / 60))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Training category */}
            <div className="space-y-2">
              <Label>Licence class / training category *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRAINING_CATEGORIES.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTrainingCategory(value)}
                    className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm text-left transition-all ${
                      trainingCategory === value
                        ? "border-primary bg-primary/5 font-semibold text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Car type */}
            <div className="space-y-2">
              <Label>Vehicle for this lesson</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "trainer_car", label: "Trainer's car", Icon: Car },
                  { value: "learner_car", label: "Learner's car", Icon: GraduationCap },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCarType(value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${
                      carType === value
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transmission */}
            <div className="space-y-2">
              <Label>Transmission</Label>
              <div className="flex gap-3">
                {([
                  { value: "auto", label: "Automatic" },
                  { value: "manual", label: "Manual" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTransmissionType(value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      transmissionType === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pickup location */}
            <div className="space-y-2">
              <Label>Pickup location *</Label>
              <p className="text-xs text-muted-foreground">Where should your instructor pick you up?</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Suburb</Label>
                  <Input
                    placeholder="e.g. Chermside"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Postcode</Label>
                  <Input
                    placeholder="e.g. 4032"
                    maxLength={4}
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes for instructor <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="Any special requirements, a specific street address, or learning goals…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Next → summary */}
            <div className="pt-1">
              <Button
                className="w-full"
                size="lg"
                onClick={handleToSummary}
                disabled={!suburb.trim() || !postcode.trim()}
              >
                Review &amp; Pay <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              {(!suburb.trim() || !postcode.trim()) && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Enter a pickup suburb and postcode to continue.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Booking Summary ─────────────────────────────────────── */}
        {step === "summary" && selectedDate && selectedTime && (
          <div className="space-y-5">
            {/* Recap banner */}
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-green-50 border-green-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {formatLongDate(selectedDate, selectedTime)}
                  </p>
                  {instructor && (
                    <p className="text-xs text-green-700">
                      with {instructor.fullName} · {duration === 60 ? "1 hr" : duration === 90 ? "1.5 hrs" : "2 hrs"}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={() => setStep("details")}
                className="text-muted-foreground gap-1 shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Change
              </Button>
            </div>

            {/* Payment summary card */}
            {summaryLoading ? (
              <Card>
                <CardContent className="pt-6 pb-6 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Checking your account…</span>
                </CardContent>
              </Card>
            ) : isBypassWallet ? (
              /* ── Scenario B: NDIS / Post-pay ── */
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900">Invoiced to your plan manager / provider</p>
                      <p className="text-sm text-blue-700 mt-0.5">
                        This lesson will be invoiced to your NDIS plan manager or post-pay provider.
                        No funds will be deducted from a wallet.
                      </p>
                    </div>
                  </div>

                  {costCents !== null && (
                    <>
                      <Separator className="bg-blue-200" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-800 font-medium">Lesson cost</span>
                        <span className="font-bold text-blue-900">{formatCents(costCents)}</span>
                      </div>
                      <p className="text-xs text-blue-600 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        An invoice will be issued after your lesson is confirmed.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* ── Scenario A: Standard wallet payment ── */
              <Card className={walletInsufficient ? "border-destructive/40" : "border-border"}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">Lesson payment</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Funds will be deducted from your wallet when you confirm.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Lesson cost</span>
                      <span className="font-semibold">
                        {costCents !== null ? formatCents(costCents) : "No rate set"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Your wallet balance</span>
                      <span className={`font-semibold ${walletInsufficient ? "text-destructive" : "text-foreground"}`}>
                        {formatCents(balanceCents)}
                      </span>
                    </div>
                    {costCents !== null && (
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Balance after booking</span>
                        <span className={`font-bold ${walletInsufficient ? "text-destructive" : "text-green-700"}`}>
                          {walletInsufficient ? "—" : formatCents(balanceCents - costCents)}
                        </span>
                      </div>
                    )}
                  </div>

                  {walletInsufficient && (
                    <Alert variant="destructive" className="py-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm font-semibold">Insufficient Funds — Please Top Up</AlertTitle>
                      <AlertDescription className="text-xs mt-0.5">
                        You need {formatCents(costCents)} but only have {formatCents(balanceCents)}.
                        Top up your wallet to continue.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Confirm button */}
            <div className="pt-1 space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirm}
                disabled={
                  createBooking.isPending ||
                  summaryLoading ||
                  walletInsufficient
                }
              >
                {createBooking.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming…</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isBypassWallet ? "Confirm Booking Request" : "Confirm Booking"}
                  </>
                )}
              </Button>
              {walletInsufficient && (
                <p className="text-xs text-muted-foreground text-center">
                  Top up your wallet before confirming this lesson.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
