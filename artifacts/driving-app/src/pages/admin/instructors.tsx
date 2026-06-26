import { useState } from "react";
import { Link } from "wouter";
import { useListInstructors } from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Car, Bike, Truck, ChevronRight, Users, ShieldCheck, AlertTriangle, AlertCircle } from "lucide-react";

const TRAINING_CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "car_learner", label: "Car — Learner" },
  { value: "car_probationary", label: "Car — Provisional" },
  { value: "q_ride_re", label: "Q-RIDE RE" },
  { value: "q_ride_r", label: "Q-RIDE R" },
  { value: "q_ride_re_to_r", label: "Q-RIDE RE→R" },
  { value: "mr", label: "MR Truck" },
  { value: "hr", label: "HR Truck" },
  { value: "hc", label: "HC Truck" },
  { value: "mc", label: "MC Truck" },
];

const CAT_COLOURS: Record<string, string> = {
  car_learner: "bg-blue-100 text-blue-700",
  car_probationary: "bg-sky-100 text-sky-700",
  q_ride_re: "bg-purple-100 text-purple-700",
  q_ride_r: "bg-violet-100 text-violet-700",
  q_ride_re_to_r: "bg-indigo-100 text-indigo-700",
  mr: "bg-amber-100 text-amber-700",
  hr: "bg-orange-100 text-orange-700",
  hc: "bg-red-100 text-red-700",
  mc: "bg-rose-100 text-rose-700",
};

const CAT_SHORT: Record<string, string> = {
  car_learner: "Car L", car_probationary: "Car P",
  q_ride_re: "RE", q_ride_r: "R", q_ride_re_to_r: "RE→R",
  mr: "MR", hr: "HR", hc: "HC", mc: "MC",
};

function ComplianceBadge({ status }: { status?: string }) {
  if (status === "compliant") {
    return (
      <div className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <ShieldCheck className="w-3 h-3" />
        Compliant
      </div>
    );
  }
  if (status === "partial") {
    return (
      <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <AlertTriangle className="w-3 h-3" />
        Docs incomplete
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
      <AlertCircle className="w-3 h-3" />
      No docs
    </div>
  );
}

function VehicleTypeIcon({ type }: { type?: string | null }) {
  if (type === "motorbike") return <Bike className="w-3.5 h-3.5" />;
  if (type && type.includes("truck")) return <Truck className="w-3.5 h-3.5" />;
  return <Car className="w-3.5 h-3.5" />;
}

export default function AdminInstructors() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: instructors, isLoading } = useListInstructors(
    categoryFilter !== "all" ? { trainingCategory: categoryFilter } : {},
    { query: { queryKey: ["/api/instructors", categoryFilter] } }
  );

  const filtered = instructors?.filter(i =>
    i.fullName.toLowerCase().includes(search.toLowerCase()) ||
    i.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instructors</h1>
          <p className="text-muted-foreground">School instructor roster and qualifications.</p>
        </div>

        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                className="pl-9 bg-gray-50/50"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered && filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(instructor => {
                  const cats: string[] = (instructor as any).trainingCategories ?? [];
                  const pv = (instructor as any).primaryVehicle;
                  return (
                    <Link key={instructor.id} href={`/admin/instructors/${instructor.id}`}>
                      <div className="p-4 rounded-xl border border-border bg-white shadow-sm flex flex-col gap-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                            {instructor.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                {instructor.fullName}
                              </h3>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                            {instructor.phone && <p className="text-sm text-muted-foreground">{instructor.phone}</p>}
                            <div className="mt-1.5">
                              <ComplianceBadge status={(instructor as any).complianceStatus} />
                            </div>
                          </div>
                        </div>

                        {cats.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {cats.map(cat => (
                              <Badge key={cat} className={`text-xs border-0 ${CAT_COLOURS[cat] ?? "bg-gray-100 text-gray-700"}`}>
                                {CAT_SHORT[cat] ?? cat}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded-lg text-sm grid grid-cols-2 gap-2 mt-auto">
                          <div>
                            <span className="text-muted-foreground text-xs block mb-1">Primary vehicle</span>
                            <span className="font-medium flex items-center gap-1.5">
                              {pv ? (
                                <>
                                  <VehicleTypeIcon type={pv.vehicleType} />
                                  {pv.make} {pv.model}
                                  {pv.rego && <span className="text-xs text-muted-foreground font-mono">({pv.rego})</span>}
                                </>
                              ) : instructor.vehicleMake ? (
                                <>
                                  <Car className="w-3.5 h-3.5" />
                                  {instructor.vehicleMake} {instructor.vehicleModel ?? ""}
                                </>
                              ) : (
                                <span className="text-muted-foreground font-normal text-xs">Not registered</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs block mb-1">Active students</span>
                            <span className="font-medium flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              {instructor.activeStudents ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {categoryFilter !== "all"
                    ? "No instructors qualified for this training category."
                    : "No instructors found."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
