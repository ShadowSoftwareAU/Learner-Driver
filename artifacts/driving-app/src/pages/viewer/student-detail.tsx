import { useGetViewerStudentDashboard, useGetMyWallet, usePayBookingWithCredits } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, ArrowLeft, Clock, Calendar, MapPin, AlertTriangle, CreditCard, CheckCircle2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const WALLET_QK = "/api/wallet";

const PEDAL_LABELS: Record<string, string> = {
  standard: "Standard dual-control",
  instructor: "Instructor pedals only",
  student: "Student pedals only",
  none: "No pedal control",
};

export default function ViewerStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paidBookingIds, setPaidBookingIds] = useState<number[]>([]);

  const { data, isLoading } = useGetViewerStudentDashboard(Number(id), {
    query: { queryKey: ["/api/viewer/students", id] },
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

  const { student, recentAssessments, upcomingBookings, link } = data;

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-3xl">
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
              <CardDescription>The last few completed driving assessments.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {recentAssessments.map((a: {
                  id: number;
                  lessonDate: string;
                  durationMinutes: number;
                  pedalOperator: string;
                  focusAreasNext?: string | null;
                  totalHoursThisLesson?: number | null;
                }) => (
                  <li key={a.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(new Date(a.lessonDate), "d MMM yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.durationMinutes} min
                        {a.totalHoursThisLesson != null && ` · +${Number(a.totalHoursThisLesson).toFixed(1)} hrs`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {PEDAL_LABELS[a.pedalOperator] ?? a.pedalOperator}
                    </p>
                    {a.focusAreasNext && (
                      <p className="text-xs text-muted-foreground italic">
                        Focus next: {a.focusAreasNext}
                      </p>
                    )}
                  </li>
                ))}
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
    </SidebarLayout>
  );
}
