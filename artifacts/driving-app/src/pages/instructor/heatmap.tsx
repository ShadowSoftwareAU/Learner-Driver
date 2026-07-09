import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { Loader2, MapPin, Layers, Check, ChevronsUpDown, X, Toilet, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useListManeuvers, getGetManeuverHeatmapQueryOptions, getGovNearby, submitToilet } from "@workspace/api-client-react";
import { ToiletRatingWidget } from "@/components/ToiletRatingWidget";

const LEVEL_COLOR: Record<string, string> = {
  mastered: "#16a34a",
  practiced: "#ca8a04",
  attempted: "#dc2626",
  not_attempted: "#6b7280",
};

const LEVEL_LABEL: Record<string, string> = {
  mastered: "Competent",
  practiced: "Not yet Competent",
  attempted: "Attempted",
  not_attempted: "Not Attempted",
};

interface BathroomFeature {
  id: number;          // positive = OSM node ID; negative = gov DB id (no OSM record)
  source: "osm" | "gov";
  sourceType?: "gov" | "user"; // only set for source === "gov"
  lat: number;
  lng: number;
  name: string;
  fee: boolean;
  wheelchair: boolean;
  openingHours?: string;
  qualityScore: number;
  // Gov-sourced extras
  babyChange?: boolean;
  showers?: boolean;
  drinkingWater?: boolean;
  mlakRequired?: boolean;
  address?: string;
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

function MapClickHandler({ active, onMapClick }: { active: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => { if (active) onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function useBathroomData(enabled: boolean) {
  const [bathrooms, setBathrooms] = useState<BathroomFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Separate caches for OSM and gov records so dedup can compare them cleanly
  const osmCacheRef = useRef<Map<number, BathroomFeature>>(new Map());
  const govCacheRef = useRef<Map<number, BathroomFeature>>(new Map());
  // Update synchronously during render so triggerFetch always sees the latest value
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Remember the last bounds so we can re-fire when the toggle turns on
  const lastBoundsRef = useRef<LatLngBounds | null>(null);

  // Clear everything when the toggle is turned off
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
      osmCacheRef.current.clear();
      govCacheRef.current.clear();
      setBathrooms([]);
      setLoading(false);
    }
  }, [enabled]);

  // Stable callback — never changes identity
  const triggerFetch = useCallback((bounds: LatLngBounds) => {
    lastBoundsRef.current = bounds;
    if (!enabledRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;
      setLoading(true);
      const s = bounds.getSouth(), w = bounds.getWest(), n = bounds.getNorth(), e = bounds.getEast();

      await Promise.allSettled([
        // ── OSM via Overpass (nodes + ways + relations) ──────────────────────
        (async () => {
          // Include ways/relations so we capture toilet blocks, not just nodes.
          // `out center tags;` returns the centroid for non-node elements.
          const query =
            `[out:json][timeout:25];` +
            `(node["amenity"="toilets"](${s},${w},${n},${e});` +
            `way["amenity"="toilets"](${s},${w},${n},${e});` +
            `relation["amenity"="toilets"](${s},${w},${n},${e}););` +
            `out center tags;`;
          const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query,
            headers: { "Content-Type": "text/plain" },
            signal,
          });
          if (!res.ok) return;
          const data = await res.json();
          for (const el of (data.elements ?? [])) {
            // nodes: el.lat / el.lon; ways + relations: el.center.lat / el.center.lon
            const lat: number | undefined = el.lat ?? el.center?.lat;
            const lon: number | undefined = el.lon ?? el.center?.lon;
            if (lat == null || lon == null) continue;
            const t = el.tags ?? {};
            let score = 0;
            if (t.wheelchair === "yes") score++;
            if (t.fee !== "yes") score++;
            if (t.opening_hours) score++;
            if (t.name || t.operator) score++;
            osmCacheRef.current.set(el.id as number, {
              id: el.id as number,
              source: "osm",
              lat,
              lng: lon,
              name: t.name || t.operator || "Public Toilet",
              fee: t.fee === "yes",
              wheelchair: t.wheelchair === "yes",
              openingHours: t.opening_hours as string | undefined,
              qualityScore: score,
            });
          }
        })(),

        // ── Government dataset (National Public Toilet Map) ──────────────────
        (async () => {
          try {
            const govData = await getGovNearby({ s, w, n, e }, { signal });
            // Rebuild gov cache for this viewport (govNearby returns all in bbox)
            govCacheRef.current.clear();
            for (const g of govData) {
              let score = 0;
              if (g.wheelchairAccessible) score++;
              if (!g.paymentRequired) score++;
              if (g.isOpen24h || g.openingHours) score++;
              if (g.name) score++;
              govCacheRef.current.set(-g.id, {
                id: -g.id,
                source: "gov",
                sourceType: g.sourceType as "gov" | "user",
                lat: g.lat,
                lng: g.lng,
                name: g.name,
                fee: g.paymentRequired,
                wheelchair: g.wheelchairAccessible,
                openingHours: g.isOpen24h ? "24 hours" : (g.openingHours ?? undefined),
                qualityScore: score,
                babyChange: g.babyChange,
                showers: g.showers,
                drinkingWater: g.drinkingWater,
                mlakRequired: g.mlakRequired,
                address: g.address ?? undefined,
              });
            }
          } catch {
            // Gov fetch may fail if the dataset hasn't been imported yet — silent fallback
          }
        })(),
      ]);

      if (!signal.aborted) {
        // Merge OSM + gov, dropping gov records that have an OSM equivalent nearby.
        // "nearby" = within ~75m (≈0.0007° at Brisbane latitude)
        const osmArr = Array.from(osmCacheRef.current.values());
        const govArr = Array.from(govCacheRef.current.values());
        const deduped = govArr.filter(g =>
          !osmArr.some(o => Math.abs(o.lat - g.lat) < 0.0007 && Math.abs(o.lng - g.lng) < 0.0007)
        );
        setBathrooms([...osmArr, ...deduped]);
        setLoading(false);
      }
    }, 600);
  }, []); // intentionally empty — reads refs, never stale

  // When the toggle turns on, re-fire immediately with the last known bounds.
  useEffect(() => {
    if (enabled && lastBoundsRef.current) {
      triggerFetch(lastBoundsRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const refreshNow = useCallback(() => {
    if (lastBoundsRef.current) triggerFetch(lastBoundsRef.current);
  }, [triggerFetch]);

  return { bathrooms, loading, triggerFetch, refreshNow };
}

export default function HeatmapPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [showLayer, setShowLayer] = useState(true);
  const [showBathrooms, setShowBathrooms] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [addMode, setAddMode] = useState(false);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [submitForm, setSubmitForm] = useState({ name: "", wheelchair: false, fee: false, open24h: false, babyChange: false, notes: "" });
  const [submitting, setSubmitting] = useState(false);

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

  const { bathrooms, loading: bathroomsLoading, triggerFetch: triggerBathroomFetch, refreshNow: refreshBathrooms } = useBathroomData(showBathrooms);

  async function handleToiletSubmit() {
    if (!pendingLatLng || !submitForm.name.trim()) return;
    setSubmitting(true);
    try {
      await submitToilet({
        name: submitForm.name.trim(),
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
        wheelchairAccessible: submitForm.wheelchair,
        paymentRequired: submitForm.fee,
        isOpen24h: submitForm.open24h,
        babyChange: submitForm.babyChange,
        notes: submitForm.notes.trim() || undefined,
        unisex: true,
      });
      setPendingLatLng(null);
      setAddMode(false);
      setSubmitForm({ name: "", wheelchair: false, fee: false, open24h: false, babyChange: false, notes: "" });
      if (showBathrooms) refreshBathrooms();
    } catch {
      // keep form open on error
    } finally {
      setSubmitting(false);
    }
  }

  function toggleId(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  function removeId(id: string) {
    setSelectedIds(prev => prev.filter(v => v !== id));
  }

  const selectedManeuvers = (maneuvers ?? []).filter(m => selectedIds.includes(m.id.toString()));

  const mapFallback = (
    <div
      className="flex items-center justify-center bg-muted/30 rounded-lg text-sm text-muted-foreground"
      style={{ height: 500 }}
    >
      Map is temporarily unavailable. Try refreshing the page.
    </div>
  );

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
                    <SelectItem value="mastered">Competent</SelectItem>
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
            {/* Keep MapContainer always mounted — unmounting during a Leaflet zoom
                animation causes "_leaflet_pos" crashes. Instead overlay the spinner. */}
            <ErrorBoundary level="widget" fallback={mapFallback}>
            <div style={{ position: "relative", height: 500 }}>
              {/* Add Toilet floating button */}
              {showBathrooms && (
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000 }}>
                  <button
                    onClick={() => { setAddMode(a => !a); setPendingLatLng(null); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shadow-md border transition-colors select-none",
                      addMode
                        ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    )}
                    title={addMode ? "Click the map to place toilet — click again to cancel" : "Report a toilet that isn't on the map"}
                  >
                    <Plus className="w-4 h-4" />
                    {addMode ? "Tap map to place…" : "Add toilet"}
                  </button>
                </div>
              )}
              {heatmapLoading && selectedIds.length > 0 && (
                <div
                  className="flex items-center justify-center bg-background/60 backdrop-blur-sm z-[1000]"
                  style={{ position: "absolute", inset: 0 }}
                >
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              <div style={{ height: "100%" }}>
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

                  <BoundsTracker onBoundsChange={triggerBathroomFetch} />
                  <MapClickHandler
                    active={addMode}
                    onMapClick={(lat, lng) => {
                      setAddMode(false);
                      // Defer so the Leaflet click event finishes propagating before
                      // Radix Dialog mounts — otherwise Radix sees the same click as
                      // an "outside click" and immediately dismisses the dialog.
                      setTimeout(() => setPendingLatLng({ lat, lng }), 0);
                    }}
                  />
                  {pendingLatLng && (
                    <CircleMarker
                      center={[pendingLatLng.lat, pendingLatLng.lng]}
                      radius={10}
                      pathOptions={{ color: "#f59e0b", fillColor: "#fbbf24", fillOpacity: 0.9, weight: 2.5, opacity: 1 }}
                    />
                  )}

                  {showLayer && mapPoints.length > 0 && <FitPoints points={mapPoints} />}

                  {showLayer && filteredPoints.filter(p => p.lat != null && p.lng != null).map((p, i) => (
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

                  {showBathrooms && bathrooms.filter(b => b.lat != null && b.lng != null).map((b) => (
                    <CircleMarker
                      key={b.id}
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
                        {b.source === "osm" ? (
                          <ToiletRatingWidget
                            osmId={b.id}
                            lat={b.lat}
                            lng={b.lng}
                            name={b.name}
                            fee={b.fee}
                            wheelchair={b.wheelchair}
                            openingHours={b.openingHours}
                            qualityScore={b.qualityScore}
                          />
                        ) : b.sourceType === "user" ? (
                          <div style={{ fontFamily: "inherit" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                              <span style={{ fontSize: 10, background: "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Community report</span>
                            </div>
                            <ToiletRatingWidget
                              osmId={b.id}
                              lat={b.lat}
                              lng={b.lng}
                              name={b.name}
                              fee={b.fee}
                              wheelchair={b.wheelchair}
                              openingHours={b.openingHours}
                              qualityScore={b.qualityScore}
                            />
                          </div>
                        ) : (
                          <div style={{ minWidth: 200, maxWidth: 240, fontFamily: "inherit" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{b.name}</span>
                              <span style={{ fontSize: 10, background: "#0ea5e9", color: "#fff", borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap" }}>Gov data</span>
                            </div>
                            {b.address && <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 4px" }}>{b.address}</p>}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                              {b.wheelchair && <span style={{ fontSize: 10, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 5px" }}>♿ Accessible</span>}
                              {b.fee && <span style={{ fontSize: 10, background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047", borderRadius: 4, padding: "1px 5px" }}>Paid</span>}
                              {b.mlakRequired && <span style={{ fontSize: 10, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 4, padding: "1px 5px" }}>MLAK key</span>}
                              {b.babyChange && <span style={{ fontSize: 10, background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 5px" }}>👶 Baby change</span>}
                              {b.showers && <span style={{ fontSize: 10, background: "#f5f3ff", color: "#4c1d95", border: "1px solid #ddd6fe", borderRadius: 4, padding: "1px 5px" }}>🚿 Showers</span>}
                              {b.drinkingWater && <span style={{ fontSize: 10, background: "#ecfeff", color: "#164e63", border: "1px solid #a5f3fc", borderRadius: 4, padding: "1px 5px" }}>💧 Drinking water</span>}
                            </div>
                            {b.openingHours && <p style={{ fontSize: 11, color: "#374151", margin: "0 0 6px" }}>🕐 {b.openingHours}</p>}
                            <a
                              href={`https://maps.google.com/?q=${b.lat},${b.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 11, color: "#0ea5e9", textDecoration: "none" }}
                            >
                              Google Maps ↗
                            </a>
                          </div>
                        )}
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </div>
            </ErrorBoundary>
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Public Toilet Quality (OSM + Gov data)</p>
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

      {/* Add Toilet dialog — opens after user taps map location */}
      <Dialog open={pendingLatLng !== null} onOpenChange={(o) => { if (!o) { setPendingLatLng(null); setAddMode(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Toilet className="w-5 h-5 text-primary" />
              Add a Toilet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label htmlFor="toilet-name">Name / Location <span className="text-destructive">*</span></Label>
              <Input
                id="toilet-name"
                placeholder="e.g. Shell Petrol Station, Roma St"
                value={submitForm.name}
                onChange={e => setSubmitForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {([
                { key: "wheelchair", label: "Wheelchair accessible" },
                { key: "fee",        label: "Fee charged" },
                { key: "open24h",    label: "Open 24 hours" },
                { key: "babyChange", label: "Baby change room" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    id={`toilet-${key}`}
                    checked={submitForm[key]}
                    onCheckedChange={v => setSubmitForm(f => ({ ...f, [key]: v }))}
                  />
                  <Label htmlFor={`toilet-${key}`} className="text-sm cursor-pointer leading-tight">{label}</Label>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="toilet-notes">Notes (optional)</Label>
              <Textarea
                id="toilet-notes"
                placeholder="e.g. Key available from counter, around the back"
                value={submitForm.notes}
                onChange={e => setSubmitForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1.5 resize-none"
                rows={2}
              />
            </div>
            {pendingLatLng && (
              <p className="text-xs text-muted-foreground">
                📍 {pendingLatLng.lat.toFixed(5)}, {pendingLatLng.lng.toFixed(5)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPendingLatLng(null); setAddMode(false); }}>Cancel</Button>
            <Button onClick={handleToiletSubmit} disabled={submitting || !submitForm.name.trim()}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Add to Map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  );
}
