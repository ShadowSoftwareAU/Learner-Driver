import { useMemo, useState } from "react";
import {
  useGetMyZones,
  useCreateZone,
  useDeleteZone,
} from "@workspace/api-client-react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, MapPin, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Zone {
  id: number;
  suburb: string;
  postcode: string;
  state: string;
}

export default function InstructorZones() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: zones, isLoading } = useGetMyZones({
    query: { queryKey: ["/api/zones/me"] },
  });

  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();

  const [form, setForm] = useState({ suburb: "", postcode: "", state: "QLD" });
  const [deleting, setDeleting] = useState<number | null>(null);

  // Sort zones by postcode, then suburb (server also sorts, but we re-sort defensively)
  const sortedZones = useMemo(() => {
    if (!zones) return [];
    return [...(zones as Zone[])].sort((a, b) => {
      if (a.postcode !== b.postcode) return a.postcode.localeCompare(b.postcode);
      return a.suburb.localeCompare(b.suburb);
    });
  }, [zones]);

  // Group by state for scannability when there are many zones
  const groupedByState = useMemo(() => {
    const groups: Record<string, Zone[]> = {};
    for (const z of sortedZones) {
      if (!groups[z.state]) groups[z.state] = [];
      groups[z.state].push(z);
    }
    return groups;
  }, [sortedZones]);

  const validateForm = () => {
    const suburb = form.suburb.trim();
    const postcode = form.postcode.trim();
    if (!suburb) {
      toast({ title: "Suburb required", description: "Enter a suburb name.", variant: "destructive" });
      return null;
    }
    if (!/^\d{4}$/.test(postcode)) {
      toast({ title: "Postcode must be 4 digits", description: "Australian postcodes are always 4 digits.", variant: "destructive" });
      return null;
    }
    return { suburb, postcode, state: form.state };
  };

  const handleAdd = async () => {
    const data = validateForm();
    if (!data) return;
    try {
      await createZone.mutateAsync({ data });
      await qc.invalidateQueries({ queryKey: ["/api/zones/me"] });
      setForm((f) => ({ ...f, suburb: "", postcode: "" }));
      toast({ title: "Zone added", description: `${data.suburb} ${data.postcode}` });
    } catch (err: any) {
      // Surface 409 conflict from backend
      const status = err?.status ?? err?.response?.status;
      const serverMsg = err?.body?.error ?? err?.response?.data?.error;
      if (status === 409) {
        toast({ title: "Already added", description: serverMsg ?? `${data.suburb} ${data.postcode} is already in your zones.`, variant: "destructive" });
      } else {
        toast({ title: "Failed to add zone", description: serverMsg ?? "Please try again.", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (zone: Zone) => {
    setDeleting(zone.id);
    try {
      await deleteZone.mutateAsync({ id: zone.id });
      await qc.invalidateQueries({ queryKey: ["/api/zones/me"] });
      toast({ title: "Zone removed", description: `${zone.suburb} ${zone.postcode}` });
    } catch {
      toast({ title: "Failed to remove zone", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teaching Zones</h1>
          <p className="text-muted-foreground">
            Define the suburbs you teach in. Students searching from these areas will be matched to you.
          </p>
        </div>

        {/* Add form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" /> Add Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Suburb</Label>
                <Input
                  placeholder="e.g. Chermside"
                  value={form.suburb}
                  onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input
                  placeholder="4032"
                  value={form.postcode}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postcode: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                >
                  {["QLD", "NSW", "VIC", "SA", "WA", "TAS", "ACT", "NT"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleAdd} disabled={createZone.isPending} className="h-9">
                {createZone.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              To change a zone, remove it and add the corrected version.
            </p>
          </CardContent>
        </Card>

        {/* Zone list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sortedZones.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No teaching zones set</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add suburbs above to start appearing in student searches.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: add every suburb you're comfortable teaching in, not just where you live.
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Your Zones
              </CardTitle>
              <Badge variant="secondary">{sortedZones.length} {sortedZones.length === 1 ? "zone" : "zones"}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(groupedByState).map(([state, items]) => (
                <div key={state}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{state}</h3>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="divide-y border rounded-md">
                    {items.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                          {zone.postcode}
                        </Badge>
                        <span className="text-sm font-medium flex-1 truncate">{zone.suburb}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(zone)}
                          disabled={deleting === zone.id}
                        >
                          {deleting === zone.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
