/**
 * RouteMapWebView
 *
 * Renders a GPS route and maneuver-rating markers using Leaflet inside a
 * react-native-webview.  Works in Expo Go — no native map module required.
 *
 * Props:
 *   routePoints   — ordered array of {lat, lng, ts} points
 *   maneuverPins  — rated maneuvers with position + competency colour
 *   style         — optional ViewStyle override
 */

import React, { useMemo } from "react";
import { StyleSheet, View, Text, StyleProp, ViewStyle } from "react-native";
import WebView from "react-native-webview";

export type RoutePoint = { lat: number; lng: number; ts: number };

export type ManeuverPin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  /** Hex colour matching the competency level */
  color: string;
};

interface Props {
  routePoints: RoutePoint[];
  maneuverPins: ManeuverPin[];
  style?: StyleProp<ViewStyle>;
}

/** Build a full self-contained HTML page with Leaflet embedded. */
function buildHtml(routePoints: RoutePoint[], pins: ManeuverPin[]): string {
  const center =
    routePoints.length > 0
      ? [routePoints[Math.floor(routePoints.length / 2)].lat, routePoints[Math.floor(routePoints.length / 2)].lng]
      : [-27.4698, 153.0251]; // Brisbane fallback

  const routeJson = JSON.stringify(routePoints.map((p) => [p.lat, p.lng]));
  const pinsJson = JSON.stringify(pins);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .legend {
      position: absolute;
      bottom: 24px;
      left: 8px;
      z-index: 1000;
      background: white;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: sans-serif;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      line-height: 1.8;
    }
    .legend-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 5px;
    }
  </style>
</head>
<body>
<div id="map"></div>
<div class="legend">
  <div><span class="legend-dot" style="background:#3B82F6"></span> Route</div>
  <div><span class="legend-dot" style="background:#22C55E"></span> Start / End</div>
  <div><span class="legend-dot" style="background:#94A3B8"></span> Not attempted</div>
  <div><span class="legend-dot" style="background:#F59E0B"></span> Developing</div>
  <div><span class="legend-dot" style="background:#3B82F6"></span> Competent</div>
  <div><span class="legend-dot" style="background:#16A34A"></span> Consistent</div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var route = ${routeJson};
  var pins  = ${pinsJson};
  var center = ${JSON.stringify(center)};

  var map = L.map('map', { zoomControl: true }).setView(center, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // ── Route polyline ────────────────────────────────────────────────────────
  if (route.length > 1) {
    var poly = L.polyline(route, { color: '#3B82F6', weight: 4, opacity: 0.85 }).addTo(map);

    // Start marker (green)
    L.circleMarker(route[0], {
      radius: 8, color: '#fff', weight: 2,
      fillColor: '#22C55E', fillOpacity: 1
    }).bindTooltip('Start', { permanent: false }).addTo(map);

    // End marker (red)
    var last = route[route.length - 1];
    L.circleMarker(last, {
      radius: 8, color: '#fff', weight: 2,
      fillColor: '#EF4444', fillOpacity: 1
    }).bindTooltip('End', { permanent: false }).addTo(map);

    map.fitBounds(poly.getBounds(), { padding: [24, 24] });
  } else if (route.length === 1) {
    map.setView(route[0], 15);
  }

  // ── Maneuver pins ─────────────────────────────────────────────────────────
  pins.forEach(function(pin) {
    L.circleMarker([pin.lat, pin.lng], {
      radius: 10,
      color: '#fff',
      weight: 2,
      fillColor: pin.color,
      fillOpacity: 0.95
    })
    .bindPopup('<b>' + pin.name + '</b>')
    .addTo(map);
  });
})();
</script>
</body>
</html>`;
}

export function RouteMapWebView({ routePoints, maneuverPins, style }: Props) {
  const html = useMemo(
    () => buildHtml(routePoints, maneuverPins),
    // Rebuild only when the arrays actually change (by reference after freeze on save)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(routePoints), JSON.stringify(maneuverPins)],
  );

  if (routePoints.length === 0 && maneuverPins.length === 0) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>No GPS data recorded</Text>
      </View>
    );
  }

  return (
    <WebView
      style={[styles.webview, style]}
      source={{ html }}
      originWhitelist={["*"]}
      // Allow loading Leaflet tiles from OSM
      mixedContentMode="always"
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      // Prevent the WebView from stealing scroll on Android
      nestedScrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: "#94A3B8",
    fontFamily: "Inter_400Regular",
  },
});
