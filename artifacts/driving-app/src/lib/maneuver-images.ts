/**
 * Maps a maneuver name + category to a reference guide image.
 * Images live in /maneuver-guides/ (public folder).
 * Returns null if no image is relevant.
 */
export function getManeuverImage(name: string, category: string): string | null {
  const n = name.toLowerCase();
  const c = category.toLowerCase();

  // Speed & Road Position group
  if (
    n.includes("lane") ||
    n.includes("speed") ||
    n.includes("following distance") ||
    n.includes("overtaking") ||
    n.includes("overtake") ||
    n.includes("freeway") ||
    n.includes("highway") ||
    n.includes("motorway") ||
    c.includes("speed") ||
    c.includes("road position") ||
    c.includes("freeway")
  ) {
    return "/maneuver-guides/speed-road-position.png";
  }

  // Observation & Hazards group
  if (
    n.includes("mirror") ||
    n.includes("blind spot") ||
    n.includes("scanning") ||
    n.includes("scan") ||
    n.includes("pedestrian") ||
    n.includes("cyclist") ||
    n.includes("school zone") ||
    n.includes("night") ||
    n.includes("weather") ||
    n.includes("adverse") ||
    n.includes("fog") ||
    n.includes("rain") ||
    c.includes("observation") ||
    c.includes("hazard perception") ||
    c.includes("scanning")
  ) {
    return "/maneuver-guides/observation-hazards.png";
  }

  // Road Rules & Traffic Management group
  if (
    n.includes("intersection") ||
    n.includes("give way") ||
    n.includes("traffic sign") ||
    n.includes("signal") ||
    n.includes("communication") ||
    n.includes("decision") ||
    n.includes("road user") ||
    n.includes("hazard response") ||
    n.includes("right of way") ||
    c.includes("road rule") ||
    c.includes("traffic") ||
    c.includes("intersection") ||
    c.includes("decision")
  ) {
    return "/maneuver-guides/road-rules.png";
  }

  return null;
}
