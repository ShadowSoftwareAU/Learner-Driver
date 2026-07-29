import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectionManeuver {
  id: number;
  name: string;
  category: string;
  [key: string]: unknown;
}

interface SelectionTileViewProps {
  grouped: Record<string, SelectionManeuver[]>;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: (ids: number[]) => void;
  getImage?: (m: SelectionManeuver) => string | null;
}

// ─── Colour palettes ──────────────────────────────────────────────────────────

const TILE_PALETTES = [
  { border: "border-blue-200",    bg: "bg-blue-50/70",    accent: "text-blue-700"    },
  { border: "border-purple-200",  bg: "bg-purple-50/70",  accent: "text-purple-700"  },
  { border: "border-emerald-200", bg: "bg-emerald-50/70", accent: "text-emerald-700" },
  { border: "border-amber-200",   bg: "bg-amber-50/70",   accent: "text-amber-700"   },
  { border: "border-rose-200",    bg: "bg-rose-50/70",    accent: "text-rose-700"    },
  { border: "border-cyan-200",    bg: "bg-cyan-50/70",    accent: "text-cyan-700"    },
  { border: "border-indigo-200",  bg: "bg-indigo-50/70",  accent: "text-indigo-700"  },
];

// ─── L1: Category selection tile ─────────────────────────────────────────────

function CategorySelectionTile({
  category,
  items,
  selectedIds,
  palette,
  onClick,
}: {
  category: string;
  items: SelectionManeuver[];
  selectedIds: Set<number>;
  palette: (typeof TILE_PALETTES)[number];
  onClick: () => void;
}) {
  const total    = items.length;
  const selected = items.filter(m => selectedIds.has(m.id)).length;
  const pct      = total > 0 ? Math.round((selected / total) * 100) : 0;

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
        ${selected > 0 ? "ring-2 ring-offset-1 ring-primary/30" : ""}
      `}
    >
      <p className={`font-semibold text-sm leading-tight mb-3 ${palette.accent}`}>
        {category}
      </p>
      <div className="flex items-end justify-between gap-1 mb-2">
        <div>
          <span className="text-2xl font-bold tabular-nums text-foreground">{selected}</span>
          <span className="text-xs text-muted-foreground ml-1">/ {total}</span>
        </div>
        <ChevronRight className={`w-4 h-4 mb-0.5 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity ${palette.accent}`} />
      </div>
      {/* Selection progress bar */}
      <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        {selected === 0
          ? "None selected"
          : selected === total
            ? "All selected"
            : `${selected} selected`}
      </p>
    </button>
  );
}

// ─── L2: Maneuver selection tile ──────────────────────────────────────────────

function ManeuverSelectionTile({
  maneuver,
  isChecked,
  onToggle,
  getImage,
}: {
  maneuver: SelectionManeuver;
  isChecked: boolean;
  onToggle: () => void;
  getImage?: (m: SelectionManeuver) => string | null;
}) {
  const img = getImage?.(maneuver) ?? null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        flex flex-col rounded-xl border-2 overflow-hidden text-left w-full
        transition-all duration-150 hover:shadow-md
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isChecked
          ? "border-primary shadow-md ring-2 ring-primary/30 bg-primary/5"
          : "border-border bg-white hover:-translate-y-0.5"
        }
      `}
    >
      <div className="w-full aspect-square bg-gray-100 overflow-hidden flex items-center justify-center relative">
        {img
          ? <img src={img} alt={maneuver.name} className="w-full h-full object-cover" />
          : <ImageIcon className="w-8 h-8 text-gray-300" />
        }
        {/* Checkbox overlay — top-right corner */}
        <span
          className="absolute top-1.5 right-1.5 pointer-events-none"
          aria-hidden="true"
        >
          <Checkbox
            checked={isChecked}
            className="h-5 w-5 border-2 border-white shadow-md bg-white/90 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            tabIndex={-1}
          />
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium leading-snug text-foreground line-clamp-2">{maneuver.name}</p>
      </div>
    </button>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ parts }: { parts: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex items-center gap-1 text-sm flex-wrap min-w-0">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && <span className="text-muted-foreground shrink-0">/</span>}
          {p.onClick ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1 text-muted-foreground hover:text-foreground shrink-0"
              onClick={p.onClick}
            >
              {i === 0 && <ChevronLeft className="w-3.5 h-3.5" />}
              {p.label}
            </Button>
          ) : (
            <span className="font-medium text-foreground truncate">{p.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SelectionTileView({
  grouped,
  selectedIds,
  onToggle,
  onSelectAll,
  getImage,
}: SelectionTileViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── L2: Maneuver grid for chosen category ─────────────────────────────────
  if (selectedCategory) {
    const items = grouped[selectedCategory] ?? [];
    const allSelected = items.length > 0 && items.every(m => selectedIds.has(m.id));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Breadcrumb
            parts={[
              { label: "All categories", onClick: () => setSelectedCategory(null) },
              { label: `${selectedCategory} (${items.length})` },
            ]}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-sm h-9 shrink-0"
            onClick={() => onSelectAll(items.map(m => m.id))}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map(m => (
            <ManeuverSelectionTile
              key={m.id}
              maneuver={m}
              isChecked={selectedIds.has(m.id)}
              onToggle={() => onToggle(m.id)}
              getImage={getImage}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── L1: Category grid ─────────────────────────────────────────────────────
  const categories = Object.keys(grouped);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {categories.map((cat, i) => (
        <CategorySelectionTile
          key={cat}
          category={cat}
          items={grouped[cat]}
          selectedIds={selectedIds}
          palette={TILE_PALETTES[i % TILE_PALETTES.length]}
          onClick={() => setSelectedCategory(cat)}
        />
      ))}
    </div>
  );
}
