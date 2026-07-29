/**
 * DualDialProgress — concentric SVG ring indicator for the Student Dashboard.
 *
 * Outer ring (amber/gold) → hours progress toward the 100-hr requirement.
 * Inner ring (green)      → maneuver competency (# at "Consistent Skills" / total).
 *
 * Hours are allowed to exceed 100 — the ring caps at full but shows "100+" and
 * a deeper gold colour so the student can see they have the hours but still need
 * to complete their maneuver skills.
 */

import { CheckCircle, AlertTriangle, GraduationCap, Users, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Geometry constants ───────────────────────────────────────────────────────

const CX = 110;
const CY = 110;
const OUTER_R = 88;
const INNER_R = 62;
const STROKE = 16;
const OUTER_CIRC = 2 * Math.PI * OUTER_R; // ≈ 552.9
const INNER_CIRC = 2 * Math.PI * INNER_R; // ≈ 389.6

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ringOffset(circumference: number, pct: number): number {
  return circumference * (1 - Math.min(pct, 1));
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ─── Sub-component: legend row ────────────────────────────────────────────────

function LegendRow({
  color,
  label,
  sublabel,
  pct,
  trackColor,
  fillColor,
  badge,
}: {
  color: string;
  label: string;
  sublabel: string;
  pct: number;
  trackColor: string;
  fillColor: string;
  badge?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-3 h-3 rounded-full shrink-0 ${color}`} />
        <span className="text-sm font-semibold">{label}</span>
        {badge}
      </div>
      <p className="text-xs text-muted-foreground mb-1.5 pl-5">{sublabel}</p>
      <div className={`w-full rounded-full h-2 overflow-hidden ${trackColor}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${fillColor}`}
          style={{ width: `${Math.min(pct * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DualDialProgressProps {
  /** Effective total hours (QLD-adjusted if applicable). */
  hoursLogged: number;
  /** Required hours threshold — 100 in QLD. */
  hoursRequired?: number;
  /** Number of maneuvers rated at "Consistent Skills" level. */
  maneuvarsCompleted: number;
  /** Total maneuvers in the assessment (44 for QSAFE). */
  totalManeuvers: number;
  /** Whether the QLD 3× multiplier applies — changes the subtitle copy. */
  isQLD?: boolean;
  /** Raw instructor hours (shown in legend when isQLD). */
  instructorHours?: number;
  /** Raw supervised hours (shown in legend when isQLD). */
  supervisedHours?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DualDialProgress({
  hoursLogged,
  hoursRequired = 100,
  maneuvarsCompleted,
  totalManeuvers,
  isQLD = false,
  instructorHours,
  supervisedHours,
}: DualDialProgressProps) {
  const hoursPct = hoursLogged / hoursRequired;
  const hoursOverflow = hoursLogged >= hoursRequired;
  const maneuverPct = totalManeuvers > 0 ? maneuvarsCompleted / totalManeuvers : 0;
  const bothComplete = hoursOverflow && maneuverPct >= 1;
  const hoursOnly = hoursOverflow && maneuverPct < 1;

  const outerOffset = ringOffset(OUTER_CIRC, hoursPct);
  const innerOffset = ringOffset(INNER_CIRC, maneuverPct);

  // Colour shifts when requirement is met
  const outerStroke = hoursOverflow ? "#d97706" : "#f59e0b"; // amber-600 / amber-400
  const innerStroke = maneuverPct >= 1 ? "#16a34a" : "#22c55e"; // green-600 / green-500

  return (
    <Card className={bothComplete ? "border-green-300 bg-green-50/20" : "border-border"}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">

          {/* ── Dual SVG dial ── */}
          <div className="relative shrink-0 w-44 h-44 sm:w-52 sm:h-52">
            <svg viewBox="0 0 220 220" className="w-full h-full">
              {/* Rotate rings to start at 12 o'clock */}
              <g transform={`rotate(-90, ${CX}, ${CY})`}>
                {/* Outer track */}
                <circle
                  cx={CX} cy={CY} r={OUTER_R}
                  fill="none"
                  stroke="#fef3c7"
                  strokeWidth={STROKE}
                />
                {/* Outer progress — hours */}
                <circle
                  cx={CX} cy={CY} r={OUTER_R}
                  fill="none"
                  stroke={outerStroke}
                  strokeWidth={STROKE}
                  strokeDasharray={OUTER_CIRC}
                  strokeDashoffset={outerOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
                />
                {/* Inner track */}
                <circle
                  cx={CX} cy={CY} r={INNER_R}
                  fill="none"
                  stroke="#dcfce7"
                  strokeWidth={STROKE}
                />
                {/* Inner progress — maneuvers */}
                <circle
                  cx={CX} cy={CY} r={INNER_R}
                  fill="none"
                  stroke={innerStroke}
                  strokeWidth={STROKE}
                  strokeDasharray={INNER_CIRC}
                  strokeDashoffset={innerOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) 0.2s" }}
                />
              </g>
            </svg>

            {/* Center text overlay — not rotated */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {bothComplete ? (
                <>
                  <CheckCircle className="w-7 h-7 text-green-600 mb-1" />
                  <span className="text-[11px] font-bold text-green-700 leading-tight px-2">
                    Ready for<br />Test!
                  </span>
                </>
              ) : (
                <>
                  {/* Hours — amber */}
                  <span className={`text-xl font-extrabold leading-none ${hoursOverflow ? "text-amber-600" : "text-amber-500"}`}>
                    {hoursLogged >= hoursRequired ? `${fmt(hoursLogged)}` : fmt(hoursLogged)}
                    {hoursOverflow && hoursLogged > hoursRequired && (
                      <span className="text-xs align-super">+</span>
                    )}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold tracking-wide">HRS</span>
                  {/* Divider */}
                  <div className="w-6 border-t border-border my-1" />
                  {/* Maneuvers — green */}
                  <span className={`text-base font-extrabold leading-none ${maneuverPct >= 1 ? "text-green-600" : "text-green-500"}`}>
                    {maneuvarsCompleted}/{totalManeuvers}
                  </span>
                  <span className="text-[10px] text-green-400 font-semibold tracking-wide">SKILLS</span>
                </>
              )}
            </div>
          </div>

          {/* ── Legend + detail ── */}
          <div className="flex-1 w-full space-y-5">

            {/* Title */}
            <div>
              <h2 className="font-bold text-base">Licence Readiness</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Both rings must be complete before you can apply for your provisional licence.
              </p>
            </div>

            {/* Hours row */}
            <LegendRow
              color="bg-amber-400"
              label="Driving Hours"
              sublabel={
                isQLD
                  ? `${fmt(instructorHours ?? 0)} instructor hrs × 3 + ${fmt(supervisedHours ?? 0)} supervised = ${fmt(hoursLogged)} effective hrs`
                  : `${fmt(hoursLogged)} of ${hoursRequired} hours completed`
              }
              pct={hoursPct}
              trackColor="bg-amber-100"
              fillColor={hoursOverflow ? "bg-amber-600" : "bg-amber-400"}
              badge={
                hoursOverflow ? (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-300 bg-amber-100 text-amber-800 gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5" /> Met
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {fmt(Math.max(hoursRequired - hoursLogged, 0))} hrs to go
                  </span>
                )
              }
            />

            {/* QLD breakdown micro-row */}
            {isQLD && (
              <div className="flex gap-4 text-xs text-muted-foreground pl-5 -mt-3">
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> {fmt(instructorHours ?? 0)} instructor
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {fmt(supervisedHours ?? 0)} supervised
                </span>
              </div>
            )}

            {/* Maneuver row */}
            <LegendRow
              color="bg-green-500"
              label="Maneuver Skills"
              sublabel={`${maneuvarsCompleted} of ${totalManeuvers} skills at Consistent Skills level`}
              pct={maneuverPct}
              trackColor="bg-green-100"
              fillColor={maneuverPct >= 1 ? "bg-green-600" : "bg-green-500"}
              badge={
                maneuverPct >= 1 ? (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-green-300 bg-green-100 text-green-800 gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5" /> Met
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    {totalManeuvers - maneuvarsCompleted} remaining
                  </span>
                )
              }
            />

            {/* Callout banners */}
            {bothComplete && (
              <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-green-800">
                  You've met both requirements — speak with your instructor about booking your provisional licence test!
                </p>
              </div>
            )}

            {hoursOnly && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  You have your hours — keep working on the remaining{" "}
                  <strong>{totalManeuvers - maneuvarsCompleted} skill{totalManeuvers - maneuvarsCompleted !== 1 ? "s" : ""}</strong> to complete your training.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
