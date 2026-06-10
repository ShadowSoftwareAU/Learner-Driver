import { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngBounds, LatLngTuple } from "leaflet";
import { useQueries } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Layers, Check, ChevronsUpDown, X, Toilet } from "lucide-react";
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

interface BathroomFeature {
  lat: number;
  lng: number;
  name: string;
  fee: boolean;
  wheelchair: boolean;
  openingHours?: string;
  qualityScore: number;
}

function bathroomColor(score: number) {
  if (score >= 3) return "#0891b2"; // cyan-600 — well documented/accessible
  if (score >= 1) return "#6366f1"; // indigo — some info
  return "#9ca3af"; // gray — unknown
}

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

function BoundsTracker({ onBoundsChange }: { onBoundsChange: (b: LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => {
    onBoundsChange(map.getBounds());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function useBathroomData(enabled: boolean, bounds: LatLngBounds | null) {
  const [bathrooms, setBathrooms] = useState<BathroomFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !bounds) { setBathrooms([]); return; }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const s = bounds.getSouth(), w = bounds.getWest(), n = bounds.getNorth(), e = bounds.getEast();
        const query = `[out:json];node["amenity"="toilets"](${s},${w},${n},${e});out tags;`;
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
          headers: { "Content-Type": "text/plain" },
        });
        const data = await res.json();
        const features: BathroomFeature[] = (data.elements ?? []).map((el: any) => {
          const t = el.tags ?? {};
          let score = 0;
          if (t.wheelchair === "yes") score++;
          if (t.fee !== "yes") score++;
          if (t.opening_hours) score++;
          if (t.name || t.operator) score++;
          return {
            lat: el.lat,
            lng: el.lon,
            name: t.name || t.operator || "Public Toilet",
            fee: t.fee === "yes",
            wheelchair: t.wheelchair === "yes",
            openingHours: t.opening_hours,
            qualityScore: score,
          };
        });
        setBathrooms(features);
      } catch {
        setBathrooms([]);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [enabled, bounds]);

  return { bathrooms, loading };
}

export default function HeatmapPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [showLayer, setShowLayer] = useState(true);
  const [showBathrooms, setShowBathrooms] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);

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

  const { bathrooms, loading: bathroomsLoading } = useBathroomData(showBathrooms, mapBounds);

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
                    <PopoverContent className="z-[9999] p-0 w-[320px]" align="start">
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
                                    isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
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

              {/* Layer toggles */}
              <div className="flex flex-col gap-2 justify-end pb-0.5">
                <div className="flex items-center gap-2.5">
                  <Switch id="layer-toggle" checked={showLayer} onCheckedChange={setShowLayer} />
                  <Label htmlFor="layer-toggle" className="flex items-center gap-1.5 cursor-pointer">
                    <Layers className="w-4 h-4" /> Maneuvers
                  </Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Switch id="bathroom-toggle" checked={showBathrooms} onCheckedChange={setShowBathrooms} />
                  <Label htmlFor="bathroom-toggle" className="flex items-center gap-1.5 cursor-pointer">
                    <Toilet className="w-4 h-4" />
                    Public Toilets
                    {bathroomsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    {showBathrooms && !bathroomsLoading && bathrooms.length > 0 && (
                      <span className="text-xs text-muted-foreground">({bathrooms.length})</span>
                    )}
                  </Label>
                </div>
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

                  <BoundsTracker onBoundsChange={setMapBounds} />

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

                  {showBathrooms && bathrooms.map((b, i) => (
                    <CircleMarker
                      key={`bath-${i}`}
                      center={[b.lat, b.lng]}
                      radius={8}
                      pathOptions={{
                        color: bathroomColor(b.qualityScore),
                        fillColor: bathroomColor(b.qualityScore),
                        fillOpacity: 0.8,
                        weight: 1.5,
                        opacity: 1,
                      }}
                    >
                      <Popup>
                        <div style={{ minWidth: 160 }}>
                          <p style={{ fontWeight: 700, marginBottom: 4 }}>{b.name}</p>
                          <p style={{ fontSize: 11, marginBottom: 2 }}>
                            {b.fee ? "💰 Paid entry" : "✅ Free"}
                          </p>
                          {b.wheelchair && (
                            <p style={{ fontSize: 11, marginBottom: 2 }}>♿ Wheelchair accessible</p>
                          )}
                          {b.openingHours && (
                            <p style={{ fontSize: 11, color: "#6b7280" }}>🕐 {b.openingHours}</p>
                          )}
                          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                            OSM data · Quality: {b.qualityScore}/4
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
          <CardContent className="p-6 pt-0 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["mastered", "practiced", "attempted", "not_attempted"].map(level => (
                <div key={level} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: LEVEL_COLOR[level] }} />
                  <span className="text-sm text-muted-foreground">{LEVEL_LABEL[level]}</span>
                </div>
              ))}
            </div>
            {showBathrooms && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Public Toilet Quality (OSM data)</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { color: "#0891b2", label: "Well documented (3–4 tags)" },
                    { color: "#6366f1", label: "Some info (1–2 tags)" },
                    { color: "#9ca3af", label: "Unknown" },
                  ].map(({ color, label }) => (
                    <div key={color} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
