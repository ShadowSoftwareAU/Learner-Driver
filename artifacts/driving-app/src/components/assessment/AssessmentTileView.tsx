import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TileManeuverResult {
  id?: number | null;
  maneuverId?: number | null;
  name?: string | null;
  maneuverName?: string | null;
  competencyLevel?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

interface AssessmentTileViewProps {
  grouped: Record<string, TileManeuverResult[]>;
  /**
   * Renders the rating / detail content shown inside the expanded panel when
   * a maneuver tile is tapped. The panel header (image + name) is handled by
   * this component, so renderItem only needs to supply the interactive content.
   */
  renderItem: (item: TileManeuverResult) => React.ReactNode;
  /** Return the image URL for a maneuver tile, or null for the placeholder. */
  getImage?: (item: TileManeuverResult) => string | null;
}

// ─── Colour palettes (Level 1 category tiles) ─────────────────────────────────

const TILE_PALETTES = [
  { border: "border-blue-200",    bg: "bg-blue-50/70",    accent: "text-blue-700",    },
  { border: "border-purple-200",  bg: "bg-purple-50/70",  accent: "text-purple-700",  },
  { border: "border-emerald-200", bg: "bg-emerald-50/70", accent: "text-emerald-700", },
  { border: "border-amber-200",   bg: "bg-amber-50/70",   accent: "text-amber-700",   },
  { border: "border-rose-200",    bg: "bg-rose-50/70",    accent: "text-rose-700",    },
  { border: "border-cyan-200",    bg: "bg-cyan-50/70",    accent: "text-cyan-700",    },
  { border: "border-indigo-200",  bg: "bg-indigo-50/70",  accent: "text-indigo-700",  },
];

// ─── Competency level indicators ─────────────────────────────────────────────

const LEVEL_DOT: Record<string, string> = {
  mastered:     "bg-green-500",
  practiced:    "bg-yellow-500",
  attempted:    "bg-red-500",
  not_attempted: "bg-gray-300",
};

const LEVEL_RING: Record<string, string> = {
  mastered:     "ring-green-400",
  practiced:    "ring-yellow-400",
  attempted:    "ring-red-400",
  not_attempted: "ring-gray-200",
};

// ─── Level 1: Category tile ───────────────────────────────────────────────────

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
  const total        = items.length;
  const mastered     = items.filter(i => i.competencyLevel === "mastered").length;
  const practiced    = items.filter(i => i.competencyLevel === "practiced").length;
  const attempted    = items.filter(i => i.competencyLevel === "attempted").length;
  const notAttempted = items.filter(i => !i.competencyLevel || i.competencyLevel === "not_attempted").length;
  const assessed     = total - notAttempted;
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
      <p className={`font-semibold text-sm leading-tight mb-3 ${palette.accent}`}>
        {category}
      </p>

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

// ─── Level 2: Maneuver tile ───────────────────────────────────────────────────

function ManeuverTile({
  item,
  isSelected,
  onClick,
  getImage,
}: {
  item: TileManeuverResult;
  isSelected: boolean;
  onClick: () => void;
  getImage?: (item: TileManeuverResult) => string | null;
}) {
  const img = getImage?.(item) ?? null;
  const displayName = (item.name as string) || (item.maneuverName as string) || "";
  const level = (item.competencyLevel as string) ?? "not_attempted";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col rounded-xl border-2 overflow-hidden text-left w-full
        transition-all duration-150
        hover:shadow-md
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isSelected
          ? `border-primary shadow-lg ring-2 ${LEVEL_RING[level] ?? "ring-gray-200"}`
          : "border-border bg-white hover:-translate-y-0.5"
        }
      `}
    >
      {/* Square image area */}
      <div className="w-full aspect-square bg-gray-100 overflow-hidden flex items-center justify-center relative">
        {img ? (
          <img src={img} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-8 h-8 text-gray-300" />
        )}
        {/* Competency dot — top-right overlay */}
        <span
          className={`absolute top-1.5 right-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${LEVEL_DOT[level] ?? "bg-gray-300"}`}
          aria-hidden="true"
        />
      </div>

      {/* Name label */}
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium leading-snug text-foreground line-clamp-2">{displayName}</p>
      </div>
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AssessmentTileView({ grouped, renderItem, getImage }: AssessmentTileViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<number | string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const getItemKey = (item: TileManeuverResult): number | string =>
    (item.id as number) ?? (item.maneuverId as number) ?? (item.name as string) ?? "";

  // Scroll expanded panel into view when it opens
  useEffect(() => {
    if (selectedKey == null) return;
    const timer = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedKey]);

  // ── Level 2: Maneuver tile grid ───────────────────────────────────────────

  if (selectedCategory) {
    const items = grouped[selectedCategory] ?? [];
    const selectedItem = selectedKey != null
      ? (items.find(i => getItemKey(i) === selectedKey) ?? null)
      : null;

    const handleTileClick = (item: TileManeuverResult) => {
      const key = getItemKey(item);
      setSelectedKey(prev => (prev === key ? null : key));
    };

    return (
      <div className="space-y-4">
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-1.5 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => { setSelectedCategory(null); setSelectedKey(null); }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All categories
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground truncate">{selectedCategory}</span>
          <span className="text-muted-foreground ml-1 shrink-0">({items.length})</span>
        </div>

        {/* Maneuver tile grid — 3 columns on mobile, 4 on sm+ */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map(item => {
            const key = getItemKey(item);
            return (
              <ManeuverTile
                key={key}
                item={item}
                isSelected={selectedKey === key}
                onClick={() => handleTileClick(item)}
                getImage={getImage}
              />
            );
          })}
        </div>

        {/* Expanded panel — appears below grid when a tile is selected */}
        {selectedItem && (
          <div
            ref={panelRef}
            className="rounded-xl border-2 border-primary/30 bg-white overflow-hidden shadow-md"
          >
            {/* Panel header: image + name + close */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50/80">
              {(() => {
                const img = getImage?.(selectedItem) ?? null;
                return img ? (
                  <img
                    src={img}
                    alt={(selectedItem.name as string) || ""}
                    className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
                  />
                ) : null;
              })()}
              <p className="font-semibold text-base flex-1 leading-snug">
                {(selectedItem.name as string) || (selectedItem.maneuverName as string)}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedKey(null)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Caller-supplied rating / detail UI */}
            {renderItem(selectedItem)}
          </div>
        )}
      </div>
    );
  }

  // ── Level 1: Category grid ────────────────────────────────────────────────

  const categories = Object.keys(grouped);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {categories.map((cat, i) => (
        <CategoryTile
          key={cat}
          category={cat}
          items={grouped[cat]}
          palette={TILE_PALETTES[i % TILE_PALETTES.length]}
          onClick={() => { setSelectedKey(null); setSelectedCategory(cat); }}
        />
      ))}
    </div>
  );
}
