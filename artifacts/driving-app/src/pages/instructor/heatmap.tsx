import { useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { LatLngTuple } from "leaflet";
import { useQueries } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Layers, Check, ChevronsUpDown, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useListManeuvers, getGetManeuverHeatmapQueryOptions } from "@workspace/api-client-react";

const LEVEL_COLOR: Record<string, string> = {
  mastered: "#16a34a",
  practiced: "#ca8a04",
  attempted: "#dc2626",
  not_attempted: "#6b7280",
};

const LEVEL_LABEL: Record<string, string> = {
  mastered: "Mastered",
  practiced: "Practiced",
  attempted: "Attempted",
  not_attempted: "Not Attempted",
};

function FitPoints({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    import("leaflet").then(L => {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.25), { maxZoom: 14 });
    });
  }, [map, points]);
  return null;
}

export default function HeatmapPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [showLayer, setShowLayer] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const { data: maneuvers, isLoading: maneuversLoading } = useListManeuvers();

  const heatmapQueries = useQueries({
    queries: selectedIds.map(id => ({
      ...getGetManeuverHeatmapQueryOptions({ maneuverId: parseInt(id) }),
    })),
  });

  const heatmapData = useMemo(
    () => heatmapQueries.flatMap(q => q.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heatmapQueries.map(q => q.data)]
  );
  const heatmapLoading = heatmapQueries.some(q => q.isLoading);

  const filteredPoints = useMemo(
    () => heatmapData.filter(p => filterLevel === "all" || p.competencyLevel === filterLevel),
    [heatmapData, filterLevel]
  );

  const mapPoints: LatLngTuple[] = filteredPoints.map(p => [p.lat, p.lng]);

  const levelCounts = useMemo(
    () =>
      heatmapData.reduce((acc, p) => {
        acc[p.competencyLevel] = (acc[p.competencyLevel] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [heatmapData]
  );

  function toggleId(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  function removeId(id: string) {
    setSelectedIds(prev => prev.filter(v => v !== id));
  }

  const selectedManeuvers = (maneuvers ?? []).filter(m => selectedIds.includes(m.id.toString()));

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maneuver Heatmap</h1>
          <p className="text-muted-foreground text-lg mt-1">
            See where specific maneuvers are regularly taught — identify ideal spots for hill starts, parking, and more.
          </p>
        </div>

        <Card>
          <CardHeader className="p-6 border-b">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Select Maneuvers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Searchable multi-select */}
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Maneuver</Label>
                {maneuversLoading ? (
                  <div className="h-10 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal"
                      >
                        {selectedIds.length === 0
                          ? "Choose maneuvers to visualise..."
                          : `${selectedIds.length} maneuver${selectedIds.length > 1 ? "s" : ""} selected`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="z-[9999] p-0 w-[320px]"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search maneuvers..." />
                        <CommandList>
                          <CommandEmpty>No maneuvers found.</CommandEmpty>
                          <CommandGroup>
                            {(maneuvers ?? []).map(m => {
                              const isSelected = selectedIds.includes(m.id.toString());
                              return (
                                <CommandItem
                                  key={m.id}
                                  value={m.name}
                                  onSelect={() => toggleId(m.id.toString())}
                                  className="cursor-pointer"
                                >
                                  <div className={cn(
                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "opacity-50"
                                  )}>
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </div>
                                  {m.name}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Filter by level */}
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Filter by level</Label>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="all">All levels</SelectItem>
                    <SelectItem value="mastered">Mastered</SelectItem>
                    <SelectItem value="practiced">Practiced</SelectItem>
                    <SelectItem value="attempted">Attempted</SelectItem>
                    <SelectItem value="not_attempted">Not Attempted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Layer toggle */}
              <div className="flex items-end gap-3 pb-0.5">
                <Switch
                  id="layer-toggle"
                  checked={showLayer}
                  onCheckedChange={setShowLayer}
                />
                <Label htmlFor="layer-toggle" className="flex items-center gap-1.5 cursor-pointer">
                  <Layers className="w-4 h-4" />
                  Show layer
                </Label>
              </div>
            </div>

            {/* Selected maneuver chips */}
            {selectedManeuvers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedManeuvers.map(m => (
                  <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
                    {m.name}
                    <button
                      onClick={() => removeId(m.id.toString())}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                      aria-label={`Remove ${m.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedManeuvers.length > 1 && (
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {/* Level count badges */}
            {selectedIds.length > 0 && !heatmapLoading && heatmapData.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(levelCounts).map(([level, count]) => (
                  <Badge
                    key={level}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: LEVEL_COLOR[level], color: LEVEL_COLOR[level] }}
                  >
                    {LEVEL_LABEL[level] ?? level}: {count}
                  </Badge>
                ))}
                <Badge variant="secondary" className="text-xs">
                  Total: {heatmapData.length} data points
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-hidden rounded-xl">
            {heatmapLoading && selectedIds.length > 0 ? (
              <div className="flex items-center justify-center" style={{ height: 500 }}>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div style={{ height: 500 }}>
                <MapContainer
                  center={[-27.47, 153.03]}
                  zoom={11}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {showLayer && mapPoints.length > 0 && <FitPoints points={mapPoints} />}

                  {showLayer && filteredPoints.map((p, i) => (
                    <CircleMarker
                      key={i}
                      center={[p.lat, p.lng]}
                      radius={18}
                      pathOptions={{
                        color: LEVEL_COLOR[p.competencyLevel] ?? "#6b7280",
                        fillColor: LEVEL_COLOR[p.competencyLevel] ?? "#6b7280",
                        fillOpacity: 0.35,
                        weight: 1,
                        opacity: 0.6,
                      }}
                    >
                      <Popup>
                        <div style={{ minWidth: 160 }}>
                          <p style={{ fontWeight: 700, marginBottom: 2 }}>{p.maneuverName}</p>
                          <p style={{ fontSize: 12, color: LEVEL_COLOR[p.competencyLevel] }}>
                            {LEVEL_LABEL[p.competencyLevel] ?? p.competencyLevel}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedIds.length > 0 && !heatmapLoading && filteredPoints.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No location data yet for the selected maneuver{selectedIds.length > 1 ? "s" : ""}.
                Location data is recorded automatically during guided assessments.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="p-6">
            <CardTitle className="text-base">How to read this map</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["mastered", "practiced", "attempted", "not_attempted"].map(level => (
              <div key={level} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: LEVEL_COLOR[level] }}
                />
                <span className="text-sm text-muted-foreground">{LEVEL_LABEL[level]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
