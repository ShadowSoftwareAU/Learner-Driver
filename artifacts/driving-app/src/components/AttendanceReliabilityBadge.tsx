/**
 * AttendanceReliabilityBadge — shows a student's no-show history at a glance.
 * Color-coded: green = reliable, amber = some issues, red = frequent no-shows.
 */
import { cn } from "@/lib/utils";
import { UserX, CheckCircle, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  noShowCount: number;
  attendanceReliabilityScore?: number | null;
  className?: string;
  showLabel?: boolean;
};

function getLevel(score: number | null | undefined, noShowCount: number) {
  if (score !== null && score !== undefined) {
    if (score >= 90) return "reliable";
    if (score >= 60) return "some_issues";
    return "frequent";
  }
  // Fallback from noShowCount only
  if (noShowCount === 0) return "reliable";
  if (noShowCount <= 2) return "some_issues";
  return "frequent";
}

const CONFIG = {
  reliable: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    label: "Reliable",
    className: "bg-green-50 text-green-800 border-green-300",
    tooltip: "No attendance issues on record.",
  },
  some_issues: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: "Some issues",
    className: "bg-amber-50 text-amber-800 border-amber-300",
    tooltip: "A few no-shows on record — consider confirming closer to the lesson.",
  },
  frequent: {
    icon: <UserX className="w-3.5 h-3.5" />,
    label: "Frequent no-shows",
    className: "bg-red-50 text-red-800 border-red-300",
    tooltip: "Multiple no-shows recorded. Requires advance confirmation.",
  },
} as const;

export function AttendanceReliabilityBadge({ noShowCount, attendanceReliabilityScore, className, showLabel = true }: Props) {
  const level = getLevel(attendanceReliabilityScore, noShowCount);
  const { icon, label, className: colorClass, tooltip } = CONFIG[level];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-default select-none",
              colorClass,
              className,
            )}
          >
            {icon}
            {showLabel ? label : null}
            {noShowCount > 0 && (
              <span className="font-bold">
                ({noShowCount} no-show{noShowCount !== 1 ? "s" : ""})
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
