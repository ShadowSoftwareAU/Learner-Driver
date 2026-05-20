import { useState } from "react";
import {
  useGetMyAvailability,
  useCreateAvailabilitySlot,
  useDeleteAvailabilitySlot,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Calendar } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DAY_NAMES } from "@/lib/enums";

const TRANSMISSION_OPTIONS = ["auto", "manual"] as const;

export default function InstructorAvailability() {
  const { toast } = useToast();
  const qc = useQueryClient();

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
  });

  const grouped = Array.from({ length: 7 }, (_, idx) => ({
    day: DAY_NAMES[idx],
    idx,
    slots: (slots ?? []).filter((s: any) => s.dayOfWeek === idx),
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
    try {
      await createSlot.mutateAsync({
        data: {
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime,
          endTime: form.endTime,
          transmissionTypes: form.transmissionTypes,
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/availability/me"] });
      toast({ title: "Availability slot added" });
    } catch {
      toast({ title: "Failed to add slot", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSlot.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: ["/api/availability/me"] });
      toast({ title: "Slot removed" });
    } catch {
      toast({ title: "Failed to remove slot", variant: "destructive" });
    }
  };

  const hasSlots = grouped.some((g) => g.slots.length > 0);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Availability</h1>
          <p className="text-muted-foreground">
            Set your weekly teaching schedule so students can find and book you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" /> Add Time Slot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                {TRANSMISSION_OPTIONS.map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.transmissionTypes.includes(type)}
                      onChange={() => toggleTransmission(type)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="capitalize text-sm">{type}matic</span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleAdd} disabled={createSlot.isPending}>
              {createSlot.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Slot
            </Button>
          </CardContent>
        </Card>

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
                      const types = Array.isArray(slot.transmissionTypes)
                        ? slot.transmissionTypes
                        : String(slot.transmissionTypes)
                            .split(",")
                            .map((t: string) => t.trim());
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {types.map((t: string) => (
                                <Badge key={t} variant="secondary" className="text-xs capitalize">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(slot.id)}
                            disabled={deleteSlot.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
