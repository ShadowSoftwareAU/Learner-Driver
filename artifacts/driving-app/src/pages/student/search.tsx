import { useState } from "react";
import {
  useSearchInstructors,
  useCreateBooking,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, User, MapPin, Car, Clock, Bike, Truck, GraduationCap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DAY_NAMES } from "@/lib/enums";

// ─── Training category config ─────────────────────────────────────────────────

const TRAINING_CATEGORIES = [
  { value: "car_learner", label: "Car — Learner", Icon: Car, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "car_probationary", label: "Car — Provisional", Icon: Car, color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "q_ride_re", label: "Q-RIDE RE (Learner Rider)", Icon: Bike, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "q_ride_r", label: "Q-RIDE R (Unrestricted Rider)", Icon: Bike, color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "q_ride_re_to_r", label: "Q-RIDE RE→R Progression", Icon: Bike, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "mr", label: "MR — Medium Rigid Truck", Icon: Truck, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "hr", label: "HR — Heavy Rigid Truck", Icon: Truck, color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "hc", label: "HC — Heavy Combination", Icon: Truck, color: "bg-red-100 text-red-700 border-red-200" },
  { value: "mc", label: "MC — Multi-Combination", Icon: Truck, color: "bg-rose-100 text-rose-700 border-rose-200" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchParams = {
  date: string;
  time: string;
  transmissionType: "auto" | "manual" | "either" | "";
  suburb: string;
  postcode: string;
  durationMinutes: string;
};

export default function StudentSearch() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [params, setParams] = useState<SearchParams>({
    date: "",
    time: "",
    transmissionType: "",
    suburb: "",
    postcode: "",
    durationMinutes: "60",
  });

  const [submitted, setSubmitted] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [carType, setCarType] = useState<"trainer_car" | "learner_car">("trainer_car");
  const [trainingCategory, setTrainingCategory] = useState("car_learner");
  const [dialogOpen, setDialogOpen] = useState(false);

  const searchEnabled = submitted && !!params.date && !!params.time;

  const { data: instructors, isLoading, refetch } = useSearchInstructors(
    {
      date: params.date,
      time: params.time,
      ...(params.transmissionType ? { transmissionType: params.transmissionType as any } : {}),
      ...(params.suburb ? { suburb: params.suburb } : {}),
      ...(params.postcode ? { postcode: params.postcode } : {}),
      ...(params.durationMinutes ? { durationMinutes: Number(params.durationMinutes) } : {}),
    },
    {
      query: {
        queryKey: ["/api/bookings/search", params],
        enabled: searchEnabled,
      },
    }
  );

  const createBooking = useCreateBooking();

  const handleSearch = () => {
    if (!params.date || !params.time) {
      toast({ title: "Please select a date and time", variant: "destructive" });
      return;
    }
    setSubmitted(true);
    refetch();
  };

  const handleBook = (instructor: any) => {
    setSelectedInstructor(instructor);
    setBookingNotes("");
    setCarType("trainer_car");
    setTrainingCategory("car_learner");
    setDialogOpen(true);
  };

  const handleConfirmBooking = async () => {
    try {
      await createBooking.mutateAsync({
        data: {
          requestedDate: params.date,
          requestedTime: params.time,
          durationMinutes: Number(params.durationMinutes) || 60,
          ...(params.transmissionType ? { transmissionType: params.transmissionType as any } : {}),
          suburb: params.suburb || selectedInstructor?.zones?.[0]?.suburb || "",
          postcode: params.postcode || selectedInstructor?.zones?.[0]?.postcode || "",
          carType: carType as any,
          trainingCategory: trainingCategory as any,
          ...(bookingNotes ? { studentNotes: bookingNotes } : {}),
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      setDialogOpen(false);
      toast({
        title: "Booking request sent!",
        description: "Your request has been broadcast to available instructors.",
      });
    } catch {
      toast({ title: "Failed to create booking request", variant: "destructive" });
    }
  };

  const selectedCategoryConfig = TRAINING_CATEGORIES.find(c => c.value === trainingCategory) ?? TRAINING_CATEGORIES[0];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Find an Instructor</h1>
          <p className="text-muted-foreground">Search for available instructors matching your preferred time and area.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="w-4 h-4" /> Search Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Preferred Date *</Label>
                <Input
                  type="date"
                  value={params.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setParams((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Time *</Label>
                <Input
                  type="time"
                  value={params.time}
                  onChange={(e) => setParams((p) => ({ ...p, time: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={params.durationMinutes}
                  onChange={(e) => setParams((p) => ({ ...p, durationMinutes: e.target.value }))}
                >
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Transmission</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={params.transmissionType}
                  onChange={(e) => setParams((p) => ({ ...p, transmissionType: e.target.value as any }))}
                >
                  <option value="">Any</option>
                  <option value="auto">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Suburb</Label>
                <Input
                  placeholder="e.g. Chermside"
                  value={params.suburb}
                  onChange={(e) => setParams((p) => ({ ...p, suburb: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input
                  placeholder="e.g. 4032"
                  maxLength={4}
                  value={params.postcode}
                  onChange={(e) => setParams((p) => ({ ...p, postcode: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={handleSearch} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search Instructors
            </Button>
          </CardContent>
        </Card>

        {searchEnabled && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !instructors || instructors.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No instructors found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your date, time, or area. You can still submit a broadcast request below.
                </p>
                <Button className="mt-4" onClick={() => handleBook(null)}>
                  Broadcast Request to All Instructors
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {instructors.length} instructor{instructors.length !== 1 ? "s" : ""} available
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {instructors.map((instructor: any) => (
                    <Card key={instructor.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-lg">{instructor.fullName}</p>
                            {instructor.qualifications && (
                              <p className="text-sm text-muted-foreground">{instructor.qualifications}</p>
                            )}
                          </div>
                          <div className="rounded-full bg-primary/10 p-2">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                        </div>

                        {instructor.vehicleMake && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Car className="w-3.5 h-3.5" />
                            {[instructor.vehicleYear, instructor.vehicleMake, instructor.vehicleModel]
                              .filter(Boolean)
                              .join(" ")}
                          </div>
                        )}

                        {instructor.zones && instructor.zones.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Teaching zones:</span>
                            </div>
                            <div className="flex flex-wrap gap-1 pl-5">
                              {instructor.zones.slice(0, 5).map((z: any) => (
                                <Badge key={z.postcode} variant="secondary" className="text-xs">
                                  {z.suburb} {z.postcode}
                                </Badge>
                              ))}
                              {instructor.zones.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{instructor.zones.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {instructor.availabilitySlots && instructor.availabilitySlots.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Available:</span>
                            </div>
                            <div className="flex flex-wrap gap-1 pl-5">
                              {instructor.availabilitySlots.slice(0, 4).map((slot: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {slot.dayName ?? DAY_NAMES[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button className="w-full" onClick={() => handleBook(instructor)}>
                          Request Lesson
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedInstructor ? `Request lesson with ${selectedInstructor.fullName}` : "Broadcast Lesson Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
              <p>
                <strong>Date:</strong>{" "}
                {params.date ? new Date(params.date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
              </p>
              <p><strong>Time:</strong> {params.time || "—"}</p>
              <p><strong>Duration:</strong> {params.durationMinutes} minutes</p>
              {params.transmissionType && (
                <p className="capitalize"><strong>Transmission:</strong> {params.transmissionType === "auto" ? "Automatic" : params.transmissionType === "manual" ? "Manual" : params.transmissionType}</p>
              )}
              {(params.suburb || params.postcode) && (
                <p><strong>Area:</strong> {[params.suburb, params.postcode].filter(Boolean).join(", ")}</p>
              )}
            </div>

            {!selectedInstructor && (
              <p className="text-sm text-muted-foreground">
                No instructors matched your search. Your request will be broadcast to all instructors in the system — the first to respond wins the booking.
              </p>
            )}

            {/* Training category */}
            <div className="space-y-2">
              <Label>Licence class / training category *</Label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {TRAINING_CATEGORIES.map(cat => {
                  const Icon = cat.Icon;
                  const isSelected = trainingCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setTrainingCategory(cat.value)}
                      className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 font-semibold text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: <span className={`font-medium px-1.5 py-0.5 rounded ${selectedCategoryConfig.color}`}>{selectedCategoryConfig.label}</span>
              </p>
            </div>

            {/* Vehicle */}
            <div className="space-y-2">
              <Label>Vehicle for this lesson</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCarType("trainer_car")}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${carType === "trainer_car" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                >
                  <Car className="w-6 h-6" />
                  Trainer's Car
                </button>
                <button
                  type="button"
                  onClick={() => setCarType("learner_car")}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${carType === "learner_car" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                >
                  <GraduationCap className="w-6 h-6" />
                  Learner's Car
                </button>
              </div>
              {carType === "learner_car" && (
                <p className="text-xs text-muted-foreground">Your instructor will be notified that you're bringing your own vehicle.</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes for instructor (optional)</Label>
              <Textarea
                placeholder="Any special requirements, pick-up location, learning goals..."
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBooking} disabled={createBooking.isPending}>
              {createBooking.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
