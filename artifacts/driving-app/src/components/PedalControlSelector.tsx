/**
 * PedalControlSelector — safety-critical field required at assessment start.
 * Clearly communicates who controls the accelerator/brake during this lesson.
 */
import { cn } from "@/lib/utils";
import { PedalOperator, PedalOperatorLabel, PedalOperatorDescription } from "@/lib/enums";
import { AlertTriangle, User, Users, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  value: PedalOperator | "";
  onChange: (value: PedalOperator) => void;
  disabled?: boolean;
  showDescriptions?: boolean;
  className?: string;
};

const ICONS: Record<PedalOperator, React.ReactNode> = {
  student: <User className="w-4 h-4" />,
  instructor: <ShieldCheck className="w-4 h-4" />,
  shared: <Users className="w-4 h-4" />,
};

const VARIANTS: Record<PedalOperator, string> = {
  student: "border-blue-300 bg-blue-50 text-blue-900 data-[selected]:border-blue-600 data-[selected]:bg-blue-100",
  instructor: "border-amber-300 bg-amber-50 text-amber-900 data-[selected]:border-amber-600 data-[selected]:bg-amber-100",
  shared: "border-green-300 bg-green-50 text-green-900 data-[selected]:border-green-600 data-[selected]:bg-green-100",
};

const ORDER: PedalOperator[] = ["student", "instructor", "shared"];

export function PedalControlSelector({ value, onChange, disabled, showDescriptions = true, className }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        Pedal control — who operates accelerator &amp; brake?
        <Badge variant="destructive" className="text-xs py-0">Required</Badge>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ORDER.map(op => {
          const isSelected = value === op;
          return (
            <button
              key={op}
              type="button"
              disabled={disabled}
              data-selected={isSelected || undefined}
              onClick={() => onChange(op)}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-lg border-2 px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed",
                VARIANTS[op],
                isSelected && "ring-2 ring-offset-1 ring-current/40",
              )}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                {ICONS[op]}
                <span>{PedalOperatorLabel[op]}</span>
              </div>
              {showDescriptions && (
                <p className="text-xs opacity-70 leading-snug">{PedalOperatorDescription[op]}</p>
              )}
              {isSelected && (
                <span className="absolute top-2 right-2 text-xs font-bold opacity-60">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {!value && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Please select who controls the pedals before starting.
        </p>
      )}
    </div>
  );
}

/**
 * Read-only display badge for pedal operator status — used in handover/briefing cards.
 */
export function PedalControlBadge({ operator }: { operator: string | null | undefined }) {
  if (!operator) return null;
  const op = operator as PedalOperator;
  const colors: Record<string, string> = {
    student: "bg-blue-100 text-blue-800 border-blue-300",
    instructor: "bg-amber-100 text-amber-800 border-amber-300",
    shared: "bg-green-100 text-green-800 border-green-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", colors[op] ?? "bg-muted text-muted-foreground")}>
      {ICONS[op as PedalOperator] ?? null}
      {PedalOperatorLabel[op] ?? op}
    </span>
  );
}
