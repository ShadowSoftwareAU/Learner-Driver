/**
 * Maps a maneuver name to its specific reference guide image.
 * Images are individual crops stored in /maneuver-guides/individual/ (public folder).
 * Returns null if no image is available for this maneuver.
 * ?v= param busts browser cache when images are replaced.
 */

const V = "?v=18";
const P = (f: string) => `/maneuver-guides/individual/${f}.png${V}`;

const IMAGE_MAP: Record<string, string> = {
  // ── Seating & Controls ───────────────────────────────────────────────────
  "Seating position & mirrors": P("seating-position"),
  "Clutch control (manual)":    P("clutch-control"),
  "Brake control":              P("brake-control"),
  "Accelerator control":        P("accelerator-control"),
  "Gear changes (manual)":      P("gear-changes"),
  "Steering technique":         P("steering-technique"),
  "Handbrake use":              P("handbrake-use"),
  "Moving off safely":          P("moving-off-safely"),
  "Stopping safely":            P("stopping-safely"),
  "Hill starts":                P("hill-starts"),
  "Reverse parking":            P("reverse-parking"),
  "Roundabouts":                P("roundabouts"),
  "U-turns":                    P("u-turns"),
  "Angle parking":              P("angle-parking"),
  "Parallel parking":           P("parallel-parking"),

  // ── Observation & Hazards ─────────────────────────────────────────────────
  "Mirror use & scanning":         P("mirror-scanning"),
  "Blindspot checks":              P("blindspot-checks"),
  "Pedestrian & cyclist hazards":  P("pedestrian-cyclist-hazards"),
  "School zones":                  P("school-zones"),
  "Night driving":                 P("night-driving"),
  "Adverse weather conditions":    P("adverse-weather"),

  // ── Road Rules & Traffic Management ──────────────────────────────────────
  "Observation at intersections":          P("observation-intersections"),
  "Giving way correctly":                  P("giving-way"),
  "Controlled intersections (give way)":   P("giving-way"),
  "Controlled intersections (stop sign)":  P("giving-way"),
  "Uncontrolled intersections":            P("giving-way"),
  "Traffic sign compliance":               P("traffic-sign-compliance"),
  "Traffic lights":                        P("traffic-sign-compliance"),
  "Communication (signals)":               P("communication-signals"),
  "Smooth vehicle control":                P("smooth-vehicle-control"),
  "Hazard response":                       P("hazard-response"),
  "Decision making":                       P("decision-making"),
  "Interaction with other road users":     P("interaction-road-users"),

  // ── Speed & Road Position ─────────────────────────────────────────────────
  "Lane position":       P("lane-position"),
  "Positioning on road": P("lane-position"),
  "Lane changing":       P("lane-changing"),
  "Speed compliance":    P("speed-management"),
  "Speed management":    P("speed-management"),
  "Following distance":  P("following-distance"),
  "Overtaking":          P("overtaking"),
  "Freeway driving":     P("freeway-driving"),

  // Turning — reuse intersection image
  "Turning left at intersections":  P("observation-intersections"),
  "Turning right at intersections": P("observation-intersections"),
};

export function getManeuverImage(name: string, _category: string): string | null {
  return IMAGE_MAP[name] ?? null;
}
