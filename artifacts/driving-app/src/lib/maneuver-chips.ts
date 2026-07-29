/**
 * maneuver-chips.ts
 *
 * Per-maneuver quick-note chip suggestions for the instructor notes panel.
 * Chips are derived from QSAFE compliance criteria and competency definitions.
 * Ordered: common issues first, positive observations at the end.
 */

// ─── Per-maneuver chip map ────────────────────────────────────────────────────

const MANEUVER_CHIPS: Record<string, string[]> = {

  // ── Pre-Drive & Seating ───────────────────────────────────────────────────

  "Seating position & mirrors": [
    "seat not adjusted for pedals",
    "headrest not aligned",
    "seatbelt not worn correctly",
    "mirrors not adjusted",
    "wheel too close to chest",
    "good independent setup",
    "correct mirror coverage",
  ],

  "Pre-drive safety checks": [
    "skipped walk-around",
    "lights/indicators not checked",
    "mirrors not checked",
    "loose items unsecured",
    "seatbelt reminder needed",
    "thorough pre-drive check",
    "good safety habit",
  ],

  // ── Vehicle Controls ──────────────────────────────────────────────────────

  "Clutch control (manual)": [
    "stalled",
    "rode the clutch",
    "clutch not fully depressed",
    "coasting in neutral",
    "rolled back",
    "slipping clutch",
    "smooth bite point",
    "stall-free start",
  ],

  "Gear changes (manual)": [
    "wrong gear for speed",
    "grinding / missed gear",
    "over-revving",
    "looked at gear stick",
    "late upshift",
    "late downshift",
    "hand slow back to wheel",
    "smooth rev-matched change",
    "anticipated gear for corner",
  ],

  "Accelerator control": [
    "surging / jerking",
    "over-revving on takeoff",
    "harsh acceleration",
    "slow to ease off before braking",
    "smooth progressive throttle",
    "good anticipation",
  ],

  "Handbrake use": [
    "forgot handbrake",
    "not fully released",
    "rolled back on incline",
    "footbrake used instead of handbrake",
    "used instinctively",
    "smooth coordinated release",
    "confident hill technique",
  ],

  "Brake control": [
    "harsh / late braking",
    "pulled to one side under braking",
    "insufficient following distance",
    "forgot handbrake on incline",
    "progressive smooth braking",
    "straight and controlled stop",
  ],

  "Steering technique": [
    "incorrect hand position",
    "one-handed steering",
    "shuffle / cross-arm technique",
    "dry steering at speed",
    "jerky inputs",
    "good hand position",
    "smooth steering throughout",
  ],

  "Smooth vehicle control": [
    "abrupt / jerky inputs",
    "unsteady through corner",
    "late corrections needed",
    "stepped transitions",
    "smooth and composed",
    "seamless coordination",
    "good anticipation throughout",
  ],

  // ── Moving Off ────────────────────────────────────────────────────────────

  "Moving off safely": [
    "missed mirror check",
    "missed blind spot",
    "forgot indicator",
    "indicator too short",
    "failed to give way",
    "pulled out on too small a gap",
    "smooth launch",
    "full observation completed",
  ],

  "Hill starts": [
    "rolled back",
    "stalled on hill",
    "jerky / over-revved launch",
    "excessive clutch slip",
    "smooth hill start",
    "no rollback",
    "good clutch-throttle balance",
  ],

  // ── Observation & Scanning ────────────────────────────────────────────────

  "Mirror use & scanning": [
    "mirrors not checked regularly",
    "missed centre mirror",
    "missed side mirror",
    "scanning too close — not far enough ahead",
    "didn't check mirrors before braking",
    "good systematic scanning",
    "thorough mirror routine",
  ],

  "Blindspot checks": [
    "missed blind spot",
    "head glance not a full turn",
    "drifted during head check",
    "skipped check before lane change",
    "blind spot check automatic",
    "combined with mirror check smoothly",
  ],

  "Observation at intersections": [
    "rolled while looking",
    "missed pedestrian check",
    "missed cyclist at crossing",
    "rushed observation",
    "didn't adjust position for better sightline",
    "thorough L-R-ahead scan",
    "identified hidden hazard",
    "decisive entry once clear",
  ],

  "Hazard response": [
    "scanning not regular",
    "slow to identify hazard",
    "no speed adjustment for hazard",
    "following distance too close",
    "didn't anticipate hazard",
    "early hazard identification",
    "good anticipation of others",
  ],

  "Decision making": [
    "gap too small",
    "forced other road user to brake",
    "hesitated on a safe gap",
    "misjudged speed of traffic",
    "good gap judgement",
    "confident, correct decision",
    "accurate speed assessment",
  ],

  "Interaction with other road users": [
    "unpredictable movement",
    "cut off another vehicle",
    "failed to give way",
    "following too aggressively",
    "predictable and courteous",
    "communicated intent clearly",
    "let faster traffic pass",
  ],

  "Pedestrian & cyclist hazards": [
    "insufficient clearance past cyclist",
    "didn't check crossing",
    "missed cyclist before turning",
    "no scan at bus stop",
    "good clearance given",
    "slowed appropriately",
    "actively looked for vulnerable users",
  ],

  // ── Positioning & Speed ───────────────────────────────────────────────────

  "Lane position": [
    "drifting left",
    "drifting right",
    "straddling lane line",
    "too close to parked cars",
    "centred and consistent",
    "good hazard adjustment",
    "returned to centre promptly",
  ],

  "Positioning on road": [
    "wrong lane for direction",
    "didn't keep left",
    "late lane selection for turn",
    "too close to centreline",
    "good early positioning",
    "smooth, well-planned lane choice",
  ],

  "Following distance": [
    "following too close",
    "gap less than 3 seconds",
    "didn't increase gap in wet",
    "didn't adjust for large vehicle",
    "maintained safe 3-second gap",
    "adjusted gap for conditions",
  ],

  "Speed compliance": [
    "exceeded speed limit",
    "missed speed limit change",
    "over school-zone limit",
    "missed temporary / roadworks limit",
    "consistently within limit",
    "noticed limit change early",
  ],

  "Speed management": [
    "too slow — impeding traffic",
    "too fast for conditions",
    "harsh acceleration",
    "speed not progressive",
    "matched traffic flow",
    "smooth and progressive",
    "appropriate speed throughout",
  ],

  // ── Signals & Intersections ───────────────────────────────────────────────

  "Communication (signals)": [
    "forgot indicator",
    "indicator too short (under 5 seconds)",
    "indicator not cancelled",
    "wrong indicator used",
    "indicated correctly and timely",
    "intent always clear to others",
  ],

  "Traffic lights": [
    "stopped past stop line",
    "entered intersection on late amber",
    "blocked intersection",
    "didn't give way to pedestrian on green",
    "smooth approach to lights",
    "read light sequence early",
    "correct response to arrows / filter",
  ],

  "Traffic sign compliance": [
    "missed regulatory sign",
    "no response to warning sign",
    "wrong lane from sign",
    "noticed and responded early",
    "correct lane chosen from signs",
  ],

  "Controlled intersections (give way)": [
    "entered on unsafe gap",
    "didn't yield to right-of-way traffic",
    "rolled through without being ready to stop",
    "smooth approach speed",
    "correct yield decision",
    "confident gap selection",
  ],

  "Controlled intersections (stop sign)": [
    "rolling stop — wheels not stationary",
    "stopped past stop line",
    "rushed observation",
    "failed to give way after stop",
    "full controlled stop",
    "thorough L-R-ahead observation",
    "decisive launch when clear",
  ],

  "Uncontrolled intersections": [
    "wrong give-way rule applied",
    "didn't scan all approaches",
    "forgot indicator",
    "failed to slow on approach",
    "correct give-way applied",
    "good approach speed",
    "scanned all directions",
  ],

  "Giving way correctly": [
    "failed to give way",
    "didn't yield to pedestrian at crossing",
    "didn't yield to emergency vehicle",
    "wrong priority at multi-way",
    "yielded correctly every time",
    "good awareness of complex priority",
  ],

  "Turning left at intersections": [
    "forgot indicator",
    "indicator less than 5 seconds",
    "wrong approach lane",
    "didn't give way to pedestrian",
    "turned into wrong lane",
    "smooth, well-judged turn",
    "correct lane entry and exit",
  ],

  "Turning right at intersections": [
    "forgot indicator",
    "didn't give way to oncoming traffic",
    "didn't give way to pedestrian",
    "cut the corner",
    "turned into wrong lane",
    "accurate gap against oncoming",
    "smooth controlled turn",
  ],

  "Roundabouts": [
    "didn't give way to vehicles in roundabout",
    "forgot exit indicator",
    "wrong lane selected",
    "missed mirror check on exit",
    "speed too high entering",
    "correct lane and indication",
    "smooth entry timing",
  ],

  "Lane changing": [
    "mirrors not checked before signalling",
    "indicator too short",
    "missed head check",
    "unsafe gap selected",
    "speed didn't match target lane",
    "forced other vehicle to brake",
    "mirror-signal-head check complete",
    "smooth lane change",
  ],

  // ── Manoeuvres & Parking ──────────────────────────────────────────────────

  "Parallel parking": [
    "too far from kerb",
    "mounted kerb",
    "over 3 movements",
    "missed mirror check",
    "forgot indicator",
    "good final position",
    "smooth entry",
    "completed in minimal movements",
  ],

  "Reverse parking": [
    "too far from kerb",
    "too many movements",
    "too far from front vehicle",
    "misjudged reference points",
    "forgot mirror / blind-spot check",
    "good final position",
    "smooth execution",
  ],

  "Angle parking": [
    "outside bay markings",
    "too fast on approach",
    "forgot indicator",
    "missed mirror check",
    "contact with bay marker",
    "clean single-movement entry",
    "centred in bay",
    "safe reverse out",
  ],

  "Three-Point Turn": [
    "mounted kerb",
    "needed more than 3 movements",
    "missed mirror / surroundings check",
    "dry steering at speed",
    "forgot indicator",
    "failed to give way to passing traffic",
    "smooth transitions",
    "completed in 3 movements",
  ],

  "U-turns": [
    "needed extra movement",
    "forgot right indicator",
    "poor approach position",
    "obstructed traffic",
    "insufficient sight-distance check",
    "smooth one-movement turn",
    "correct road position maintained",
  ],

  // ── Environment-Specific ──────────────────────────────────────────────────

  "Adverse weather conditions": [
    "speed not reduced for conditions",
    "following distance unchanged in wet",
    "headlights not on",
    "wipers not used",
    "sudden input on slippery surface",
    "reduced speed appropriately",
    "good adjustment for conditions",
  ],

  "Night driving": [
    "high beam not dipped for oncoming",
    "high beam on in lit areas",
    "speed not reduced for visibility",
    "cabin light left on",
    "smooth beam transitions",
    "speed suited to headlight range",
    "heightened scanning",
  ],

  "School zones": [
    "over school-zone speed limit",
    "didn't slow on zone entry",
    "rolled past crossing flag",
    "stopped in prohibited zone",
    "reduced speed correctly",
    "good vigilance for children",
  ],

  "Freeway driving": [
    "merged too slowly",
    "merged too fast / cut in",
    "didn't keep left",
    "following too close at speed",
    "late exit lane change",
    "smooth confident merge",
    "good high-speed lane discipline",
  ],

  "Overtaking": [
    "overtook in unsafe / illegal location",
    "missed blind spot before pulling out",
    "forgot indicator",
    "insufficient sight distance",
    "didn't return to left with clearance",
    "safe, well-judged overtake",
    "returned to left correctly",
  ],
};

