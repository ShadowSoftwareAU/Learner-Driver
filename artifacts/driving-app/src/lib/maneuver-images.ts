/**
 * Maps a maneuver name to its specific reference guide image.
 * Images are individual crops from the composite sheets, stored in
 * /maneuver-guides/individual/ (public folder).
 * Returns null if no image is available for this maneuver.
 */

const IMAGE_MAP: Record<string, string> = {
  // ── Observation & Hazards ─────────────────────────────────────────────────
  "Mirror use & scanning":         "/maneuver-guides/individual/mirror-scanning.png",
  "Blindspot checks":              "/maneuver-guides/individual/blindspot-checks.png",
  "Pedestrian & cyclist hazards":  "/maneuver-guides/individual/pedestrian-cyclist-hazards.png",
  "School zones":                  "/maneuver-guides/individual/school-zones.png",
  "Night driving":                 "/maneuver-guides/individual/night-driving.png",
  "Adverse weather conditions":    "/maneuver-guides/individual/adverse-weather.png",

  // ── Road Rules & Traffic Management ──────────────────────────────────────
  "Observation at intersections":          "/maneuver-guides/individual/observation-intersections.png",
  "Giving way correctly":                  "/maneuver-guides/individual/giving-way.png",
  "Controlled intersections (give way)":   "/maneuver-guides/individual/giving-way.png",
  "Controlled intersections (stop sign)":  "/maneuver-guides/individual/giving-way.png",
  "Uncontrolled intersections":            "/maneuver-guides/individual/giving-way.png",
  "Traffic sign compliance":               "/maneuver-guides/individual/traffic-sign-compliance.png",
  "Traffic lights":                        "/maneuver-guides/individual/traffic-sign-compliance.png",
  "Communication (signals)":              "/maneuver-guides/individual/communication-signals.png",
  "Smooth vehicle control":               "/maneuver-guides/individual/smooth-vehicle-control.png",
  "Hazard response":                       "/maneuver-guides/individual/hazard-response.png",
  "Decision making":                       "/maneuver-guides/individual/decision-making.png",
  "Interaction with other road users":     "/maneuver-guides/individual/interaction-road-users.png",

  // ── Speed & Road Position ─────────────────────────────────────────────────
  "Lane position":      "/maneuver-guides/individual/lane-position.png",
  "Positioning on road":"/maneuver-guides/individual/lane-position.png",
  "Lane changing":      "/maneuver-guides/individual/lane-changing.png",
  "Speed compliance":   "/maneuver-guides/individual/speed-management.png",
  "Speed management":   "/maneuver-guides/individual/speed-management.png",
  "Following distance": "/maneuver-guides/individual/following-distance.png",
  "Overtaking":         "/maneuver-guides/individual/overtaking.png",
  "Freeway driving":    "/maneuver-guides/individual/freeway-driving.png",

  // Turning & intersections — use the giving-way or intersection image
  "Turning left at intersections":  "/maneuver-guides/individual/observation-intersections.png",
  "Turning right at intersections": "/maneuver-guides/individual/observation-intersections.png",
};

export function getManeuverImage(name: string, _category: string): string | null {
  return IMAGE_MAP[name] ?? null;
}
