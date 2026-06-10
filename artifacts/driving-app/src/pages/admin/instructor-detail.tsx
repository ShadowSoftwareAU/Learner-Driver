import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetInstructor,
  useListInstructorVehicles,
  useAddInstructorVehicle,
  useUpdateInstructorVehicle,
  useDeleteInstructorVehicle,
  useUpdateInstructorTrainingCategories,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, ArrowLeft, Car, Star, Users, ClipboardList, Bike, Truck, Shield,
  Plus, Pencil, Trash2, CheckCircle2, ThumbsUp, Phone, Mail, BadgeCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// ─── Training category config ─────────────────────────────────────────────────

const TRAINING_CATEGORIES = [
  { value: "car_learner", label: "Car — Learner", icon: Car, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "car_probationary", label: "Car — Provisional", icon: Car, color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "q_ride_re", label: "Q-RIDE RE (Learner Rider)", icon: Bike, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "q_ride_r", label: "Q-RIDE R (Unrestricted Rider)", icon: Bike, color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "q_ride_re_to_r", label: "Q-RIDE RE→R Progression", icon: Bike, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "mr", label: "MR — Medium Rigid", icon: Truck, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "hr", label: "HR — Heavy Rigid", icon: Truck, color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "hc", label: "HC — Heavy Combination", icon: Truck, color: "bg-red-100 text-red-700 border-red-200" },
  { value: "mc", label: "MC — Multi-Combination", icon: Truck, color: "bg-rose-100 text-rose-700 border-rose-200" },
];

const VEHICLE_TYPE_LABELS: Record<string, { label: string; Icon: any }> = {
  car: { label: "Car", Icon: Car },
  motorbike: { label: "Motorbike", Icon: Bike },
  mr_truck: { label: "MR Truck", Icon: Truck },
  hr_truck: { label: "HR Truck", Icon: Truck },
  hc_truck: { label: "HC Truck", Icon: Truck },
  mc_truck: { label: "MC Truck", Icon: Truck },
};

const AUS_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

// ─── Vehicle form modal ───────────────────────────────────────────────────────

interface VehicleFormData {
  vehicleType: string;
  make: string;
  model: string;
  year: string;
  colour: string;
  rego: string;
  regoState: string;
  regoExpiry: string;
  isDualControl: boolean;
  isOwnerOperator: boolean;
  isPrimary: boolean;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceType: string;
  insuranceExpiry: string;
  status: string;
  notes: string;
}

const emptyVehicleForm = (): VehicleFormData => ({
  vehicleType: "car", make: "", model: "", year: "", colour: "",
  rego: "", regoState: "QLD", regoExpiry: "",
  isDualControl: false, isOwnerOperator: true, isPrimary: false,
  insuranceProvider: "", insurancePolicyNumber: "", insuranceType: "comprehensive",
  insuranceExpiry: "", status: "active", notes: "",
});

function vehicleToForm(v: any): VehicleFormData {
  return {
    vehicleType: v.vehicleType ?? "car",
    make: v.make ?? "", model: v.model ?? "",
    year: v.year ? String(v.year) : "",
    colour: v.colour ?? "", rego: v.rego ?? "",
    regoState: v.regoState ?? "QLD", regoExpiry: v.regoExpiry ?? "",
    isDualControl: v.isDualControl ?? false,
    isOwnerOperator: v.isOwnerOperator ?? true,
    isPrimary: v.isPrimary ?? false,
    insuranceProvider: v.insuranceProvider ?? "",
    insurancePolicyNumber: v.insurancePolicyNumber ?? "",
    insuranceType: v.insuranceType ?? "comprehensive",
    insuranceExpiry: v.insuranceExpiry ?? "",
    status: v.status ?? "active",
    notes: v.notes ?? "",
  };
}

function formToPayload(f: VehicleFormData) {
  return {
    vehicleType: f.vehicleType as any,
    make: f.make, model: f.model,
    year: f.year ? parseInt(f.year) : undefined,
    colour: f.colour || undefined,
    rego: f.rego || undefined, regoState: f.regoState || undefined,
    regoExpiry: f.regoExpiry || undefined,
    isDualControl: f.isDualControl, isOwnerOperator: f.isOwnerOperator,
    isPrimary: f.isPrimary,
    insuranceProvider: f.insuranceProvider || undefined,
    insurancePolicyNumber: f.insurancePolicyNumber || undefined,
    insuranceType: f.insuranceType || undefined,
    insuranceExpiry: f.insuranceExpiry || undefined,
    status: f.status as any,
    notes: f.notes || undefined,
  };
}

