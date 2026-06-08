import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { LatLngTuple } from "leaflet";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useListManeuvers, useGetManeuverHeatmap, getGetManeuverHeatmapQueryKey } from "@workspace/api-client-react";

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
    const L = (window as any).L;
    if (!L) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.25), { maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function HeatmapPage() {
  const [selectedManeuverId, setSelectedManeuverId] = useState<string>("");
  const [showLayer, setShowLayer] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const { data: maneuvers, isLoading: maneuversLoading } = useListManeuvers();
  const heatmapParams = selectedManeuverId ? { maneuverId: parseInt(selectedManeuverId) } : undefined;
  const { data: heatmapData, isLoading: heatmapLoading } = useGetManeuverHeatmap(
    heatmapParams,
    { query: { enabled: !!selectedManeuverId, queryKey: getGetManeuverHeatmapQueryKey(heatmapParams) } }
  );

  const filteredPoints = (heatmapData ?? []).filter(p =>
    filterLevel === "all" || p.competencyLevel === filterLevel
  );

  const mapPoints: LatLngTuple[] = filteredPoints.map(p => [p.lat, p.lng]);

  const selectedManeuver = maneuvers?.find(m => m.id.toString() === selectedManeuverId);

  const levelCounts = (heatmapData ?? []).reduce((acc, p) => {
    acc[p.competencyLevel] = (acc[p.competencyLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
              Select Maneuver
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Maneuver</Label>
                {maneuversLoading ? (
                  <div className="h-10 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <Select value={selectedManeuverId} onValueChange={setSelectedManeuverId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose a maneuver to visualise..." />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {(maneuvers ?? []).map(m => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

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

            {selectedManeuverId && heatmapData && (
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
                  Total: {heatmapData.length} sessions
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-hidden rounded-xl">
            {heatmapLoading && selectedManeuverId ? (
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

        {selectedManeuverId && !heatmapLoading && filteredPoints.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No location data yet for <strong>{selectedManeuver?.name}</strong>.
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
