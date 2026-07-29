import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngTuple } from "leaflet";

export type RoutePoint = { lat: number; lng: number; ts: number };
export type ManeuverPoint = {
  lat: number;
  lng: number;
  maneuverId: number;
  name: string;
  level: string;
};

const LEVEL_COLOR: Record<string, string> = {
  mastered: "#16a34a",
  practiced: "#ca8a04",
  attempted: "#dc2626",
  not_attempted: "#6b7280",
};

const LEVEL_LABEL: Record<string, string> = {
  mastered:      "Consistent Skills",
  practiced:     "Competent",
  attempted:     "Developing",
  not_attempted: "Not Attempted",
};

function AutoFit({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const L = (window as any).L;
    if (!L) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
  }, [map, points]);
  return null;
}

type Props = {
  routePath?: RoutePoint[] | null;
  maneuverPoints?: ManeuverPoint[];
  className?: string;
};

export default function AssessmentRouteMap({ routePath, maneuverPoints = [], className }: Props) {
  const routeLatLngs: LatLngTuple[] = (routePath ?? []).map(p => [p.lat, p.lng]);
  const allPoints: LatLngTuple[] = [
    ...routeLatLngs,
    ...maneuverPoints.map(p => [p.lat, p.lng] as LatLngTuple),
  ];

  const hasData = allPoints.length > 0;
  const center: LatLngTuple = hasData
    ? [allPoints[0][0], allPoints[0][1]]
    : [-27.47, 153.03];

  if (!hasData) {
    return (
      <div className={`rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center ${className ?? ""}`} style={{ height: 320 }}>
        <p className="text-sm text-muted-foreground">No GPS route recorded for this lesson.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden border ${className ?? ""}`} style={{ height: 320 }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {allPoints.length > 0 && <AutoFit points={allPoints} />}

        {routeLatLngs.length > 1 && (
          <Polyline
            positions={routeLatLngs}
            pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }}
          />
        )}

        {maneuverPoints.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={10}
            pathOptions={{
              color: LEVEL_COLOR[p.level] ?? "#6b7280",
              fillColor: LEVEL_COLOR[p.level] ?? "#6b7280",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>{p.name}</p>
                <p style={{ fontSize: 12, color: LEVEL_COLOR[p.level] ?? "#6b7280" }}>
                  {LEVEL_LABEL[p.level] ?? p.level}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