// ─── Category-level fallbacks ──────────────────────────────────────────────────

const CATEGORY_CHIPS: Record<string, string[]> = {
  "Vehicle Controls & Pre-Drive": [
    "missed mirror check",
    "stalled",
    "rough control",
    "forgot handbrake",
    "smooth control",
    "good technique",
    "needs repetition",
  ],
  "Observation & Hazard Management": [
    "missed mirror check",
    "missed blind spot",
    "slow to identify hazard",
    "didn't scan far enough ahead",
    "good scanning pattern",
    "early hazard identification",
  ],
  "Positioning & Speed": [
    "drifted in lane",
    "wrong speed for conditions",
    "too close to centre",
    "good lane position",
    "appropriate speed",
    "smooth and progressive",
  ],
  "Signals, Signs & Intersections": [
    "forgot indicator",
    "indicator too short",
    "failed to give way",
    "missed sign",
    "correct signal",
    "good gap judgement",
  ],
  "Road Environment": [
    "speed not adjusted for conditions",
    "missed environmental cue",
    "good situational awareness",
    "adapted well to conditions",
  ],
  "Manoeuvres & Parking": [
    "too many movements",
    "mounted kerb",
    "missed mirror check",
    "smooth entry",
    "good final position",
    "needs repetition",
  ],
};

// ─── Generic fallback ──────────────────────────────────────────────────────────

const GENERIC_CHIPS = [
  "missed mirror check",
  "forgot indicator",
  "hesitant",
  "needs repetition",
  "good control",
  "smooth execution",
  "improving",
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns quick-note chip suggestions for a maneuver.
 * Falls back to category chips, then generic chips.
 */
export function getManeuverChips(maneuverName?: string | null, category?: string | null): string[] {
  if (maneuverName && MANEUVER_CHIPS[maneuverName]) {
    return MANEUVER_CHIPS[maneuverName];
  }
  if (category && CATEGORY_CHIPS[category]) {
    return CATEGORY_CHIPS[category];
  }
  return GENERIC_CHIPS;
}
