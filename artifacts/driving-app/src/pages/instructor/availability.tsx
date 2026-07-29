import { useState, useEffect } from "react";
import {
  useGetMyAvailability,
  useGetMyAvailabilityContexts,
  useGetInstructorProfile,
  useUpdateInstructor,
  useCreateAvailabilitySlot,
  useDeleteAvailabilitySlot,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Trash2, Calendar, DollarSign, Save,
  User, Building2, AlertCircle, ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DAY_NAMES } from "@/lib/enums";

const TRANSMISSION_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

// ── Context helpers ───────────────────────────────────────────────────────────

function contextKey(type: string, schoolAdminId?: number | null): string {
  return type === "school" && schoolAdminId ? `school:${schoolAdminId}` : "independent";
}

function parseContextKey(val: string): { contextType: "independent" | "school"; schoolAdminId?: number } {
  if (val.startsWith("school:")) {
    const id = parseInt(val.slice(7), 10);
    if (!isNaN(id)) return { contextType: "school", schoolAdminId: id };
  }
  return { contextType: "independent" };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InstructorAvailability() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Hourly rate ────────────────────────────────────────────────────────────
  const profileQK = ["/api/instructor/profile"];
  const { data: profile } = useGetInstructorProfile({ query: { queryKey: profileQK } });
  const updateInstructor = useUpdateInstructor();
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    const cents = (profile as any)?.hourlyRateCents;
    if (cents != null) setRateInput(String(Math.round(cents / 100)));
  }, [(profile as any)?.hourlyRateCents]);

  const handleSaveRate = async () => {
    const id = (profile as any)?.id;
    if (!id) return;
    const dollars = parseFloat(rateInput);
    if (isNaN(dollars) || dollars <= 0) {
      toast({ title: "Enter a valid hourly rate", variant: "destructive" });
      return;
    }
    setSavingRate(true);
    try {
      await updateInstructor.mutateAsync({ id, data: { hourlyRateCents: Math.round(dollars * 100) } as any });
      qc.invalidateQueries({ queryKey: profileQK });
      toast({ title: "Rate saved", description: `$${dollars.toFixed(0)}/hr` });
    } catch {
      toast({ title: "Failed to save rate", variant: "destructive" });
    } finally {
      setSavingRate(false);
    }
  };

  // ── Contexts ───────────────────────────────────────────────────────────────
  const contextsQK = ["/api/availability/my-contexts"];
  const { data: contexts, isLoading: contextsLoading } = useGetMyAvailabilityContexts({
    query: { queryKey: contextsQK },
  });
  const contextList = (contexts ?? []) as Array<{ type: string; label: string; schoolAdminId?: number | null }>;

  // ── Availability slots ─────────────────────────────────────────────────────
  const { data: slots, isLoading } = useGetMyAvailability({
    query: { queryKey: ["/api/availability/me"] },
  });

  const createSlot = useCreateAvailabilitySlot();
  const deleteSlot = useDeleteAvailabilitySlot();

  const [form, setForm] = useState({
    dayOfWeek: "1",
    startTime: "09:00",
    endTime: "17:00",
    transmissionTypes: ["auto", "manual"] as string[],
    contextValue: "independent",
  });

  // Auto-select first context when contexts load
  useEffect(() => {
    if (contextList.length > 0) {
      const first = contextList[0];
      setForm((f) => ({
        ...f,
        contextValue: contextKey(first.type, first.schoolAdminId),
      }));
    }
  }, [contextList.length]);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const grouped = Array.from({ length: 7 }, (_, idx) => ({
    day: DAY_NAMES[idx],
    idx,
    slots: ((slots ?? []) as any[])
      .filter((s) => s.dayOfWeek === idx)
      .sort((a: any, b: any) => String(a.startTime).localeCompare(String(b.startTime))),
  }));

  const toggleTransmission = (type: string) => {
    setForm((f) => ({
      ...f,
      transmissionTypes: f.transmissionTypes.includes(type)
        ? f.transmissionTypes.filter((t) => t !== type)
        : [...f.transmissionTypes, type],
    }));
  };

  const handleAdd = async () => {
    if (!form.transmissionTypes.length) {
      toast({ title: "Select at least one transmission type", variant: "destructive" });
      return;
    }
    if (form.endTime <= form.startTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }
    if (!form.contextValue) {
      toast({ title: "Select who you are driving for", variant: "destructive" });
      return;
    }

    const { contextType, schoolAdminId } = parseContextKey(form.contextValue);
    const contextLabel = contextList.find((c) =>
      contextKey(c.type, c.schoolAdminId) === form.contextValue,
    )?.label ?? contextType;

    try {
      await createSlot.mutateAsync({
        data: {
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime,
          endTime: form.endTime,
          transmissionTypes: form.transmissionTypes,
          contextType,
          ...(schoolAdminId !== undefined ? { schoolAdminId } : {}),
        } as any,
      });
      await qc.invalidateQueries({ queryKey: ["/api/availability/me"] });
      toast({
        title: "Availability slot added",
        description: `${DAY_NAMES[Number(form.dayOfWeek)]} ${form.startTime}–${form.endTime} · ${contextLabel}`,
      });
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const serverMsg = err?.body?.error ?? err?.response?.data?.error;
      if (status === 409) {
        toast({ title: "Time conflict", description: serverMsg ?? "This slot overlaps an existing one.", variant: "destructive" });
      } else {
        toast({ title: "Failed to add slot", description: serverMsg ?? "Please try again.", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteSlot.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: ["/api/availability/me"] });
      toast({ title: "Slot removed" });
    } catch {
      toast({ title: "Failed to remove slot", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const hasSlots = grouped.some((g) => g.slots.length > 0);
  const hasNoContexts = !contextsLoading && contextList.length === 0;
  const multipleContexts = contextList.length > 1;

  // Resolve a context label from stored slot fields
  const resolveContextLabel = (slot: any): { label: string; isSchool: boolean } => {
    if (slot.contextType === "school") {
      const match = contextList.find(
        (c) => c.type === "school" && c.schoolAdminId === slot.schoolAdminId,
      );
      return { label: match?.label ?? "School", isSchool: true };
    }
    return { label: "Independent", isSchool: false };
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Availability</h1>
          <p className="text-muted-foreground">
            Set your weekly teaching schedule and hourly rate so students can find and book you.
          </p>
        </div>

        {/* Hourly rate card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4" /> Hourly Rate
            </CardTitle>
            <CardDescription>
              Shown to students when they browse your calendar. Prices are in Australian dollars.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 max-w-xs">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="rate-input">Rate (AUD per hour)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="rate-input"
                    type="number"
                    min={0}
                    step={5}
                    placeholder="e.g. 85"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <Button onClick={handleSaveRate} disabled={savingRate || !rateInput} className="gap-1.5">
                {savingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </div>
            {(profile as any)?.hourlyRateCents && (
              <p className="text-xs text-muted-foreground mt-2">
                Current: <span className="font-medium">${Math.round((profile as any).hourlyRateCents / 100)}/hr</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* No-context warning */}
        {hasNoContexts && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">No teaching contexts available</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your profile does not have an independent flag set, and you have no active school links.
                Contact your school admin or update your profile to add availability slots.
              </p>
            </div>
          </div>
        )}

        {/* Add Time Slot card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" /> Add Time Slot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* ── Driving For ──────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="context-select" className="flex items-center gap-1.5">
                Driving For
                <span className="text-destructive ml-0.5">*</span>
              </Label>

              {contextsLoading ? (
                <div className="flex items-center gap-2 h-9 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading contexts…
                </div>
              ) : contextList.length === 1 ? (
                // Single context — show as a read-only info badge, still sets the value
                <div className="flex items-center gap-2 h-9">
                  {contextList[0].type === "school" ? (
                    <Building2 className="w-4 h-4 text-amber-600" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">{contextList[0].label}</span>
                  <Badge
                    variant="outline"
                    className={
                      contextList[0].type === "school"
                        ? "text-xs text-amber-700 border-amber-200 bg-amber-50"
                        : "text-xs text-blue-700 border-blue-200 bg-blue-50"
                    }
                  >
                    {contextList[0].type === "school" ? "School" : "Independent"}
                  </Badge>
                </div>
              ) : contextList.length > 1 ? (
                // Multiple contexts — show a styled dropdown
                <div className="relative">
                  <select
                    id="context-select"
                    className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent pl-3 pr-8 py-1 text-sm shadow-sm appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.contextValue}
                    onChange={(e) => setForm((f) => ({ ...f, contextValue: e.target.value }))}
                  >
                    {contextList.map((ctx) => {
                      const val = contextKey(ctx.type, ctx.schoolAdminId);
                      return (
                        <option key={val} value={val}>
                          {ctx.type === "school" ? `🏫 ${ctx.label}` : `👤 ${ctx.label}`}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              ) : null}

              {multipleContexts && (
                <p className="text-xs text-muted-foreground">
                  Slots tagged as a school context are only visible to that school's bookings.
                </p>
              )}
            </div>

            {/* ── Day / times / transmission ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Day of Week</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                >
                  {DAY_NAMES.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Transmission Types</Label>
              <div className="flex gap-4">
                {TRANSMISSION_OPTIONS.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.transmissionTypes.includes(t.value)}
                      onChange={() => toggleTransmission(t.value)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={handleAdd}
              disabled={createSlot.isPending || hasNoContexts || contextsLoading}
            >
              {createSlot.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Slot
            </Button>
          </CardContent>
        </Card>

        {/* ── Existing slots ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !hasSlots ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No availability slots yet.</p>
            <p className="text-sm text-muted-foreground">Add your first slot above to appear in student searches.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grouped
              .filter((g) => g.slots.length > 0)
              .map(({ day, slots }) => (
                <Card key={day}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {day}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {slots.map((slot: any) => {
                      const types: string[] = Array.isArray(slot.transmissionTypes)
                        ? slot.transmissionTypes
                        : String(slot.transmissionTypes)
                            .split(",")
                            .map((t: string) => t.trim())
                            .filter(Boolean);
                      const labelFor = (v: string) =>
                        TRANSMISSION_OPTIONS.find((o) => o.value === v)?.label ?? v;
                      const { label: ctxLabel, isSchool } = resolveContextLabel(slot);

                      return (
                        <div
                          key={slot.id}
                          className="rounded-md border px-3 py-2 text-sm space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(slot.id)}
                              disabled={deletingId === slot.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-auto -mr-1"
                            >
                              {deletingId === slot.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {types.map((t: string) => (
                              <Badge key={t} variant="secondary" className="text-xs">
                                {labelFor(t)}
                              </Badge>
                            ))}
                            {/* Context badge — only show when there are multiple contexts or it's a school slot */}
                            {(multipleContexts || isSchool) && (
                              <Badge
                                variant="outline"
                                className={`text-xs flex items-center gap-1 ${
                                  isSchool
                                    ? "text-amber-700 border-amber-200 bg-amber-50"
                                    : "text-blue-700 border-blue-200 bg-blue-50"
                                }`}
                              >
                                {isSchool ? (
                                  <Building2 className="w-2.5 h-2.5" />
                                ) : (
                                  <User className="w-2.5 h-2.5" />
                                )}
                                {ctxLabel}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
