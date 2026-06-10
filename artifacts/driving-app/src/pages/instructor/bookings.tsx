import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListBookings,
  useClaimBooking,
  useDeclineBooking,
  useUpdateBooking,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarCheck, Clock, MapPin, Car, CheckCircle2, XCircle, User, GraduationCap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BookingStatus } from "@/lib/enums";
import { format } from "date-fns";

const PAST_LIMIT = 20;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  claimed: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-800 border-gray-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function BookingCard({
  booking,
  onClaim,
  onDecline,
  onComplete,
  loading,
}: {
  booking: any;
  onClaim?: () => void;
  onDecline?: () => void;
  onComplete?: () => void;
  loading: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {booking.studentId ? (
              <Link href={`/instructor/students/${booking.studentId}`} className="font-semibold hover:underline inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {booking.studentName ?? "Student"}
              </Link>
            ) : (
              <p className="font-semibold">{booking.studentName ?? "Student"}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {format(new Date(booking.requestedDate), "EEEE d MMMM yyyy")} at {booking.requestedTime}
            </p>
          </div>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full border capitalize ${STATUS_COLORS[booking.status] ?? ""}`}
          >
            {booking.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {booking.durationMinutes && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {booking.durationMinutes} min
            </div>
          )}
          {booking.transmissionType && (
            <div className="flex items-center gap-1.5 text-muted-foreground capitalize">
              <Car className="w-3.5 h-3.5" />
              {booking.transmissionType}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {booking.carType === "learner_car" ? (
              <><GraduationCap className="w-3.5 h-3.5" /> Learner's car</>
            ) : (
              <><Car className="w-3.5 h-3.5" /> Trainer's car</>
            )}
          </div>
          {(booking.suburb || booking.postcode) && (
            <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
              <MapPin className="w-3.5 h-3.5" />
              {[booking.suburb, booking.postcode].filter(Boolean).join(", ")}
            </div>
          )}
        </div>

        {booking.studentNotes && (
          <p className="text-sm bg-muted rounded p-2 text-muted-foreground italic">
            "{booking.studentNotes}"
          </p>
        )}

        {(onClaim || onDecline || onComplete) && (
          <div className="flex gap-2 pt-1">
            {onClaim && (
              <Button size="sm" onClick={onClaim} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Claim Lesson
              </Button>
            )}
            {onDecline && (
              <Button size="sm" variant="outline" onClick={onDecline} disabled={loading} className="gap-1.5 text-destructive hover:text-destructive">
                <XCircle className="w-3.5 h-3.5" />
                Decline
              </Button>
            )}
            {onComplete && (
              <Button size="sm" variant="outline" onClick={onComplete} disabled={loading} className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InstructorBookings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionId, setActionId] = useState<number | null>(null);

  const { data: allBookings, isLoading } = useListBookings(undefined, {
    query: { queryKey: ["/api/bookings"] },
  });

  const claim = useClaimBooking();
  const decline = useDeclineBooking();
  const update = useUpdateBooking();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/bookings"] });

  const handleClaim = async (id: number) => {
    setActionId(id);
    try {
      await claim.mutateAsync({ id });
      await invalidate();
      toast({ title: "Booking claimed", description: "The student will be notified." });
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const msg = status === 409
        ? "Another instructor already claimed this booking."
        : "Failed to claim booking.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (id: number) => {
    setActionId(id);
    try {
      await decline.mutateAsync({ id });
      await invalidate();
      toast({ title: "Booking declined." });
    } catch {
      toast({ title: "Failed to decline booking.", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = async (id: number) => {
    setActionId(id);
    try {
      await update.mutateAsync({ id, data: { status: BookingStatus.completed } });
      await invalidate();
      toast({ title: "Booking marked as complete." });
    } catch {
      toast({ title: "Failed to update booking.", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  // Sort: pending & upcoming chronological (soonest first); past reverse chronological
  const byRequestedAsc = (a: any, b: any) => {
    const ad = `${a.requestedDate}T${a.requestedTime ?? "00:00"}`;
    const bd = `${b.requestedDate}T${b.requestedTime ?? "00:00"}`;
    return ad.localeCompare(bd);
  };
  const byRequestedDesc = (a: any, b: any) => -byRequestedAsc(a, b);

  const { pending, active, past } = useMemo(() => {
    const all = (allBookings ?? []) as any[];
    return {
      pending: all.filter((b) => b.status === BookingStatus.pending).sort(byRequestedAsc),
      active: all
        .filter((b) => b.status === BookingStatus.claimed || b.status === BookingStatus.confirmed)
        .sort(byRequestedAsc),
      past: all
        .filter((b) => b.status === BookingStatus.completed || b.status === BookingStatus.cancelled)
        .sort(byRequestedDesc),
    };
  }, [allBookings]);

  const [showAllPast, setShowAllPast] = useState(false);
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT);

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">Manage lesson requests broadcast to you and your upcoming lessons.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Pending Requests</h2>
                {pending.length > 0 && (
                  <Badge variant="destructive" className="rounded-full">{pending.length}</Badge>
                )}
              </div>
              {pending.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <CalendarCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No pending requests right now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pending.map((b: any) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onClaim={() => handleClaim(b.id)}
                      onDecline={() => handleDecline(b.id)}
                      loading={actionId === b.id}
                    />
                  ))}
                </div>
              )}
            </section>

            {active.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Upcoming Lessons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {active.map((b: any) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onComplete={() => handleComplete(b.id)}
                      loading={actionId === b.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-muted-foreground">Past Lessons</h2>
                  <span className="text-xs text-muted-foreground">
                    {showAllPast ? past.length : Math.min(PAST_LIMIT, past.length)} of {past.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visiblePast.map((b: any) => (
                    <BookingCard key={b.id} booking={b} loading={false} />
                  ))}
                </div>
                {past.length > PAST_LIMIT && !showAllPast && (
                  <div className="flex justify-center pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAllPast(true)}>
                      Show all {past.length} past lessons
                    </Button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
