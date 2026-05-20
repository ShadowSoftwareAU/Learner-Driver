import { useState } from "react";
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
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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

  const handleAdd = async () => {
    if (!form.suburb.trim() || !form.postcode.trim()) {
      toast({ title: "Suburb and postcode are required", variant: "destructive" });
      return;
    }
    try {
      await createZone.mutateAsync({
        data: { suburb: form.suburb.trim(), postcode: form.postcode.trim(), state: form.state },
      });
      qc.invalidateQueries({ queryKey: ["/api/zones/me"] });
      setForm((f) => ({ ...f, suburb: "", postcode: "" }));
      toast({ title: "Zone added" });
    } catch {
      toast({ title: "Failed to add zone", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await deleteZone.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: ["/api/zones/me"] });
      toast({ title: "Zone removed" });
    } catch {
      toast({ title: "Failed to remove zone", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teaching Zones</h1>
          <p className="text-muted-foreground">
            Define the suburbs you teach in. Students searching from these areas will be matched to you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" /> Add Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  placeholder="e.g. 4032"
                  value={form.postcode}
                  maxLength={4}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
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
            </div>
            <Button onClick={handleAdd} disabled={createZone.isPending}>
              {createZone.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Zone
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !zones || zones.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No teaching zones set.</p>
            <p className="text-sm text-muted-foreground">
              Add suburbs above to start appearing in student searches.
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Your Zones ({zones.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {zones.map((zone: any) => (
                  <div
                    key={zone.id}
                    className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm shadow-sm"
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{zone.suburb}</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {zone.postcode}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{zone.state}</span>
                    <button
                      onClick={() => handleDelete(zone.id)}
                      disabled={deleting === zone.id}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {deleting === zone.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
