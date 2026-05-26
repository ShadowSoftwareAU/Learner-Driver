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
  "Reverse Parallel Parking": {
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
  "U-Turn": {
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
  "Lane Changing": {
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
  "Brake Control": {
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
  "Steering Control": {
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
  "Hill Start": {
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
  "Emergency Stop": {
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
  "Hazard Perception": {
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
