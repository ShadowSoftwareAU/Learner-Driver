import {
  useGetViewerStudentDashboard,
  useGetMyWallet,
  usePayBookingWithCredits,
  useCreateSupervisedSession,
  useUpdateSupervisedSession,
  useDeleteSupervisedSession,
  getGetViewerStudentDashboardQueryKey,
  getGetViewerStudentsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Eye, ArrowLeft, Clock, Calendar, MapPin, CreditCard,
  CheckCircle2, GraduationCap, Users, Plus, Pencil, Trash2, UserCircle2,
  AlertCircle, Download, Moon, Star, Trophy, Zap, TrendingUp, Award,
  BookOpen, Shield, RotateCcw, Mountain, Lightbulb, ClipboardList,
  MessageSquare, Info,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format, differenceInDays, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const WALLET_QK = "/api/wallet";
const VIEWER_STUDENTS_QK = getGetViewerStudentsQueryKey();

// ─── State hour requirements ──────────────────────────────────────────────────

const STATE_REQUIREMENTS: Record<string, { total: number; night: number }> = {
  QLD: { total: 100, night: 10 },
  NSW: { total: 120, night: 20 },
  VIC: { total: 120, night: 10 },
  SA:  { total: 75,  night: 15 },
  WA:  { total: 50,  night: 0  },
  TAS: { total: 80,  night: 0  },
  NT:  { total: 50,  night: 0  },
  ACT: { total: 100, night: 10 },
};
const DEFAULT_REQ = { total: 120, night: 0 };

// ─── Milestone metadata ───────────────────────────────────────────────────────

const MILESTONE_META: Record<string, { emoji: string; name: string; description: string }> = {
  first_lesson:           { emoji: "⭐", name: "First Lesson",        description: "Logged the very first driving lesson." },
  hours_10:               { emoji: "🕙", name: "10 Hours",            description: "10 hours of supervised driving reached." },
  hours_25:               { emoji: "🚗", name: "Quarter Way",         description: "25 hours — a quarter of the way there!" },
  hours_50:               { emoji: "⚡", name: "Halfway There",       description: "50 hours logged. Halfway to the goal." },
  hours_75:               { emoji: "📈", name: "75 Hours",            description: "75 hours — the finish line is in sight!" },
  hours_100:              { emoji: "🏆", name: "Century Driver",      description: "100 hours of supervised driving. Extraordinary!" },
  first_maneuver_mastered:{ emoji: "✅", name: "First Mastery",       description: "First driving maneuver fully mastered." },
  maneuvers_5:            { emoji: "📚", name: "Skill Builder",       description: "5 different maneuvers mastered." },
  maneuvers_10:           { emoji: "🥈", name: "Double Digits",       description: "10 maneuvers mastered." },
  maneuvers_20:           { emoji: "🛡️", name: "Expert in Progress",  description: "20 maneuvers mastered." },
  all_maneuvers:          { emoji: "👑", name: "Complete Mastery",    description: "Every maneuver fully mastered!" },
  roundabouts_10:         { emoji: "🔄", name: "Roundabout Rookie",   description: "Roundabouts practiced 10 times." },
  hill_starts_20:         { emoji: "⛰️", name: "Hill Climber",        description: "20 hill starts practiced." },
  parking_10:             { emoji: "🅿️", name: "Parking Pro",         description: "10 parking maneuvers practiced." },
};

// ─── Mentor tips content ──────────────────────────────────────────────────────

const MENTOR_TIPS = [
  {
    id: "calm",
    title: "Stay calm and give clear instructions",
    body: "Speak early and calmly before each maneuver. Shouting or grabbing the wheel in non-emergency situations increases anxiety and reduces learning. Say the action before the turn, not during.",
  },
  {
    id: "environment",
    title: "Choose the right practice environment",
    body: "Start in quiet carparks or residential streets with low traffic. Gradually move to busier roads only after the learner is confident. Match the difficulty to their current skill level.",
  },
  {
    id: "night",
    title: "Log night driving hours deliberately",
    body: "Most states require a minimum number of night driving hours. Plan dedicated night drives rather than waiting for them to happen organically. A 30-minute evening loop around familiar streets counts.",
  },
  {
    id: "instructor",
    title: "Reinforce what the instructor is teaching",
    body: "Ask the learner what they focused on in their last professional lesson and practice those specific skills. Consistency between supervised and professional lessons accelerates progress significantly.",
  },
  {
    id: "debrief",
    title: "Debrief after every session",
    body: "Spend 5 minutes talking through what went well and one or two things to improve. Keep the tone positive. End on something they did right — it builds confidence for the next session.",
  },
  {
    id: "dual_control",
    title: "Understand when to intervene",
    body: "Only physically intervene in a genuine emergency. For everything else, use your voice. Pre-agree a signal word (e.g. 'stop') that means pull over safely — and practice using it calmly.",
  },
];

// ─── Form types ───────────────────────────────────────────────────────────────

const PEDAL_LABELS: Record<string, string> = {
  standard: "Standard dual-control",
  instructor: "Supervisor controls",
  student: "Student controls",
  none: "No pedal control",
  shared: "Shared controls",
};

const PEDAL_OPTIONS = [
  { value: "student",     label: "Student controls" },
  { value: "instructor",  label: "Supervisor controls" },
  { value: "shared",      label: "Shared controls" },
];

const WEATHER_OPTIONS = [
  { value: "clear",         label: "Clear" },
  { value: "partly_cloudy", label: "Partly cloudy" },
  { value: "overcast",      label: "Overcast" },
  { value: "light_rain",    label: "Light rain" },
  { value: "heavy_rain",    label: "Heavy rain" },
  { value: "foggy",         label: "Foggy" },
  { value: "windy",         label: "Windy" },
];

const LIGHTING_OPTIONS = [
  { value: "daylight", label: "Daylight" },
  { value: "dawn",     label: "Dawn" },
  { value: "dusk",     label: "Dusk" },
  { value: "night",    label: "Night" },
];

interface LogSessionForm {
  lessonDate: string;
  durationMinutes: string;
  pedalOperator: string;
  weatherCondition: string;
  lightingCondition: string;
  notes: string;
}

const DEFAULT_FORM: LogSessionForm = {
  lessonDate: new Date().toISOString().slice(0, 10),
  durationMinutes: "60",
  pedalOperator: "student",
  weatherCondition: "clear",
  lightingCondition: "daylight",
  notes: "",
};

function sessionToForm(a: any): LogSessionForm {
  return {
    lessonDate: a.lessonDate ?? new Date().toISOString().slice(0, 10),
    durationMinutes: String(a.durationMinutes ?? 60),
    pedalOperator: a.pedalOperator ?? "student",
    weatherCondition: a.weatherCondition ?? "clear",
    lightingCondition: a.lightingCondition ?? "daylight",
    notes: a.notes ?? "",
  };
}

// ─── SVG donut ring ───────────────────────────────────────────────────────────

function DonutRing({
  value, max, color, size = 80, strokeWidth = 9,
}: {
  value: number; max: number; color: string; size?: number; strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / Math.max(1, max)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    </svg>
  );
}

// ─── Hours progress component ─────────────────────────────────────────────────

function HoursProgress({
  student, instructorHours, supervisedHours, effectiveTotalHours, isQLD, nightHours,
}: any) {
  const req = student.state ? (STATE_REQUIREMENTS[student.state] ?? DEFAULT_REQ) : DEFAULT_REQ;
  const totalToShow = isQLD ? effectiveTotalHours : (student.totalHours ?? 0);
  const pct = Math.min(100, Math.round((totalToShow / req.total) * 100));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Hours Progress
          {student.state && (
            <Badge variant="outline" className="text-xs font-normal ml-1">{student.state} requirements</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          {student.state === "QLD"
            ? "Queensland counts 1 professional hour as 3 effective hours toward the 100-hour target."
            : `Target: ${req.total} total hours${req.night > 0 ? ` including ${req.night} night hours` : ""}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main donut + breakdown */}
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <DonutRing value={totalToShow} max={req.total} color="#3b82f6" size={96} strokeWidth={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none">{Math.floor(totalToShow)}</span>
              <span className="text-[10px] text-muted-foreground">{isQLD ? "eff. hrs" : "hrs"}</span>
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  {isQLD ? "Effective total" : "Total"} toward {req.total} hrs
                </span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {req.night > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Moon className="w-3 h-3" /> Night hours
                  </span>
                  <span className="font-semibold">{nightHours} / {req.night} hrs</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, (nightHours / req.night) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown tiles */}
        <div className={`grid gap-3 ${isQLD ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
            <GraduationCap className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-700">{Number(instructorHours).toFixed(1)}</p>
            <p className="text-[11px] text-blue-600/80">Professional hrs</p>
            {isQLD && <p className="text-[10px] text-blue-500 mt-0.5">× 3 = {(Number(instructorHours) * 3).toFixed(1)} eff.</p>}
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
            <Users className="w-4 h-4 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-amber-700">{Number(supervisedHours).toFixed(1)}</p>
            <p className="text-[11px] text-amber-600/80">Supervised hrs</p>
          </div>
          {isQLD && (
            <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
              <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-700">{Number(effectiveTotalHours).toFixed(1)}</p>
              <p className="text-[11px] text-green-600/80">Effective total</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Permit expiry alert ──────────────────────────────────────────────────────

function PermitAlert({ licenceExpiry }: { licenceExpiry?: string | null }) {
  if (!licenceExpiry) return null;
  let expiry: Date;
  try { expiry = parseISO(licenceExpiry); } catch { return null; }
  const days = differenceInDays(expiry, new Date());
  if (days > 90) return null;

  const isExpired = days < 0;
  const isUrgent = days <= 30;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
      isExpired ? "bg-red-50 border-red-200 text-red-900"
      : isUrgent ? "bg-orange-50 border-orange-200 text-orange-900"
      : "bg-yellow-50 border-yellow-200 text-yellow-900"
    }`}>
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">
          {isExpired ? "Learner permit has expired" : `Learner permit expires in ${days} day${days !== 1 ? "s" : ""}`}
        </p>
        <p className="text-xs mt-0.5 opacity-80">
          {isExpired
            ? `Expired ${format(expiry, "d MMM yyyy")}. A renewal must be completed before driving again.`
            : `Expiry: ${format(expiry, "d MMM yyyy")}. Renew before it lapses to avoid a gap in supervised hours.`}
        </p>
      </div>
    </div>
  );
}

// ─── Milestone badges ─────────────────────────────────────────────────────────

function MilestoneBadges({ milestones }: { milestones: Array<{ milestoneId: string; earnedAt: string }> }) {
  if (!milestones || milestones.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No milestones earned yet. Keep logging sessions!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          Milestones
          <Badge className="ml-1 bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
            {milestones.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {milestones.map(({ milestoneId, earnedAt }) => {
            const meta = MILESTONE_META[milestoneId];
            if (!meta) return null;
            return (
              <div
                key={milestoneId}
                title={`${meta.description}\nEarned ${format(new Date(earnedAt), "d MMM yyyy")}`}
                className="flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-sm text-yellow-900 cursor-default select-none"
              >
                <span className="text-base leading-none">{meta.emoji}</span>
                <span className="font-medium text-xs">{meta.name}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skill mastery ────────────────────────────────────────────────────────────

function SkillMasteryCard({
  skillSummary,
}: {
  skillSummary: Array<{ category: string; mastered: number; practicing: number; notAttempted: number }>;
}) {
  if (!skillSummary || skillSummary.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Skill Mastery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Skill data will appear after the first professional lesson.
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = skillSummary.reduce(
    (acc, c) => ({ mastered: acc.mastered + c.mastered, practicing: acc.practicing + c.practicing, notAttempted: acc.notAttempted + c.notAttempted }),
    { mastered: 0, practicing: 0, notAttempted: 0 },
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Skill Mastery
        </CardTitle>
        <CardDescription className="text-xs flex gap-4">
          <span className="text-green-700 font-medium">✓ {total.mastered} mastered</span>
          <span className="text-blue-700 font-medium">↻ {total.practicing} practicing</span>
          <span className="text-muted-foreground">○ {total.notAttempted} not started</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {skillSummary.map(({ category, mastered, practicing, notAttempted }) => {
            const cat_total = mastered + practicing + notAttempted;
            const masteredPct = Math.round((mastered / cat_total) * 100);
            const practicingPct = Math.round((practicing / cat_total) * 100);
            return (
              <div key={category}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium capitalize">{category.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{mastered}/{cat_total}</span>
                </div>
                <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                  {mastered > 0 && (
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${masteredPct}%` }} />
                  )}
                  {practicing > 0 && (
                    <div className="h-full bg-blue-400 transition-all" style={{ width: `${practicingPct}%` }} />
                  )}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                  {mastered > 0 && <span className="text-green-700">{mastered} mastered</span>}
                  {practicing > 0 && <span className="text-blue-700">{practicing} practicing</span>}
                  {notAttempted > 0 && <span>{notAttempted} not started</span>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Handover / homework card ─────────────────────────────────────────────────

function HandoverCard({ handover }: { handover: any }) {
  if (!handover) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Instructor Homework
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No homework yet. Notes from the instructor will appear here after each professional lesson.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={handover.isSafetyCritical ? "border-red-200 bg-red-50/40" : "border-primary/20 bg-primary/5"}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${handover.isSafetyCritical ? "text-red-600" : "text-primary"}`} />
            Instructor Homework
          </CardTitle>
          {handover.isSafetyCritical && (
            <Badge variant="destructive" className="text-xs shrink-0">Safety note</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {format(new Date(handover.createdAt), "d MMM yyyy 'at' h:mm a")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm leading-relaxed">{handover.note}</p>
        {handover.focusAreas && (
          <div className="rounded-md border bg-background/60 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Focus areas for next session</p>
            <p className="text-sm">{handover.focusAreas}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Mentor tips ──────────────────────────────────────────────────────────────

function MentorTips() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          Supervisor Tips
        </CardTitle>
        <CardDescription className="text-xs">Guidance for getting the most out of each supervised session.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {MENTOR_TIPS.map((tip) => (
            <AccordionItem key={tip.id} value={tip.id}>
              <AccordionTrigger className="text-sm text-left">{tip.title}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {tip.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ─── Session form fields (shared) ─────────────────────────────────────────────

function SessionFormFields({
  form,
  setForm,
}: {
  form: LogSessionForm;
  setForm: React.Dispatch<React.SetStateAction<LogSessionForm>>;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lessonDate">Date</Label>
          <Input
            id="lessonDate"
            type="date"
            value={form.lessonDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm((f) => ({ ...f, lessonDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            type="number"
            min={1}
            max={480}
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Pedal operator</Label>
        <Select value={form.pedalOperator} onValueChange={(v) => setForm((f) => ({ ...f, pedalOperator: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PEDAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Weather</Label>
          <Select value={form.weatherCondition} onValueChange={(v) => setForm((f) => ({ ...f, weatherCondition: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WEATHER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Lighting</Label>
          <Select value={form.lightingCondition} onValueChange={(v) => setForm((f) => ({ ...f, lightingCondition: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIGHTING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="e.g. Practiced merging on the highway, handled well."
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ViewerStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { getToken } = useAuth();

  const [payingId, setPayingId] = useState<number | null>(null);
  const [paidBookingIds, setPaidBookingIds] = useState<number[]>([]);
  const [showLogSession, setShowLogSession] = useState(false);
  const [form, setForm] = useState<LogSessionForm>(DEFAULT_FORM);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<LogSessionForm>(DEFAULT_FORM);
  const [deletingSession, setDeletingSession] = useState<any | null>(null);
  const [exporting, setExporting] = useState(false);

  const studentId = Number(id);
  const dashboardQK = ["/api/viewer/students", id];

  const { data, isLoading } = useGetViewerStudentDashboard(studentId, {
    query: { queryKey: dashboardQK },
  });

  const { data: wallet } = useGetMyWallet({ query: { queryKey: [WALLET_QK] } });

  const { mutate: payWithCredits } = usePayBookingWithCredits({
    mutation: {
      onSuccess: (_data, variables) => {
        toast({ title: "Lesson paid with credits" });
        setPaidBookingIds((prev) => [...prev, variables.bookingId]);
        qc.invalidateQueries({ queryKey: [WALLET_QK] });
        setPayingId(null);
      },
      onError: (err: any) => {
        const message = err?.response?.data?.error ?? "Could not pay for this booking.";
        toast({ title: "Payment failed", description: message, variant: "destructive" });
        setPayingId(null);
      },
    },
  });

  const { mutate: logSession, isPending: loggingSession } = useCreateSupervisedSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Session logged", description: "The supervised driving session has been recorded." });
        setShowLogSession(false);
        setForm(DEFAULT_FORM);
        qc.invalidateQueries({ queryKey: dashboardQK });
        qc.invalidateQueries({ queryKey: VIEWER_STUDENTS_QK });
      },
      onError: (err: any) => {
        const status = err?.response?.status;
        const errData = err?.response?.data;
        if (status === 409 && errData?.error === "duplicate_session") {
          toast({
            title: "Possible duplicate session",
            description: errData?.message ?? "A session with the same date and duration was just logged. Check the recent sessions list before submitting again.",
            variant: "destructive",
            duration: 8000,
          });
        } else {
          toast({ title: "Failed to log session", description: errData?.error ?? "Could not log the session.", variant: "destructive" });
        }
      },
    },
  });

  const { mutate: updateSession, isPending: updatingSession } = useUpdateSupervisedSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Session updated" });
        setEditingSession(null);
        qc.invalidateQueries({ queryKey: dashboardQK });
        qc.invalidateQueries({ queryKey: VIEWER_STUDENTS_QK });
      },
      onError: (err: any) => {
        toast({ title: "Failed to update session", description: err?.response?.data?.error ?? "Could not update the session.", variant: "destructive" });
      },
    },
  });

  const { mutate: deleteSession, isPending: deletingSessionPending } = useDeleteSupervisedSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Session deleted" });
        setDeletingSession(null);
        qc.invalidateQueries({ queryKey: dashboardQK });
        qc.invalidateQueries({ queryKey: VIEWER_STUDENTS_QK });
      },
      onError: (err: any) => {
        toast({ title: "Failed to delete session", description: err?.response?.data?.error ?? "Could not delete the session.", variant: "destructive" });
      },
    },
  });

  function handleLogSession() {
    const duration = parseInt(form.durationMinutes, 10);
    if (!form.lessonDate || isNaN(duration) || duration < 1) {
      toast({ title: "Please fill in a valid date and duration.", variant: "destructive" });
      return;
    }
    logSession({
      studentId,
      data: {
        lessonDate: form.lessonDate,
        durationMinutes: duration,
        pedalOperator: form.pedalOperator as any,
        weatherCondition: form.weatherCondition as any,
        lightingCondition: form.lightingCondition as any,
        notes: form.notes || null,
      },
    });
  }

  function handleEditSession() {
    if (!editingSession) return;
    const duration = parseInt(editForm.durationMinutes, 10);
    if (!editForm.lessonDate || isNaN(duration) || duration < 1) {
      toast({ title: "Please fill in a valid date and duration.", variant: "destructive" });
      return;
    }
    updateSession({
      studentId,
      sessionId: editingSession.id,
      data: {
        lessonDate: editForm.lessonDate,
        durationMinutes: duration,
        pedalOperator: editForm.pedalOperator as any,
        weatherCondition: editForm.weatherCondition as any,
        lightingCondition: editForm.lightingCondition as any,
        notes: editForm.notes || null,
      },
    });
  }

  function handleDeleteSession() {
    if (!deletingSession) return;
    deleteSession({ studentId, sessionId: deletingSession.id });
  }

  function handlePay(bookingId: number) {
    setPayingId(bookingId);
    payWithCredits({ bookingId });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/viewer/students/${studentId}/logbook/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data as any)?.student?.fullName?.replace(/\s+/g, "_") ?? "student"}_logbook.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Logbook exported", description: "CSV file downloaded to your device." });
    } catch {
      toast({ title: "Export failed", description: "Could not download the logbook.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  if (isLoading || !data) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const {
    student, recentAssessments, upcomingBookings, link,
    instructorHours, supervisedHours, effectiveTotalHours, isQLD,
    nightHours, latestHandover, milestones, skillSummary,
  } = data as any;

  const supervisedSessions = (recentAssessments ?? []).filter((a: any) => a.performedByRole === "supervised");
  const instructorLessons = (recentAssessments ?? []).filter((a: any) => a.performedByRole === "instructor");

  return (
    <SidebarLayout>
      <div className="space-y-4 max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/viewer/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold tracking-tight">{student.fullName}</h1>
              </div>
              {link?.relationshipType && (
                <p className="text-sm text-muted-foreground capitalize">
                  {link.relationshipType.replace(/_/g, " ")}
                  {link.linkedAt && ` · Linked ${format(new Date(link.linkedAt), "d MMM yyyy")}`}
                </p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={() => setShowLogSession(true)}>
            <Plus className="w-4 h-4 mr-1" /> Log supervised drive
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logbook" className="relative">
              Logbook
              {supervisedSessions.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                  {supervisedSessions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="lessons">
              Lessons
              {instructorLessons.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] text-blue-800 font-bold">
                  {instructorLessons.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          {/* ── Overview tab ─────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4 pt-2">
            <PermitAlert licenceExpiry={student.licenceExpiry} />
            <HoursProgress
              student={student}
              instructorHours={instructorHours}
              supervisedHours={supervisedHours}
              effectiveTotalHours={effectiveTotalHours}
              isQLD={isQLD}
              nightHours={nightHours ?? 0}
            />
            <MilestoneBadges milestones={milestones ?? []} />
            <SkillMasteryCard skillSummary={skillSummary ?? []} />
            <HandoverCard handover={latestHandover} />
            <MentorTips />
          </TabsContent>

          {/* ── Logbook tab (supervised sessions / new assessment) ────────── */}
          <TabsContent value="logbook" className="space-y-4 pt-2">
            {/* Log new session CTA */}
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-sm">Log a new supervised drive</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Record date, duration, conditions, and notes. Hours are added to the logbook immediately.
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowLogSession(true)} className="shrink-0">
                  <Plus className="w-4 h-4 mr-1" /> New session
                </Button>
              </CardContent>
            </Card>

            {/* Supervised sessions list */}
            {supervisedSessions.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Your supervised sessions</CardTitle>
                  <CardDescription className="text-xs">Sessions you have logged for {student.fullName}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {supervisedSessions.map((a: any) => (
                      <li key={a.id} className="py-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {a.lessonDate ? format(new Date(a.lessonDate), "d MMM yyyy") : "—"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {a.durationMinutes} min · +{(a.durationMinutes / 60).toFixed(1)} hrs
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {a.pedalOperator ? (PEDAL_LABELS[a.pedalOperator] ?? a.pedalOperator) : ""}
                              {a.weatherCondition && ` · ${a.weatherCondition.replace(/_/g, " ")}`}
                              {a.lightingCondition && a.lightingCondition !== "daylight" && ` · ${a.lightingCondition}`}
                            </p>
                            {a.notes && <p className="text-xs text-muted-foreground italic">"{a.notes}"</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditingSession(a); setEditForm(sessionToForm(a)); }}
                              title="Edit session"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingSession(a)}
                              title="Delete session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                  <BookOpen className="w-7 h-7" />
                  <p className="text-sm">No supervised sessions logged yet.</p>
                  <p className="text-xs">Use the button above to record your first session.</p>
                </CardContent>
              </Card>
            )}

            {/* Export */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                Export full logbook (CSV)
              </Button>
            </div>
          </TabsContent>

          {/* ── Lessons tab (instructor-led) ──────────────────────────────── */}
          <TabsContent value="lessons" className="space-y-4 pt-2">
            {instructorLessons.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Professional lessons</CardTitle>
                  <CardDescription className="text-xs">
                    Recent instructor-led sessions. Tap a lesson to view the full assessment.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {instructorLessons.map((a: any) => (
                      <li key={a.id} className="py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/viewer/assessments/${a.id}`)}
                          className="w-full text-left rounded-lg p-2 -mx-2 space-y-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {a.lessonDate ? format(new Date(a.lessonDate), "d MMM yyyy") : "—"}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                Instructor
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {a.durationMinutes} min · +{(a.durationMinutes / 60).toFixed(1)} hrs
                            </span>
                          </div>
                          {a.instructorName && (
                            <div className="flex items-center gap-1.5">
                              <UserCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{a.instructorName}</span>
                            </div>
                          )}
                          {a.focusAreasNext && (
                            <p className="text-xs text-muted-foreground italic">Focus next: {a.focusAreasNext}</p>
                          )}
                          <p className="text-xs text-primary font-medium">View lesson details →</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                  <GraduationCap className="w-7 h-7" />
                  <p className="text-sm">No professional lessons recorded yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Schedule tab ──────────────────────────────────────────────── */}
          <TabsContent value="schedule" className="space-y-4 pt-2">
            {upcomingBookings && upcomingBookings.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Upcoming lessons</CardTitle>
                  <CardDescription className="text-xs">
                    Next scheduled professional driving lessons. Plan supervised drives around these.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {upcomingBookings.map((b: any) => (
                      <li key={b.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {format(new Date(b.scheduledAt), "EEEE d MMM yyyy, h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {b.durationMinutes} min
                            </span>
                            {b.pickupAddress && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {b.pickupAddress}
                              </span>
                            )}
                            {b.instructorName && (
                              <span className="flex items-center gap-1">
                                <UserCircle2 className="w-3 h-3" />
                                {b.instructorName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            b.status === "confirmed" ? "bg-green-100 text-green-800"
                            : b.status === "pending" ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-700"
                          }`}>
                            {b.status}
                          </span>
                          {paidBookingIds.includes(b.id) ? (
                            <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                            </span>
                          ) : (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              disabled={payingId === b.id}
                              onClick={() => handlePay(b.id)}
                            >
                              {payingId === b.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                : <CreditCard className="w-3.5 h-3.5 mr-1" />}
                              Pay with credits
                              {wallet?.lessonPriceCents != null && ` ($${(wallet.lessonPriceCents / 100).toFixed(0)})`}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                  <Calendar className="w-7 h-7" />
                  <p className="text-sm">No upcoming lessons booked.</p>
                  <div className="flex items-start gap-2 max-w-xs text-center mt-1">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p className="text-xs">Bookings appear here once confirmed by the driving school.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Log supervised session dialog ───────────────────────────────── */}
      <Dialog open={showLogSession} onOpenChange={setShowLogSession}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log supervised drive</DialogTitle>
            <DialogDescription>
              Record a supervised driving session for {student.fullName}. Hours are added to the logbook immediately.
            </DialogDescription>
          </DialogHeader>
          <SessionFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogSession(false)} disabled={loggingSession}>Cancel</Button>
            <Button onClick={handleLogSession} disabled={loggingSession}>
              {loggingSession && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Log session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit supervised session dialog ──────────────────────────────── */}
      <Dialog open={!!editingSession} onOpenChange={(open) => { if (!open) setEditingSession(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit supervised session</DialogTitle>
            <DialogDescription>Update the details. The hours total adjusts automatically.</DialogDescription>
          </DialogHeader>
          <SessionFormFields form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)} disabled={updatingSession}>Cancel</Button>
            <Button onClick={handleEditSession} disabled={updatingSession}>
              {updatingSession && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deletingSession} onOpenChange={(open) => { if (!open) setDeletingSession(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSession && (
                <>
                  The {deletingSession.durationMinutes}-minute session on{" "}
                  {deletingSession.lessonDate ? format(new Date(deletingSession.lessonDate), "d MMM yyyy") : "this date"}{" "}
                  will be permanently removed and the hours deducted from {student.fullName}'s logbook.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSessionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={deletingSessionPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSessionPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