function VehicleModal({
  instructorId, vehicle, open, onClose,
}: { instructorId: number; vehicle?: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const VQK = ["/api/instructors", instructorId, "vehicles"];
  const IQK = ["/api/instructors", instructorId];

  const [form, setForm] = useState<VehicleFormData>(vehicle ? vehicleToForm(vehicle) : emptyVehicleForm());
  const set = (k: keyof VehicleFormData, v: any) => setForm(p => ({ ...p, [k]: v }));

  const { mutate: add, isPending: adding } = useAddInstructorVehicle({
    mutation: {
      onSuccess: () => { toast({ title: "Vehicle added" }); qc.invalidateQueries({ queryKey: VQK }); qc.invalidateQueries({ queryKey: IQK }); onClose(); },
      onError: () => toast({ title: "Failed to add vehicle", variant: "destructive" }),
    },
  });

  const { mutate: update, isPending: updating } = useUpdateInstructorVehicle({
    mutation: {
      onSuccess: () => { toast({ title: "Vehicle updated" }); qc.invalidateQueries({ queryKey: VQK }); qc.invalidateQueries({ queryKey: IQK }); onClose(); },
      onError: () => toast({ title: "Failed to update vehicle", variant: "destructive" }),
    },
  });

  const isPending = adding || updating;

  function handleSave() {
    if (!form.make || !form.model) { toast({ title: "Make and model are required", variant: "destructive" }); return; }
    const data = formToPayload(form);
    if (vehicle) update({ id: instructorId, vehicleId: vehicle.id, data });
    else add({ id: instructorId, data });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[2000]">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vehicle type</Label>
              <Select value={form.vehicleType} onValueChange={v => set("vehicleType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Make / Model / Year */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label>Make *</Label>
              <Input value={form.make} onChange={e => set("make", e.target.value)} placeholder="Toyota" />
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label>Model *</Label>
              <Input value={form.model} onChange={e => set("model", e.target.value)} placeholder="Corolla" />
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={e => set("year", e.target.value)} placeholder="2020" />
            </div>
          </div>

          {/* Colour / Rego / State */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Input value={form.colour} onChange={e => set("colour", e.target.value)} placeholder="White" />
            </div>
            <div className="space-y-1.5">
              <Label>Registration</Label>
              <Input value={form.rego} onChange={e => set("rego", e.target.value.toUpperCase())} placeholder="ABC123" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Rego state</Label>
              <Select value={form.regoState} onValueChange={v => set("regoState", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUS_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rego expiry</Label>
            <Input type="date" value={form.regoExpiry} onChange={e => set("regoExpiry", e.target.value)} />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-3">
            {([
              ["isDualControl", "Dual control pedals"],
              ["isOwnerOperator", "Owner-operated"],
              ["isPrimary", "Primary vehicle"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-3">
                <Label className="text-xs">{label}</Label>
                <Switch checked={form[key] as boolean} onCheckedChange={v => set(key, v)} />
              </div>
            ))}
          </div>

          {/* Insurance */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Insurance
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Input value={form.insuranceProvider} onChange={e => set("insuranceProvider", e.target.value)} placeholder="NRMA / RACQ…" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.insuranceType} onValueChange={v => set("insuranceType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprehensive">Comprehensive</SelectItem>
                    <SelectItem value="third_party">Third Party Property</SelectItem>
                    <SelectItem value="ctp">CTP Only</SelectItem>
                    <SelectItem value="fleet">Fleet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Policy number</Label>
                <Input value={form.insurancePolicyNumber} onChange={e => set("insurancePolicyNumber", e.target.value)} placeholder="POL-123456" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry</Label>
                <Input type="date" value={form.insuranceExpiry} onChange={e => set("insuranceExpiry", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="resize-none h-20" placeholder="Any relevant details about this vehicle…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            {vehicle ? "Save Changes" : "Add Vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InstructorDetail() {
  const [, params] = useRoute("/admin/instructors/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const instructorId = params?.id ? parseInt(params.id, 10) : 0;

  const IQK = ["/api/instructors", instructorId];
  const { data: instructor, isLoading } = useGetInstructor(instructorId, {
    query: { queryKey: IQK },
  });

  const [vehicleModal, setVehicleModal] = useState<{ open: boolean; vehicle?: any }>({ open: false });
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
  const [savingCategories, setSavingCategories] = useState(false);

  const categories: string[] = selectedCategories ?? (instructor as any)?.trainingCategories ?? [];

  const { mutate: deleteVehicle } = useDeleteInstructorVehicle({
    mutation: {
      onSuccess: () => { toast({ title: "Vehicle removed" }); qc.invalidateQueries({ queryKey: IQK }); },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    },
  });

  const { mutate: updateCategories } = useUpdateInstructorTrainingCategories({
    mutation: {
      onSuccess: () => { setSavingCategories(false); setSelectedCategories(null); toast({ title: "Qualifications saved" }); qc.invalidateQueries({ queryKey: IQK }); },
      onError: () => { setSavingCategories(false); toast({ title: "Failed to save", variant: "destructive" }); },
    },
  });

  function toggleCategory(cat: string) {
    const base = selectedCategories ?? ((instructor as any)?.trainingCategories ?? []);
    if (base.includes(cat)) setSelectedCategories(base.filter((c: string) => c !== cat));
    else setSelectedCategories([...base, cat]);
  }

  function handleSaveCategories() {
    setSavingCategories(true);
    updateCategories({ id: instructorId, data: { trainingCategories: categories } });
  }

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </SidebarLayout>
    );
  }

  if (!instructor) {
    return (
      <SidebarLayout>
        <div className="text-center py-16 text-muted-foreground">Instructor not found.</div>
      </SidebarLayout>
    );
  }

  const detail = instructor as any;
  const vehicles: any[] = detail.vehicles ?? [];
  const stats = detail.stats ?? {};

  return (
    <SidebarLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/instructors")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </div>

        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl shrink-0">
            {detail.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{detail.fullName}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {detail.email}</span>
              {detail.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {detail.phone}</span>}
              {detail.licenseNumber && <span className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5" /> Licence: {detail.licenseNumber}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Active Students", value: stats.activeStudents ?? 0, icon: Users },
            { label: "Total Sessions", value: stats.totalAssessments ?? 0, icon: ClipboardList },
            { label: "Completed", value: stats.completedAssessments ?? 0, icon: CheckCircle2 },
            { label: "Avg Rating", value: stats.avgOverall ? `${stats.avgOverall} ★` : "—", icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Icon className="w-5 h-5 text-primary/70 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold text-lg leading-tight">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Training qualifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Training Qualifications</CardTitle>
                <CardDescription>Licence classes this instructor is qualified to teach.</CardDescription>
              </div>
              {selectedCategories !== null && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedCategories(null)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveCategories} disabled={savingCategories}>
                    {savingCategories && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />} Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TRAINING_CATEGORIES.map(cat => {
                const active = categories.includes(cat.value);
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-all ${
                      active ? cat.color + " ring-2 ring-offset-1 ring-current" : "border-border text-muted-foreground bg-muted/30 hover:border-primary hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {cat.label}
                    {active && <CheckCircle2 className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No qualifications set. Click the categories above to add them.</p>
            )}
          </CardContent>
        </Card>

        {/* Vehicles */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Registered Vehicles</CardTitle>
                <CardDescription>Fleet vehicles used for training. Insurance details are stored for compliance.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setVehicleModal({ open: true })}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Vehicle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Car className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No vehicles registered. Add one to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v: any) => {
                  const vt = VEHICLE_TYPE_LABELS[v.vehicleType] ?? { label: v.vehicleType, Icon: Car };
                  const VIcon = vt.Icon;
                  return (
                    <div key={v.id} className={`rounded-xl border p-4 space-y-3 ${v.status === "inactive" ? "opacity-60 bg-muted/30" : "bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <VIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{v.year} {v.make} {v.model}</span>
                              {v.isPrimary && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Primary</Badge>}
                              {v.isDualControl && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Dual Control</Badge>}
                              {v.status === "inactive" && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                              {v.colour && <span>{v.colour}</span>}
                              {v.rego && <span className="font-mono">{v.rego} ({v.regoState})</span>}
                              {v.regoExpiry && <span>Rego exp. {v.regoExpiry}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVehicleModal({ open: true, vehicle: v })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                            if (confirm("Remove this vehicle?")) deleteVehicle({ id: instructorId, vehicleId: v.id });
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Insurance summary */}
                      {(v.insuranceProvider || v.insurancePolicyNumber || v.insuranceExpiry) && (
                        <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Insurance</span>
                          {v.insuranceProvider && <span>{v.insuranceProvider}</span>}
                          {v.insuranceType && <span className="capitalize">{v.insuranceType.replace("_", " ")}</span>}
                          {v.insurancePolicyNumber && <span className="font-mono">{v.insurancePolicyNumber}</span>}
                          {v.insuranceExpiry && <span>Exp. {v.insuranceExpiry}</span>}
                          {v.isOwnerOperator && <span>· Owner-operated</span>}
                        </div>
                      )}

                      {v.notes && <p className="text-xs text-muted-foreground italic">{v.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Qualifications / notes */}
        {detail.qualifications && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instructor Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.qualifications}</p>
            </CardContent>
          </Card>
        )}

        {/* Feedback summary */}
        {stats.totalFeedback > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Feedback Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{stats.avgOverall ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Avg rating</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{stats.recommendRate != null ? `${stats.recommendRate}%` : "—"}</p>
                <p className="text-xs text-muted-foreground">Would recommend</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.totalFeedback}</p>
                <p className="text-xs text-muted-foreground">Total reviews</p>
              </div>
            </CardContent>
          </Card>
        )}

        {vehicleModal.open && (
          <VehicleModal
            instructorId={instructorId}
            vehicle={vehicleModal.vehicle}
            open={vehicleModal.open}
            onClose={() => setVehicleModal({ open: false })}
          />
        )}
      </div>
    </SidebarLayout>
  );
}
