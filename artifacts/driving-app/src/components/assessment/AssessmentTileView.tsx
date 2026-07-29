import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TileManeuverResult {
  id?: number | null;
  maneuverId?: number | null;
  maneuverName?: string | null;
  competencyLevel?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

interface AssessmentTileViewProps {
  grouped: Record<string, TileManeuverResult[]>;
  renderItem: (item: TileManeuverResult, index: number) => React.ReactNode;
}

// ─── Tile colour palette (one per category, cycles) ──────────────────────────

const TILE_PALETTES = [
  { border: "border-blue-200",    bg: "bg-blue-50/70",    accent: "text-blue-700",    bar: "bg-blue-400"    },
  { border: "border-purple-200",  bg: "bg-purple-50/70",  accent: "text-purple-700",  bar: "bg-purple-400"  },
  { border: "border-emerald-200", bg: "bg-emerald-50/70", accent: "text-emerald-700", bar: "bg-emerald-400" },
  { border: "border-amber-200",   bg: "bg-amber-50/70",   accent: "text-amber-700",   bar: "bg-amber-400"   },
  { border: "border-rose-200",    bg: "bg-rose-50/70",    accent: "text-rose-700",    bar: "bg-rose-400"    },
  { border: "border-cyan-200",    bg: "bg-cyan-50/70",    accent: "text-cyan-700",    bar: "bg-cyan-400"    },
  { border: "border-indigo-200",  bg: "bg-indigo-50/70",  accent: "text-indigo-700",  bar: "bg-indigo-400"  },
];

// ─── Category tile (Level 1) ──────────────────────────────────────────────────

function CategoryTile({
  category,
  items,
  palette,
  onClick,
}: {
  category: string;
  items: TileManeuverResult[];
  palette: (typeof TILE_PALETTES)[number];
  onClick: () => void;
}) {
  const total = items.length;
  const mastered      = items.filter(i => i.competencyLevel === "mastered").length;
  const practiced     = items.filter(i => i.competencyLevel === "practiced").length;
  const attempted     = items.filter(i => i.competencyLevel === "attempted").length;
  const notAttempted  = items.filter(i => !i.competencyLevel || i.competencyLevel === "not_attempted").length;
  const assessed      = total - notAttempted;
  const consistentPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group rounded-xl border-2 p-4 text-left w-full
        transition-all duration-150
        hover:shadow-md hover:-translate-y-0.5
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${palette.border} ${palette.bg}
      `}
    >
      {/* Category name */}
      <p className={`font-semibold text-sm leading-tight mb-3 ${palette.accent}`}>
        {category}
      </p>

      {/* Count + chevron */}
      <div className="flex items-end justify-between gap-1 mb-2">
        <div>
          <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground ml-1">maneuvers</span>
        </div>
        <ChevronRight className={`w-4 h-4 mb-0.5 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity ${palette.accent}`} />
      </div>

      {/* Progress bar — mastered proportion */}
      <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden mb-2.5">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${consistentPct}%` }}
        />
      </div>

      {/* Competency mini-badges */}
      <div className="flex flex-wrap gap-1">
        {mastered > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
            {mastered} Consistent
          </span>
        )}
        {practiced > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
            {practiced} Competent
          </span>
        )}
        {attempted > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            {attempted} Developing
          </span>
        )}
        {assessed === 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            Not assessed
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AssessmentTileView({ grouped, renderItem }: AssessmentTileViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = Object.keys(grouped);

  // ── Level 2: maneuver list for selected category ──────────────────────────
  if (selectedCategory) {
    const items = grouped[selectedCategory] ?? [];
    return (
      <div className="space-y-4">
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1.5 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedCategory(null)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All categories
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">{selectedCategory}</span>
          <span className="text-muted-foreground ml-1">({items.length})</span>
        </div>

        {/* Maneuver rows */}
        <div className="divide-y rounded-xl border border-border overflow-hidden bg-white">
          {items.map((item, idx) => (
            <div key={(item.id as number) ?? (item.maneuverId as number) ?? idx}>
              {renderItem(item, idx)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Level 1: category grid ────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {categories.map((cat, i) => (
        <CategoryTile
          key={cat}
          category={cat}
          items={grouped[cat]}
          palette={TILE_PALETTES[i % TILE_PALETTES.length]}
          onClick={() => setSelectedCategory(cat)}
        />
      ))}
    </div>
  );
}
