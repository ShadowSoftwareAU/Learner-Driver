import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapZone = {
  id: number;
  name: string;
  description: string;
  color: string;
  center: [number, number];
  radius: number;
  practiceHint: string;
};

// Brisbane-area practice zones keyed by lesson_type sort_order
export const BRISBANE_ZONES: MapZone[] = [
  {
    id: 1,
    name: "Vehicle Fundamentals",
    description: "Quiet suburban streets — ideal for first-time controls practice",
    color: "#6366f1",
    center: [-27.579, 153.039],
    radius: 900,
    practiceHint: "Sunnybank Hills: low traffic, gentle curves, good for controls & pre-drive checks",
  },
  {
    id: 2,
    name: "Parking & Stopping",
    description: "Car park zones with angle, parallel and reverse bays",
    color: "#10b981",
    center: [-27.390, 153.032],
    radius: 700,
    practiceHint: "Chermside: large shopping centre car parks with marked bays of all types",
  },
  {
    id: 3,
    name: "Hill Starts & Gradients",
    description: "Steep residential streets requiring confident hill-start technique",
    color: "#f59e0b",
    center: [-27.536, 153.082],
    radius: 1100,
    practiceHint: "Mt Gravatt: steep gradients on Camp Mountain Road and surrounds",
  },
  {
    id: 4,
    name: "City & Intersection Driving",
    description: "Complex intersections, traffic lights, roundabouts and urban navigation",
    color: "#3b82f6",
    center: [-27.470, 153.025],
    radius: 1400,
    practiceHint: "Brisbane CBD / South Bank: multiple signal types, roundabouts and pedestrian crossings",
  },
  {
    id: 5,
    name: "Freeway & Open Road",
    description: "Freeway entry/exit ramps, merging and high-speed lane changes",
    color: "#8b5cf6",
    center: [-27.401, 153.096],
    radius: 2000,
    practiceHint: "Gateway Motorway (M1) at Nudgee: controlled on-ramps, merge lanes and 110 km/h travel",
  },
  {
    id: 6,
    name: "Hazard Perception",
    description: "Coastal roads with cyclists, pedestrians, school zones and variable conditions",
    color: "#ef4444",
    center: [-27.460, 153.170],
    radius: 1200,
    practiceHint: "Wynnum–Manly foreshore: heavy foot traffic, school zones and shared paths",
  },
  {
    id: 7,
    name: "Road Positioning & Speed",
    description: "Multi-lane arterial roads for lane discipline and speed management",
    color: "#f97316",
    center: [-27.524, 153.052],
    radius: 1000,
    practiceHint: "Logan Road (Mt Gravatt to Stones Corner): 4-lane arterial with bus lanes and varying speeds",
  },
  {
    id: 8,
    name: "QSAFE Compliance",
    description: "DTS testing centre routes — practice the exact roads used in Queensland driving tests",
    color: "#64748b",
    center: [-27.400, 153.040],
    radius: 1300,
    practiceHint: "Kedron / Lutwyche DTS: official test routes including school zones, roundabouts and main roads",
  },
];

function FitBounds({ zones }: { zones: MapZone[] }) {
  const map = useMap();
  useEffect(() => {
    if (zones.length > 0) {
      const L = (window as any).L;
      if (!L) return;
      const bounds = L.latLngBounds(zones.map((z) => z.center));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 13 });
    }
  }, [map, zones]);
  return null;
}

type Props = {
  highlightedTypeIds?: number[];
  className?: string;
};

export default function LessonRouteMap({ highlightedTypeIds, className }: Props) {
  const isHighlighted = (zone: MapZone) =>
    !highlightedTypeIds || highlightedTypeIds.length === 0 || highlightedTypeIds.includes(zone.id);

  const activeZones = BRISBANE_ZONES.filter(isHighlighted);
  const dimmedZones = BRISBANE_ZONES.filter((z) => !isHighlighted(z));

  return (
    <div className={`rounded-xl overflow-hidden border ${className ?? ""}`} style={{ height: 420 }}>
      <MapContainer
        center={[-27.47, 153.03]}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {activeZones.length > 0 && <FitBounds zones={activeZones} />}

        {/* Dimmed (not in plan) zones */}
        {dimmedZones.map((zone) => (
          <Circle
            key={`dim-${zone.id}`}
            center={zone.center}
            radius={zone.radius}
            pathOptions={{ color: "#94a3b8", fillColor: "#94a3b8", fillOpacity: 0.08, opacity: 0.3, weight: 1 }}
          >
            <Tooltip direction="top" sticky>
              <span className="text-xs text-muted-foreground">{zone.name}</span>
            </Tooltip>
          </Circle>
        ))}

        {/* Active (priority) zones */}
        {activeZones.map((zone) => (
          <Circle
            key={`active-${zone.id}`}
            center={zone.center}
            radius={zone.radius}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.2,
              opacity: 0.9,
              weight: 2.5,
            }}
          >
            <Tooltip direction="top" permanent={false} sticky>
              <strong style={{ color: zone.color }}>{zone.name}</strong>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 220 }}>
                <p style={{ fontWeight: 700, color: zone.color, marginBottom: 4 }}>{zone.name}</p>
                <p style={{ fontSize: 12, marginBottom: 6, color: "#475569" }}>{zone.description}</p>
                <p style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>📍 {zone.practiceHint}</p>
              </div>
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
