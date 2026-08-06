import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/clerk-react";
import {
  Loader2, Plus, Trash2, Pencil, Car, Star, StarOff,
  Camera, AlertCircle, ShieldCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: number | null;
  colour: string | null;
  rego: string | null;
  regoState: string | null;
  regoExpiry: string | null;
  transmissionType: "auto" | "manual";
  controlType: "dual_control" | "factory";
  isDualControl: boolean;
  isPrimary: boolean;
  status: "active" | "inactive";
  photoStorageKey: string | null;
  notes: string | null;
  vehicleType: string;
};

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  colour: string;
  rego: string;
  regoState: string;
  regoExpiry: string;
  transmissionType: "auto" | "manual";
  controlType: "dual_control" | "factory";
  isDualControl: boolean;
  isPrimary: boolean;
  status: "active" | "inactive";
  notes: string;
  photoStorageKey: string;
};

const emptyForm = (): VehicleForm => ({
  make: "",
  model: "",
  year: "",
  colour: "",
  rego: "",
  regoState: "QLD",
  regoExpiry: "",
  transmissionType: "auto",
  controlType: "dual_control",
  isDualControl: true,
  isPrimary: false,
  status: "active",
  notes: "",
  photoStorageKey: "",
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vehicleLabel(v: Vehicle) {
  return [v.year, v.make, v.model].filter(Boolean).join(" ");
}

function regoExpiryStatus(regoExpiry: string | null): "ok" | "expiring" | "expired" | null {
  if (!regoExpiry) return null;
  const expiry = new Date(regoExpiry);
  const now = new Date();
  const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff < 60) return "expiring";
  return "ok";
}

function VehiclePhoto({ storageKey, label }: { storageKey: string | null; label: string }) {
  if (!storageKey) {
    return (
      <div className="w-full h-40 bg-muted rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Car className="w-10 h-10 opacity-40" />
        <span className="text-xs">No photo</span>
      </div>
    );
  }
  return (
    <img
      src={`${BASE}/api/storage/objects/${storageKey}`}
      alt={label}
      className="w-full h-40 object-cover rounded-lg bg-muted"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

function usePhotoUpload() {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const token = await getToken();
      // 1. Request presigned URL
      const urlRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // 2. PUT directly to presigned URL
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");

      return objectPath as string;
    } finally {
      setUploading(false);
    }
  };

  return { uploadPhoto, uploading };
}

// ─── Add / Edit dialog ────────────────────────────────────────────────────────

function VehicleDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: VehicleForm;
  onSave: (form: VehicleForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<VehicleForm>(initial);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { uploadPhoto, uploading } = usePhotoUpload();
  const { toast } = useToast();

  // Sync form when dialog opens with new initial value
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setForm(initial);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPrevInitial(initial);
  }

  const set = (key: keyof VehicleForm, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim()) {
      toast({ title: "Make and model are required", variant: "destructive" });
      return;
    }
    let finalForm = { ...form };
    if (photoFile) {
      const key = await uploadPhoto(photoFile);
      if (!key) { toast({ title: "Photo upload failed", variant: "destructive" }); return; }
      finalForm = { ...finalForm, photoStorageKey: key };
    }
    onSave(finalForm);
  };

  const busy = saving || uploading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.make ? `Edit ${initial.make} ${initial.model}` : "Add Vehicle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Photo */}
          <div className="space-y-2">
            <Label>Vehicle Photo</Label>
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-44 object-cover rounded-lg" />
            ) : form.photoStorageKey ? (
              <img
                src={`${BASE}/api/storage/objects/${form.photoStorageKey}`}
                alt="Current"
                className="w-full h-44 object-cover rounded-lg bg-muted"
              />
            ) : (
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                <Camera className="w-8 h-8 opacity-40" />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <Button type="button" variant="outline" size="sm" asChild>
                <span><Camera className="w-4 h-4 mr-1.5" /> {form.photoStorageKey ? "Change photo" : "Add photo"}</span>
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          {/* Make / Model / Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Make <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Toyota" value={form.make} onChange={e => set("make", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Model <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Corolla" value={form.model} onChange={e => set("model", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" placeholder="e.g. 2022" value={form.year} onChange={e => set("year", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Input placeholder="e.g. Silver" value={form.colour} onChange={e => set("colour", e.target.value)} />
            </div>
          </div>

          {/* Transmission & Control type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Transmission</Label>
              <div className="flex gap-2">
                {(["auto", "manual"] as const).map(v => (
                  <button key={v} type="button"
                    onClick={() => set("transmissionType", v)}
                    className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors capitalize ${form.transmissionType === v ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:border-muted-foreground"}`}
                  >
                    {v === "auto" ? "Automatic" : "Manual"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Controls</Label>
              <div className="flex gap-2">
                {([
                  { value: "dual_control", label: "Dual" },
                  { value: "factory", label: "Factory" },
                ] as const).map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => set("controlType", value)}
                    className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors ${form.controlType === value ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:border-muted-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rego */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Rego Plate</Label>
              <Input placeholder="e.g. ABC123" value={form.rego} onChange={e => set("rego", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.regoState}
                onChange={e => set("regoState", e.target.value)}
              >
                {["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Registration Expiry</Label>
            <Input type="date" value={form.regoExpiry} onChange={e => set("regoExpiry", e.target.value)} />
          </div>

          {/* Flags */}
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.isPrimary} onChange={e => set("isPrimary", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Primary vehicle
            </label>
            <div className="space-y-1.5 w-full">
              <Label>Status</Label>
              <div className="flex gap-2">
                {(["active", "inactive"] as const).map(v => (
                  <button key={v} type="button"
                    onClick={() => set("status", v)}
                    className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors capitalize ${form.status === v ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:border-muted-foreground"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Any notes about this vehicle…" value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Vehicle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InstructorVehicles() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { getToken } = useAuth();

  const qk = ["/api/instructor/my-vehicles"];

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: qk,
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/instructor/my-vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load vehicles");
      return res.json();
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  const formFromVehicle = (v: Vehicle): VehicleForm => ({
    make: v.make,
    model: v.model,
    year: v.year ? String(v.year) : "",
    colour: v.colour ?? "",
    rego: v.rego ?? "",
    regoState: v.regoState ?? "QLD",
    regoExpiry: v.regoExpiry ?? "",
    transmissionType: v.transmissionType ?? "auto",
    controlType: v.controlType ?? "dual_control",
    isDualControl: v.isDualControl,
    isPrimary: v.isPrimary,
    status: v.status,
    notes: v.notes ?? "",
    photoStorageKey: v.photoStorageKey ?? "",
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, form }: { id: number | null; form: VehicleForm }) => {
      const token = await getToken();
      const body = {
        make: form.make.trim(),
        model: form.model.trim(),
        ...(form.year ? { year: parseInt(form.year, 10) } : {}),
        ...(form.colour ? { colour: form.colour.trim() } : {}),
        ...(form.rego ? { rego: form.rego.trim() } : {}),
        regoState: form.regoState,
        ...(form.regoExpiry ? { regoExpiry: form.regoExpiry } : {}),
        transmissionType: form.transmissionType,
        controlType: form.controlType,
        isDualControl: form.controlType === "dual_control",
        isPrimary: form.isPrimary,
        status: form.status,
        ...(form.notes ? { notes: form.notes.trim() } : {}),
        ...(form.photoStorageKey ? { photoStorageKey: form.photoStorageKey } : {}),
      };
      const url = id
        ? `${BASE}/api/instructor/my-vehicles/${id}`
        : `${BASE}/api/instructor/my-vehicles`;
      const res = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save vehicle");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setDialogOpen(false);
      setEditingVehicle(null);
      toast({ title: editingVehicle ? "Vehicle updated" : "Vehicle added" });
    },
    onError: () => toast({ title: "Failed to save vehicle", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/instructor/my-vehicles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete vehicle");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setDeleteTarget(null);
      toast({ title: "Vehicle removed" });
    },
    onError: () => toast({ title: "Failed to remove vehicle", variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingVehicle(null);
    setDialogOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setDialogOpen(true);
  };

  const handleSave = (form: VehicleForm) => {
    saveMutation.mutate({ id: editingVehicle?.id ?? null, form });
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Vehicles</h1>
            <p className="text-muted-foreground mt-1">
              Manage the vehicles available for your lessons. Students will see these when booking.
            </p>
          </div>
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>

        {/* Empty state */}
        {!isLoading && vehicles.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Car className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground font-medium">No vehicles yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first vehicle so students can see it when they book a lesson.</p>
            <Button onClick={openAdd} className="mt-4 gap-1.5" variant="outline">
              <Plus className="w-4 h-4" /> Add your first vehicle
            </Button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Vehicle grid */}
        {!isLoading && vehicles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => {
              const expiryStatus = regoExpiryStatus(v.regoExpiry);
              return (
                <Card key={v.id} className={v.status === "inactive" ? "opacity-60" : ""}>
                  <CardContent className="p-0">
                    {/* Photo */}
                    <div className="relative">
                      <VehiclePhoto storageKey={v.photoStorageKey} label={vehicleLabel(v)} />
                      {/* Badges on photo */}
                      <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                        {v.isPrimary && (
                          <Badge className="text-xs gap-1 bg-amber-500 text-white border-0">
                            <Star className="w-3 h-3" /> Primary
                          </Badge>
                        )}
                        {v.status === "inactive" && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Name */}
                      <div>
                        <h3 className="font-semibold text-base leading-tight">{vehicleLabel(v)}</h3>
                        {v.colour && <p className="text-sm text-muted-foreground">{v.colour}</p>}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-xs capitalize">
                          {v.transmissionType === "auto" ? "Automatic" : "Manual"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${v.controlType === "dual_control" ? "text-green-700 border-green-200 bg-green-50" : "text-muted-foreground"}`}
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          {v.controlType === "dual_control" ? "Dual controls" : "Factory"}
                        </Badge>
                      </div>

                      {/* Rego */}
                      {v.rego && (
                        <div className="text-sm">
                          <span className="font-mono font-semibold">{v.rego}</span>
                          {v.regoState && <span className="text-muted-foreground ml-1">({v.regoState})</span>}
                          {v.regoExpiry && (
                            <span className={`ml-2 text-xs ${expiryStatus === "expired" ? "text-destructive font-medium" : expiryStatus === "expiring" ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                              {expiryStatus === "expired" ? "⚠ Rego expired" : expiryStatus === "expiring" ? "⚠ Expires soon" : `Rego expires ${v.regoExpiry}`}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(v)} className="flex-1 gap-1.5">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setDeleteTarget(v)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info banner */}
        {!isLoading && vehicles.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Linking vehicles to availability</p>
              <p className="mt-0.5 text-blue-700">Go to the <strong>Availability</strong> page to select which vehicles are available for each time slot. Students will see and choose from those vehicles when booking.</p>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <VehicleDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingVehicle(null); }}
        initial={editingVehicle ? formFromVehicle(editingVehicle) : emptyForm()}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget ? vehicleLabel(deleteTarget) : "vehicle"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the vehicle from your fleet. Any existing bookings that referenced this vehicle will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
