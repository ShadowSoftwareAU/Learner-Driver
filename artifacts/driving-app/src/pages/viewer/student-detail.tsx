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
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Eye, ArrowLeft, Clock, Calendar, MapPin, CreditCard, CheckCircle2, GraduationCap, Users, Plus, Pencil, Trash2, UserCircle2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const WALLET_QK = "/api/wallet";

const VIEWER_STUDENTS_QK = getGetViewerStudentsQueryKey();

const PEDAL_LABELS: Record<string, string> = {
  standard: "Standard dual-control",
  instructor: "Instructor pedals only",
  student: "Student pedals only",
  none: "No pedal control",
  shared: "Shared controls",
};

const PEDAL_OPTIONS = [
  { value: "student", label: "Student controls" },
  { value: "instructor", label: "Supervisor controls" },
  { value: "shared", label: "Shared controls" },
];

const WEATHER_OPTIONS = [
  { value: "clear", label: "Clear" },
  { value: "partly_cloudy", label: "Partly cloudy" },
  { value: "overcast", label: "Overcast" },
  { value: "light_rain", label: "Light rain" },
  { value: "heavy_rain", label: "Heavy rain" },
  { value: "foggy", label: "Foggy" },
  { value: "windy", label: "Windy" },
];

const LIGHTING_OPTIONS = [
  { value: "daylight", label: "Daylight" },
  { value: "dawn", label: "Dawn" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
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

export default function ViewerStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paidBookingIds, setPaidBookingIds] = useState<number[]>([]);
  const [showLogSession, setShowLogSession] = useState(false);
  const [form, setForm] = useState<LogSessionForm>(DEFAULT_FORM);

  // Edit dialog state
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<LogSessionForm>(DEFAULT_FORM);

  // Delete confirmation state
  const [deletingSession, setDeletingSession] = useState<any | null>(null);

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
        const data = err?.response?.data;
        if (status === 409 && data?.error === "duplicate_session") {
          toast({
            title: "Possible duplicate session",
            description: data?.message ?? "A session with the same date and duration was just logged. Check the recent sessions list before submitting again.",
            variant: "destructive",
            duration: 8000,
          });
        } else {
          const message = data?.error ?? "Could not log the session.";
          toast({ title: "Failed to log session", description: message, variant: "destructive" });
        }
      },
    },
  });

  const { mutate: updateSession, isPending: updatingSession } = useUpdateSupervisedSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Session updated", description: "The supervised session has been updated." });
        setEditingSession(null);
        qc.invalidateQueries({ queryKey: dashboardQK });
        qc.invalidateQueries({ queryKey: VIEWER_STUDENTS_QK });
      },
      onError: (err: any) => {
        const message = err?.response?.data?.error ?? "Could not update the session.";
        toast({ title: "Failed to update session", description: message, variant: "destructive" });
      },
    },
  });

  const { mutate: deleteSession, isPending: deletingSessionPending } = useDeleteSupervisedSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Session deleted", description: "The supervised session has been removed." });
        setDeletingSession(null);
        qc.invalidateQueries({ queryKey: dashboardQK });
        qc.invalidateQueries({ queryKey: VIEWER_STUDENTS_QK });
      },
      onError: (err: any) => {
        const message = err?.response?.data?.error ?? "Could not delete the session.";
        toast({ title: "Failed to delete session", description: message, variant: "destructive" });
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

  if (isLoading || !data) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  const { student, recentAssessments, upcomingBookings, link, instructorHours, supervisedHours, effectiveTotalHours, isQLD } = data as any;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between gap-3">
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
            <Plus className="w-4 h-4 mr-1" /> Log session
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {student.totalHours != null ? Number(student.totalHours).toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">hrs logged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                No-shows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(student.noShowCount ?? 0) > 0 ? "text-yellow-700" : ""}`}>
                {student.noShowCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">missed lessons</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {student.attendanceReliabilityScore != null
                  ? `${student.attendanceReliabilityScore}%`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">reliability</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{upcomingBookings?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">booked lessons</p>
            </CardContent>
          </Card>
        </div>

        {isQLD && effectiveTotalHours != null && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                QLD Hours Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-amber-700">
                Queensland's 100-hour requirement counts instructor hours at 3× towards your total.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs text-muted-foreground font-medium">Instructor</span>
                  </div>
                  <p className="text-xl font-bold text-blue-700">{Number(instructorHours).toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">hrs × 3 = {(Number(instructorHours) * 3).toFixed(1)} effective</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs text-muted-foreground font-medium">Supervised</span>
                  </div>
                  <p className="text-xl font-bold text-amber-700">{Number(supervisedHours).toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">hrs (1× count)</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs text-muted-foreground font-medium">Effective</span>
                  </div>
                  <p className="text-xl font-bold text-green-700">{Number(effectiveTotalHours).toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">of 100 hrs needed</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress to 100 hrs</span>
                  <span className="font-medium text-amber-900">{Math.min(100, Math.round(Number(effectiveTotalHours)))}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(100, (Number(effectiveTotalHours) / 100) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {upcomingBookings && upcomingBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Lessons</CardTitle>
              <CardDescription>Next scheduled driving lessons.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {upcomingBookings.map((b: {
                  id: number;
                  scheduledAt: string;
                  durationMinutes: number;
                  status: string;
                  pickupAddress?: string | null;
                }) => (
                  <li key={b.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {format(new Date(b.scheduledAt), "EEEE d MMM yyyy, h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          b.status === "confirmed"
                            ? "bg-green-100 text-green-800"
                            : b.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {b.status}
                      </span>
                      {paidBookingIds.includes(b.id) ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={payingId === b.id}
                          onClick={() => handlePay(b.id)}
                        >
                          {payingId === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 mr-1" />
                          )}
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
        )}

        {recentAssessments && recentAssessments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Lessons</CardTitle>
              <CardDescription>The last few completed driving sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {recentAssessments.map((a: any) => {
                  const isSupervised = a.performedByRole === "supervised";
                  return (
                    <li key={a.id} className="py-3">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => !isSupervised && navigate(`/viewer/assessments/${a.id}`)}
                          className={`flex-1 text-left rounded-lg p-2 -mx-2 space-y-1.5 ${isSupervised ? "cursor-default" : "hover:bg-muted/50 transition-colors"}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {a.lessonDate ? format(new Date(a.lessonDate), "d MMM yyyy") : "—"}
                              </span>
                              {isSupervised ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  Supervised
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  Instructor
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {a.durationMinutes} min
                              {a.totalHoursThisLesson != null && ` · +${Number(a.totalHoursThisLesson / 60).toFixed(1)} hrs`}
                            </span>
                          </div>
                          {/* Instructor name for instructor-led lessons */}
                          {!isSupervised && a.instructorName && (
                            <div className="flex items-center gap-1.5">
                              <UserCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{a.instructorName}</span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {a.pedalOperator ? (PEDAL_LABELS[a.pedalOperator] ?? a.pedalOperator) : ""}
                          </p>
                          {!isSupervised && a.focusAreasNext && (
                            <p className="text-xs text-muted-foreground italic">
                              Focus next: {a.focusAreasNext}
                            </p>
                          )}
                          {!isSupervised && (
                            <p className="text-xs text-primary font-medium">View lesson details →</p>
                          )}
                        </button>

                        {/* Edit / delete actions — only for supervised sessions logged by this viewer */}
                        {isSupervised && (
                          <div className="flex items-center gap-1 pt-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingSession(a);
                                setEditForm(sessionToForm(a));
                              }}
                              title="Edit session"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingSession(a)}
                              title="Delete session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {(!recentAssessments || recentAssessments.length === 0) &&
          (!upcomingBookings || upcomingBookings.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center py-12 gap-3">
                <Clock className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No lesson history yet.</p>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Log supervised session dialog */}
      <Dialog open={showLogSession} onOpenChange={setShowLogSession}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log supervised session</DialogTitle>
            <DialogDescription>
              Record a supervised driving session for {student.fullName}. The hours will count toward their logbook immediately.
            </DialogDescription>
          </DialogHeader>

          <SessionFormFields form={form} setForm={setForm} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogSession(false)} disabled={loggingSession}>
              Cancel
            </Button>
            <Button onClick={handleLogSession} disabled={loggingSession}>
              {loggingSession && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Log session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit supervised session dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => { if (!open) setEditingSession(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit supervised session</DialogTitle>
            <DialogDescription>
              Update the details for this supervised session. The hours total will adjust automatically.
            </DialogDescription>
          </DialogHeader>

          <SessionFormFields form={editForm} setForm={setEditForm} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)} disabled={updatingSession}>
              Cancel
            </Button>
            <Button onClick={handleEditSession} disabled={updatingSession}>
              {updatingSession && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingSession} onOpenChange={(open) => { if (!open) setDeletingSession(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSession && (
                <>
                  The{" "}
                  {deletingSession.durationMinutes}-minute session on{" "}
                  {deletingSession.lessonDate
                    ? format(new Date(deletingSession.lessonDate), "d MMM yyyy")
                    : "this date"}{" "}
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

// ─── Shared form fields ───────────────────────────────────────────────────────

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
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PEDAL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Weather</Label>
          <Select value={form.weatherCondition} onValueChange={(v) => setForm((f) => ({ ...f, weatherCondition: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEATHER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Lighting</Label>
          <Select value={form.lightingCondition} onValueChange={(v) => setForm((f) => ({ ...f, lightingCondition: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIGHTING_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
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
