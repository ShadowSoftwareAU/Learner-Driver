/**
 * Static milestone definitions.
 * Each milestone has an id, name, icon (Lucide icon name), description,
 * and a check function signature. Actual evaluation is in evaluate.ts.
 */

export interface MilestoneDefinition {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  description: string;
  category: "hours" | "maneuvers" | "practice";
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  // ── Hours milestones ─────────────────────────────────────────────────────
  {
    id: "first_lesson",
    name: "First Lesson",
    icon: "Star",
    description: "Logged your very first driving lesson. The journey begins!",
    category: "hours",
  },
  {
    id: "hours_10",
    name: "10 Hours",
    icon: "Clock",
    description: "Reached 10 hours of supervised driving.",
    category: "hours",
  },
  {
    id: "hours_25",
    name: "Quarter Way",
    icon: "Milestone",
    description: "Hit 25 hours — a quarter of the way to your license!",
    category: "hours",
  },
  {
    id: "hours_50",
    name: "Halfway There",
    icon: "Zap",
    description: "50 hours of supervised driving. You're halfway to 100!",
    category: "hours",
  },
  {
    id: "hours_75",
    name: "75 Hours",
    icon: "TrendingUp",
    description: "75 hours logged. The finish line is in sight!",
    category: "hours",
  },
  {
    id: "hours_100",
    name: "Century Driver",
    icon: "Trophy",
    description: "100 hours of supervised driving. Extraordinary commitment!",
    category: "hours",
  },

  // ── Mastery milestones ────────────────────────────────────────────────────
  {
    id: "first_maneuver_mastered",
    name: "First Mastery",
    icon: "CheckCircle",
    description: "Mastered your first driving maneuver. Building the foundation!",
    category: "maneuvers",
  },
  {
    id: "maneuvers_5",
    name: "Skill Builder",
    icon: "BookOpen",
    description: "Mastered 5 different maneuvers. Skills are stacking up!",
    category: "maneuvers",
  },
  {
    id: "maneuvers_10",
    name: "Double Digits",
    icon: "Award",
    description: "10 maneuvers mastered. You're becoming a well-rounded driver.",
    category: "maneuvers",
  },
  {
    id: "maneuvers_20",
    name: "Expert in Progress",
    icon: "Shield",
    description: "Mastered 20 maneuvers — confidence on the road is building fast.",
    category: "maneuvers",
  },
  {
    id: "all_maneuvers",
    name: "Complete Mastery",
    icon: "Crown",
    description: "All maneuvers mastered! You're ready for anything on the road.",
    category: "maneuvers",
  },

  // ── Practice count milestones ─────────────────────────────────────────────
  {
    id: "roundabouts_10",
    name: "Roundabout Rookie",
    icon: "RotateCcw",
    description: "Practiced roundabouts 10 times. Yielding like a pro!",
    category: "practice",
  },
  {
    id: "hill_starts_20",
    name: "Hill Climber",
    icon: "Mountain",
    description: "20 hill starts practiced. No incline can hold you back.",
    category: "practice",
  },
  {
    id: "parking_10",
    name: "Parking Pro",
    icon: "ParkingCircle",
    description: "10 parking maneuvers practiced. Spot found, challenge conquered.",
    category: "practice",
  },
];

export const MILESTONE_MAP = new Map(MILESTONE_DEFINITIONS.map(m => [m.id, m]));

/** Share text templates — use studentName and earnedAt to personalise */
export function buildShareText(milestoneId: string, studentName?: string): string {
  const def = MILESTONE_MAP.get(milestoneId);
  if (!def) return "I just unlocked a milestone on Learner Log! 🎉";
  const who = studentName ? `${studentName} just` : "I just";
  return `${who} unlocked "${def.name}" on Learner Log! ${def.description} 🎉 #LearnerLog #DrivingProgress`;
}
