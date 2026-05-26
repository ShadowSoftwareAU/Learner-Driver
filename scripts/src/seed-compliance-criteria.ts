/**
 * seed-compliance-criteria.ts — Populates QSAFE compliance criteria and mastery
 * definitions for key maneuvers. Safe to run multiple times (idempotent updates).
 *
 * Run: pnpm --filter @workspace/scripts run seed-compliance
 */

import { db, pool } from "@workspace/db";
import { maneuversTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── QSAFE Compliance Criteria ──────────────────────────────────────────────

const CRITERIA: Record<string, { complianceCriteria: string; masteryDefinition: string }> = {
  "Parallel parking": {
    complianceCriteria: [
      "Maximum 3 movements (forward/reverse counted separately)",
      "Final position within 500mm of the kerb",
      "Must not mount the kerb at any point",
      "Must check mirrors and blind spots before and during the maneuver",
      "Must indicate for at least 5 seconds before pulling in",
      "Vehicle must be reasonably parallel to the kerb when complete",
      "Must not contact any other vehicle or obstacle",
    ].join("\n"),
    masteryDefinition: [
      "Completes within 3 movements consistently",
      "Final position within 300mm of kerb",
      "Smooth steering and speed control throughout",
      "Checks all mirrors and blind spots without prompting",
      "Confident and calm execution in traffic",
    ].join("\n"),
  },
  "Three-Point Turn": {
    complianceCriteria: [
      "Maximum 3 movements to complete the turn",
      "Must not mount the kerb on either side",
      "Must check mirrors, blind spots, and surroundings before each movement",
      "Must indicate appropriately",
      "Steering must be controlled (no dry steering at speed)",
      "Must give way to any approaching traffic",
    ].join("\n"),
    masteryDefinition: [
      "Completes in exactly 3 movements consistently",
      "Smooth transitions between forward and reverse",
      "Full observation checks before each movement without prompting",
      "Maintains safe distance from kerb on both sides",
      "Confident execution on various road widths",
    ].join("\n"),
  },
  "U-turns": {
    complianceCriteria: [
      "Must check for 'No U-Turn' signs before attempting",
      "Must have clear visibility for at least 100m in both directions",
      "Must indicate right for at least 5 seconds before commencing",
      "Must give way to all other road users",
      "Must check mirrors and blind spots",
      "Must complete in a single continuous movement",
      "Must not mount the kerb or median",
    ].join("\n"),
    masteryDefinition: [
      "Correctly identifies safe and legal U-turn locations",
      "Single smooth movement with appropriate speed",
      "Full observation checks completed independently",
      "Gives way to all traffic without hesitation or confusion",
      "Confident execution in varied traffic conditions",
    ].join("\n"),
  },
  "Lane changing": {
    complianceCriteria: [
      "Must check mirrors (centre and side) before signalling",
      "Must indicate for at least 5 seconds before changing",
      "Must perform a head check (blind spot) immediately before moving",
      "Must maintain a safe gap with vehicles in the target lane",
      "Must not force other vehicles to brake or swerve",
      "Speed must match the flow of the target lane",
    ].join("\n"),
    masteryDefinition: [
      "Mirror-signal-blind spot sequence completed automatically",
      "Smooth lateral movement without speed variation",
      "Appropriate gap selection in varying traffic densities",
      "Confident merging in heavy traffic",
    ].join("\n"),
  },
  "Brake control": {
    complianceCriteria: [
      "Must bring vehicle to a smooth, controlled stop",
      "No harsh or sudden braking unless emergency",
      "Must maintain straight line during braking",
      "Must apply handbrake when stopped on incline",
      "Following distance must allow safe stopping",
    ].join("\n"),
    masteryDefinition: [
      "Consistently smooth progressive braking",
      "Appropriate braking force for road and weather conditions",
      "Can perform emergency stop safely when required",
      "Maintains vehicle control during braking on varied surfaces",
    ].join("\n"),
  },
  "Steering technique": {
    complianceCriteria: [
      "Hands at 9 and 3 (or 10 and 2) position",
      "Push-pull or hand-over-hand technique",
      "Smooth inputs, no jerky movements",
      "Must maintain lane position",
      "No single-hand steering except when operating controls",
    ].join("\n"),
    masteryDefinition: [
      "Smooth, controlled steering at all speeds",
      "Maintains consistent lane position through curves",
      "Appropriate steering input for the speed and road geometry",
      "Recovers smoothly from minor corrections",
    ].join("\n"),
  },
  "Roundabouts": {
    complianceCriteria: [
      "Must give way to vehicles already in the roundabout",
      "Must indicate left when exiting (unless impractical)",
      "Must use correct lane for intended exit",
      "Must check mirrors before entering and exiting",
      "Speed must be appropriate for the roundabout size",
      "Multi-lane: must stay in lane throughout",
    ].join("\n"),
    masteryDefinition: [
      "Correct lane selection for all exit positions",
      "Smooth entry timing without unnecessary stopping",
      "Appropriate speed throughout",
      "Correct indication on entry and exit",
      "Confident navigation of multi-lane roundabouts",
    ].join("\n"),
  },
  "Hill starts": {
    complianceCriteria: [
      "Must not roll back more than 500mm",
      "Must use handbrake or brake-to-accelerator technique",
      "Must check mirrors and blind spots before moving off",
      "Must indicate if pulling out from kerb",
      "Clutch control (manual): smooth engagement, no stalling",
    ].join("\n"),
    masteryDefinition: [
      "No rollback on any gradient",
      "Smooth clutch engagement (manual) or brake release (auto)",
      "Confident starts on steep inclines",
      "Can perform hill start in traffic without hesitation",
    ].join("\n"),
  },
  "Stopping safely": {
    complianceCriteria: [
      "Must stop vehicle as quickly and safely as possible",
      "Must maintain straight line during stop",
      "Must check mirrors after stopping",
      "Must not lock wheels (or ABS activates appropriately)",
      "Vehicle must come to a complete stop",
    ].join("\n"),
    masteryDefinition: [
      "Rapid, controlled stop with minimum stopping distance",
      "Vehicle remains straight and stable",
      "Automatic mirror check after stopping",
      "Calm and controlled response",
    ].join("\n"),
  },
  "Hazard response": {
    complianceCriteria: [
      "Must scan ahead, to sides, and in mirrors regularly",
      "Must identify potential hazards early",
      "Must adjust speed or position in response to hazards",
      "Must maintain appropriate following distance (3-second rule)",
      "Must anticipate actions of other road users",
    ].join("\n"),
    masteryDefinition: [
      "Continuous and systematic scanning pattern",
      "Early identification and response to developing hazards",
      "Appropriate speed adjustment without over-reaction",
      "Predicts behaviour of pedestrians, cyclists, and other vehicles",
      "Commentary drive demonstrates active hazard awareness",
    ].join("\n"),
  },

  // ─── Vehicle control ────────────────────────────────────────────────────
  "Accelerator control": {
    complianceCriteria: [
      "Smooth, progressive throttle application from a stop",
      "No surging, jerking, or over-revving",
      "Throttle eased off well before braking",
      "Speed kept appropriate to the gear and conditions",
    ].join("\n"),
    masteryDefinition: [
      "Consistently smooth throttle inputs in all conditions",
      "Anticipates speed changes and rolls off early",
      "Passengers experience no noticeable surge or jerk",
      "Confident, fuel-efficient use of the accelerator",
    ].join("\n"),
  },
  "Smooth vehicle control": {
    complianceCriteria: [
      "Coordinated use of accelerator, brake, and steering",
      "No abrupt inputs that unsettle the vehicle",
      "Vehicle remains stable through turns and stops",
      "Transitions between actions are blended, not stepped",
    ].join("\n"),
    masteryDefinition: [
      "Inputs are seamless and barely perceptible to passengers",
      "Vehicle stays composed in all common scenarios",
      "Anticipation removes the need for late corrections",
      "Demonstrates a polished, professional driving style",
    ].join("\n"),
  },
  "Moving off safely": {
    complianceCriteria: [
      "Full mirror and blind-spot check before moving",
      "Indicator on for at least 5 seconds before pulling out",
      "Gives way to all approaching traffic",
      "Smooth release of brake/clutch with no rollback",
      "Moves into the correct lane position",
    ].join("\n"),
    masteryDefinition: [
      "Observation sequence completed automatically every time",
      "Selects safe gaps in traffic without hesitation",
      "Smooth, controlled launch on all gradients",
      "Confident in busy or restricted environments",
    ].join("\n"),
  },
  "Clutch control (manual)": {
    complianceCriteria: [
      "Finds the bite point without stalling",
      "No riding the clutch while driving",
      "Smooth engagement when moving off",
      "Clutch fully depressed before selecting a gear",
    ].join("\n"),
    masteryDefinition: [
      "Stall-free starts on any gradient",
      "Precise clutch control in slow-speed manoeuvres",
      "No coasting in neutral or with clutch depressed at speed",
      "Smooth crawling in stop-start traffic",
    ].join("\n"),
  },
  "Gear changes (manual)": {
    complianceCriteria: [
      "Correct gear selected for speed and load",
      "Smooth shifts with matched engine speed",
      "No grinding, missed gears, or over-revving",
      "Hands return to the wheel promptly after shifting",
      "Looks ahead, not at the gear stick, during shifts",
    ].join("\n"),
    masteryDefinition: [
      "Anticipatory gear selection for hills and corners",
      "Rev-matched changes that feel seamless",
      "Block shifts used appropriately when slowing",
      "Eyes stay on the road throughout the shift",
    ].join("\n"),
  },
  "Handbrake use": {
    complianceCriteria: [
      "Applied whenever the vehicle is parked",
      "Applied at extended stops on an incline",
      "Released fully before moving off",
      "Used to prevent rollback on hill starts",
    ].join("\n"),
    masteryDefinition: [
      "Used instinctively in every parking and incline situation",
      "Smooth release coordinated with throttle and clutch",
      "No reliance on the footbrake at long stops",
      "Confident handbrake-assisted hill starts",
    ].join("\n"),
  },

  // ─── Observation & awareness ───────────────────────────────────────────
  "Mirror use & scanning": {
    complianceCriteria: [
      "Mirrors checked every 5–8 seconds",
      "Mirrors checked before signalling, braking, or turning",
      "Centre and side mirrors both used",
      "Scanning extends well ahead, not just immediately in front",
    ].join("\n"),
    masteryDefinition: [
      "Continuous scanning pattern is second nature",
      "Always aware of vehicles approaching from behind",
      "Combines mirror checks with blind-spot checks fluidly",
      "Builds a complete mental picture of surrounding traffic",
    ].join("\n"),
  },
  "Blindspot checks": {
    complianceCriteria: [
      "Head check performed before every lane change",
      "Head check before merging or pulling out",
      "Head check before opening the door when parked",
      "Check is a full head turn, not just a glance",
    ].join("\n"),
    masteryDefinition: [
      "Head checks are automatic and never skipped",
      "Performed without losing lane position or speed",
      "Combined naturally with mirror checks and signalling",
      "Confident execution even in heavy traffic",
    ].join("\n"),
  },
  "Observation at intersections": {
    complianceCriteria: [
      "Looks left, right, and ahead before entering",
      "Confirms cross-traffic has stopped or is yielding",
      "Checks for pedestrians and cyclists in crossings",
      "Does not roll into the intersection while looking",
    ].join("\n"),
    masteryDefinition: [
      "Thorough scanning completed without prompting",
      "Identifies hidden hazards (parked cars, pillars, sun glare)",
      "Adjusts vehicle position for better sightlines",
      "Decisive entry once the intersection is confirmed clear",
    ].join("\n"),
  },
  "Decision making": {
    complianceCriteria: [
      "Makes timely choices at intersections and merges",
      "Commits to a decision once made (no hesitation)",
      "Choices reflect road rules and current conditions",
      "Avoids creating risk for other road users",
    ].join("\n"),
    masteryDefinition: [
      "Reads situations early and plans ahead",
      "Decisions are consistently safe and lawful",
      "Stays composed under pressure or in unexpected events",
      "Communicates intentions clearly to other road users",
    ].join("\n"),
  },
  "Interaction with other road users": {
    complianceCriteria: [
      "Predictable, courteous behaviour at all times",
      "Gives way correctly and lets faster traffic pass",
      "No aggressive gestures, horn use, or close following",
      "Makes eye contact / acknowledges where appropriate",
    ].join("\n"),
    masteryDefinition: [
      "Cooperative driving style that smooths traffic flow",
      "Manages disagreements calmly without escalation",
      "Anticipates and accommodates errors by others",
      "Models the behaviour expected of an experienced driver",
    ].join("\n"),
  },
  "Pedestrian & cyclist hazards": {
    complianceCriteria: [
      "Scans for pedestrians at crossings, bus stops, and schools",
      "Gives at least 1m clearance when passing cyclists (1.5m >60 km/h)",
      "Checks for cyclists before opening doors or turning across lanes",
      "Slows or stops for vulnerable road users when in doubt",
    ].join("\n"),
    masteryDefinition: [
      "Actively looks for vulnerable users in all environments",
      "Adjusts position and speed early to give safe clearance",
      "Anticipates child, elderly, and inattentive pedestrian behaviour",
      "Confident sharing the road with cyclists in traffic",
    ].join("\n"),
  },

  // ─── Positioning & speed ───────────────────────────────────────────────
  "Lane position": {
    complianceCriteria: [
      "Vehicle kept centred in the lane",
      "No drifting across lane markings",
      "Adjusts position safely around parked cars or hazards",
      "Returns to centre promptly after any adjustment",
    ].join("\n"),
    masteryDefinition: [
      "Consistent centred position at all speeds and on curves",
      "Subtle adjustments made early for hazards or width changes",
      "Holds line confidently in narrow lanes and roadworks",
      "Lane discipline maintained without conscious effort",
    ].join("\n"),
  },
  "Positioning on road": {
    complianceCriteria: [
      "Stays in the correct lane for direction of travel",
      "Keeps left unless overtaking on multi-lane roads",
      "Sets up early for the correct lane before turns",
      "Maintains safe lateral distance from kerbs and other vehicles",
    ].join("\n"),
    masteryDefinition: [
      "Lane selection planned several intersections ahead",
      "Smooth, early positioning with no last-minute changes",
      "Correct placement on unmarked or narrowing roads",
      "Reads road geometry to choose the best line",
    ].join("\n"),
  },
  "Following distance": {
    complianceCriteria: [
      "Minimum 3-second gap in dry conditions",
      "Minimum 4-second gap in wet or poor visibility",
      "Adjusts gap for larger vehicles or heavy loads",
      "Increases gap when being tailgated",
    ].join("\n"),
    masteryDefinition: [
      "Maintains correct gap automatically in all conditions",
      "Adjusts gap proactively for weather, load, and traffic",
      "Resists pressure from tailgaters and keeps a safe buffer",
      "Following distance gives time for smooth, anticipatory driving",
    ].join("\n"),
  },
  "Speed compliance": {
    complianceCriteria: [
      "Never exceeds the posted speed limit",
      "Observes temporary, school, and roadworks limits",
      "Slows appropriately when limit reduces",
      "Speedometer checked regularly",
    ].join("\n"),
    masteryDefinition: [
      "Speed is always at or below the limit without prompting",
      "Notices and reacts to limit changes early",
      "No reliance on warnings or signage from passengers",
      "Demonstrates awareness of default urban/rural limits",
    ].join("\n"),
  },
  "Speed management": {
    complianceCriteria: [
      "Speed appropriate for road, weather, and traffic conditions",
      "Slows for curves, crests, and reduced visibility",
      "No excessive slowness that obstructs traffic flow",
      "Smooth transitions between speeds",
    ].join("\n"),
    masteryDefinition: [
      "Speed selection feels effortless and always suitable",
      "Reads upcoming conditions and adjusts in advance",
      "Maintains flow without surging or braking late",
      "Confident driving at higher speeds when conditions allow",
    ].join("\n"),
  },

  // ─── Signs, signals, intersections ─────────────────────────────────────
  "Communication (signals)": {
    complianceCriteria: [
      "Indicator used for every turn, lane change, and merge",
      "Signal on for at least 5 seconds before the action",
      "Indicator cancelled after the manoeuvre is complete",
      "Brake lights and reverse lights used appropriately",
    ].join("\n"),
    masteryDefinition: [
      "Signals are timely, accurate, and never forgotten",
      "Intent is always clear to other road users",
      "Indicator timing is matched to the manoeuvre",
      "Hand signals used correctly if indicators fail",
    ].join("\n"),
  },
  "Traffic lights": {
    complianceCriteria: [
      "Stops behind the stop line on red and amber when safe",
      "Does not enter an intersection that cannot be cleared",
      "Proceeds promptly and safely on green",
      "Gives way to pedestrians on green when turning",
    ].join("\n"),
    masteryDefinition: [
      "Reads light sequences early and plans braking accordingly",
      "Confident handling of arrow phases and filter signals",
      "Never blocks an intersection or pedestrian crossing",
      "Smooth response to changing lights without harsh braking",
    ].join("\n"),
  },
  "Traffic sign compliance": {
    complianceCriteria: [
      "Observes and obeys all regulatory signs",
      "Responds to warning signs by adjusting speed or position",
      "Correctly interprets lane-use and direction signs",
      "Acknowledges temporary and roadworks signage",
    ].join("\n"),
    masteryDefinition: [
      "Signs are noticed and acted on well in advance",
      "No missed regulatory signs in any environment",
      "Uses information signs to plan route and lane changes",
      "Demonstrates strong knowledge of less common signs",
    ].join("\n"),
  },
  "Controlled intersections (give way)": {
    complianceCriteria: [
      "Slows to a speed that allows stopping if required",
      "Yields to all traffic with right of way",
      "Does not enter until a safe gap is available",
      "Mirrors and head checks performed before proceeding",
    ].join("\n"),
    masteryDefinition: [
      "Smooth, well-judged approach speed every time",
      "Confident gap selection without unnecessary stopping",
      "Correctly yields in complex multi-direction situations",
      "Reads other drivers' intentions before committing",
    ].join("\n"),
  },
  "Controlled intersections (stop sign)": {
    complianceCriteria: [
      "Comes to a complete stop at or before the stop line",
      "Wheels fully stationary, not a rolling stop",
      "Looks left, right, and ahead before proceeding",
      "Gives way to all other traffic and pedestrians",
    ].join("\n"),
    masteryDefinition: [
      "Full, controlled stop achieved every time",
      "Observation is thorough and unhurried",
      "Confident, decisive launch once safe",
      "Correct handling of stop signs at multi-way intersections",
    ].join("\n"),
  },
  "Uncontrolled intersections": {
    complianceCriteria: [
      "Applies the correct give-way rules (right, T-intersection, etc.)",
      "Slows on approach and is prepared to stop",
      "Scans all approaches for traffic and pedestrians",
      "Communicates intent with indicators",
    ].join("\n"),
    masteryDefinition: [
      "Right-of-way decisions are correct and prompt",
      "Reads ambiguous situations and acts safely",
      "Maintains traffic flow without unnecessary hesitation",
      "Confident in residential, rural, and unfamiliar areas",
    ].join("\n"),
  },
  "Giving way correctly": {
    complianceCriteria: [
      "Applies give-way rules at all intersection types",
      "Yields to pedestrians on crossings and at slip lanes",
      "Yields to emergency vehicles with active warnings",
      "Yields to buses signalling to leave a bus stop (where required)",
    ].join("\n"),
    masteryDefinition: [
      "Give-way decisions are consistently correct without thought",
      "Anticipates situations where right of way is unclear",
      "Communicates yielding clearly through speed and position",
      "Strong working knowledge of less common give-way rules",
    ].join("\n"),
  },
  "Turning left at intersections": {
    complianceCriteria: [
      "Signals left at least 5 seconds before turning",
      "Approaches in the left lane (or marked turn lane)",
      "Gives way to pedestrians on the road being entered",
      "Turns into the left-most available lane",
      "Indicator cancelled after the turn",
    ].join("\n"),
    masteryDefinition: [
      "Smooth, well-judged turn at a safe speed",
      "Correct lane entry and exit every time",
      "Confident handling of slip lanes and acute corners",
      "No conflict with pedestrians or following traffic",
    ].join("\n"),
  },
  "Turning right at intersections": {
    complianceCriteria: [
      "Signals right at least 5 seconds before turning",
      "Approaches in the right lane (or marked turn lane)",
      "Gives way to oncoming traffic and pedestrians",
      "Turns into the correct lane on the new road",
      "Does not cut the corner of the intersection",
    ].join("\n"),
    masteryDefinition: [
      "Accurate gap judgement against oncoming traffic",
      "Smooth, controlled turn at appropriate speed",
      "Correct lane discipline through and after the turn",
      "Confident handling of filter and arrow phases",
    ].join("\n"),
  },

  // ─── Environment-specific ──────────────────────────────────────────────
  "Adverse weather conditions": {
    complianceCriteria: [
      "Reduces speed for rain, fog, or low visibility",
      "Increases following distance in wet conditions",
      "Headlights on when visibility is reduced",
      "Wipers and demisters used appropriately",
      "Avoids sudden steering or braking on slippery surfaces",
    ].join("\n"),
    masteryDefinition: [
      "Proactively adjusts driving plan for forecast conditions",
      "Maintains vehicle control on wet or slippery surfaces",
      "Reads water flow, glare, and visibility cues early",
      "Confident, unhurried response to deteriorating weather",
    ].join("\n"),
  },
  "Night driving": {
    complianceCriteria: [
      "Headlights on at all times after dusk",
      "High beam used appropriately and dipped for other traffic",
      "Speed reduced to suit available visibility",
      "Cabin lights kept off to preserve night vision",
    ].join("\n"),
    masteryDefinition: [
      "Smooth transitions between high and low beam",
      "Confident judgement of distance and speed at night",
      "Manages glare without losing road awareness",
      "Heightened scanning for unlit hazards and wildlife",
    ].join("\n"),
  },
  "School zones": {
    complianceCriteria: [
      "Observes posted school-zone speed limit during active hours",
      "Increased vigilance for children near crossings and buses",
      "Stops fully for school-crossing supervisors and flags",
      "Does not park, stop, or U-turn where prohibited near schools",
    ].join("\n"),
    masteryDefinition: [
      "Speed and observation adjust automatically on entering the zone",
      "Anticipates unpredictable child behaviour",
      "Patient, courteous handling of busy drop-off / pick-up periods",
      "Strong knowledge of school-zone time windows in their region",
    ].join("\n"),
  },
  "Freeway driving": {
    complianceCriteria: [
      "Merges at traffic speed using the on-ramp effectively",
      "Keeps left except when overtaking",
      "Maintains safe following distance at highway speeds",
      "Plans early for exits and lane changes",
      "Does not stop or reverse on the freeway except in emergency",
    ].join("\n"),
    masteryDefinition: [
      "Smooth, confident merges into fast-moving traffic",
      "Reads traffic patterns several vehicles ahead",
      "Lane changes are early, signalled, and well-spaced",
      "Composed handling of heavy traffic and roadworks at speed",
    ].join("\n"),
  },
  "Overtaking": {
    complianceCriteria: [
      "Only overtakes where legal and safe",
      "Checks mirrors, blind spot, and signals before pulling out",
      "Has clear sight distance for the entire manoeuvre",
      "Completes the overtake without exceeding the speed limit",
      "Returns to the left lane with safe clearance ahead",
    ].join("\n"),
    masteryDefinition: [
      "Accurate judgement of closing speed and gap length",
      "Decisive, smooth completion of the manoeuvre",
      "Aborts safely if conditions change",
      "Confident overtaking of trucks, cyclists, and slow vehicles",
    ].join("\n"),
  },

  // ─── Pre-drive & parking ───────────────────────────────────────────────
  "Pre-drive safety checks": {
    complianceCriteria: [
      "Walk-around inspection for damage, leaks, and tyre condition",
      "Lights, indicators, and brake lights confirmed working",
      "Windows and mirrors clean and unobstructed",
      "Loose items in cabin secured",
      "Doors closed and seatbelts fastened by all occupants",
    ].join("\n"),
    masteryDefinition: [
      "Routine walk-around and checks completed without prompting",
      "Spots and reports minor faults early",
      "Cabin and load secured every trip",
      "Pre-drive routine becomes a consistent, ingrained habit",
    ].join("\n"),
  },
  "Seating position & mirrors": {
    complianceCriteria: [
      "Seat adjusted for full reach of pedals and wheel",
      "Headrest aligned with the top of the head",
      "Seatbelt worn correctly across hips and shoulder",
      "Centre and side mirrors adjusted to minimise blind spots",
      "Steering wheel in a safe position relative to the chest",
    ].join("\n"),
    masteryDefinition: [
      "Setup completed automatically before every drive",
      "Mirror coverage eliminates avoidable blind spots",
      "Posture supports control and reduces fatigue on long drives",
      "Adjusts setup correctly in unfamiliar vehicles",
    ].join("\n"),
  },
  "Angle parking": {
    complianceCriteria: [
      "Approaches at low speed in the correct lane",
      "Indicates intent before turning into the bay",
      "Vehicle fits within the bay markings",
      "Does not contact adjacent vehicles or bay markers",
      "Mirror and blind-spot checks performed",
    ].join("\n"),
    masteryDefinition: [
      "Single smooth entry without correction",
      "Vehicle centred within the bay every time",
      "Confident in tight or angled bays",
      "Reverses out safely with full observation",
    ].join("\n"),
  },
  "Reverse parking": {
    complianceCriteria: [
      "Mirror and blind-spot checks before and during the manoeuvre",
      "Indicator used to communicate intent",
      "Vehicle ends within the bay or kerb-side markings",
      "No contact with kerbs, vehicles, or obstacles",
      "Maximum of one corrective movement permitted",
    ].join("\n"),
    masteryDefinition: [
      "Single smooth reverse with minimal correction",
      "Vehicle accurately centred in the bay",
      "Confident handling of tight or angled spaces",
      "Continuous observation throughout, not just over one shoulder",
    ].join("\n"),
  },
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📋 Seeding QSAFE compliance criteria...\n");

  const allManeuvers = await db.select().from(maneuversTable);
  let updated = 0;

  for (const maneuver of allManeuvers) {
    const criteria = CRITERIA[maneuver.name];
    if (criteria) {
      await db.update(maneuversTable)
        .set({
          complianceCriteria: criteria.complianceCriteria,
          masteryDefinition: criteria.masteryDefinition,
        })
        .where(eq(maneuversTable.id, maneuver.id));
      console.log(`  ✅ ${maneuver.name}`);
      updated++;
    }
  }

  console.log(`\n📊 Updated ${updated} of ${allManeuvers.length} maneuvers with compliance criteria.`);
  console.log("✅ Compliance criteria seed complete.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => pool.end());
