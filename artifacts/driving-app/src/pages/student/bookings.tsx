import {
  useListBookings,
  useUpdateBooking,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarX, Clock, Car, MapPin, User, GraduationCap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BookingStatus } from "@/lib/enums";
import { format } from "date-fns";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Awaiting Instructor", color: "bg-amber-100 text-amber-800 border-amber-200" },
  claimed: { label: "Instructor Claimed", color: "bg-blue-100 text-blue-800 border-blue-200" },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-800 border-green-200" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-700 border-gray-200" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-200" },
};

export default function StudentBookings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: bookings, isLoading } = useListBookings(undefined, {
    query: { queryKey: ["/api/bookings"] },
  });

  const updateBooking = useUpdateBooking();

  const handleCancel = async (id: number) => {
    try {
      await updateBooking.mutateAsync({ id, data: { status: BookingStatus.cancelled } });
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking cancelled." });
    } catch {
      toast({ title: "Failed to cancel booking.", variant: "destructive" });
    }
  };

  const upcomingStatuses = [BookingStatus.pending, BookingStatus.claimed, BookingStatus.confirmed];
  const pastStatuses = [BookingStatus.completed, BookingStatus.cancelled];

  const upcoming = (bookings ?? []).filter((b: any) => upcomingStatuses.includes(b.status));
  const past = (bookings ?? []).filter((b: any) => pastStatuses.includes(b.status));

  if (isLoading) {
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
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
            <p className="text-muted-foreground">Track the status of your lesson requests.</p>
          </div>
          <Link href="/student/search" className="sm:flex-shrink-0">
            <Button className="w-full sm:w-auto">Book a Lesson</Button>
          </Link>
        </div>

        {!bookings || bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-16 text-center">
            <CalendarX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">No bookings yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Search for an available instructor to book your first lesson.
            </p>
            <Link href="/student/search">
              <Button>Find an Instructor</Button>
            </Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Upcoming</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcoming.map((b: any) => {
                    const statusCfg = STATUS_CONFIG[b.status] ?? { label: b.status, color: "" };
                    return (
                      <Card key={b.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">
                                {format(new Date(b.requestedDate), "EEEE d MMMM yyyy")}
                              </p>
                              <p className="text-sm text-muted-foreground">at {b.requestedTime}</p>
                            </div>
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full border whitespace-nowrap ${statusCfg.color}`}
                            >
                              {statusCfg.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            {b.durationMinutes && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                {b.durationMinutes} min
                              </div>
                            )}
                            {b.transmissionType && (
                              <div className="flex items-center gap-1.5 text-muted-foreground capitalize">
                                <Car className="w-3.5 h-3.5" />
                                {b.transmissionType}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              {b.carType === "learner_car" ? (
                                <><GraduationCap className="w-3.5 h-3.5" /> Learner's car</>
                              ) : (
                                <><Car className="w-3.5 h-3.5" /> Trainer's car</>
                              )}
                            </div>
                            {(b.suburb || b.postcode) && (
                              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                                <MapPin className="w-3.5 h-3.5" />
                                {[b.suburb, b.postcode].filter(Boolean).join(", ")}
                              </div>
                            )}
                          </div>

                          {b.instructorName && (
                            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <span className="font-medium">{b.instructorName}</span>
                                {b.instructorPhone && (
                                  <span className="text-muted-foreground ml-2">{b.instructorPhone}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {b.status === BookingStatus.pending && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancel(b.id)}
                              disabled={updateBooking.isPending}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {updateBooking.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : null}
                              Cancel Request
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-muted-foreground">Past Lessons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {past.map((b: any) => {
                    const statusCfg = STATUS_CONFIG[b.status] ?? { label: b.status, color: "" };
                    return (
                      <Card key={b.id} className="opacity-75">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {format(new Date(b.requestedDate), "d MMM yyyy")} at {b.requestedTime}
                              </p>
                              {b.instructorName && (
                                <p className="text-sm text-muted-foreground">with {b.instructorName}</p>
                              )}
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
