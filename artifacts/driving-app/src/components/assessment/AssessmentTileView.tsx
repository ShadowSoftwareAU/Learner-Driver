import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  getImage?: (item: TileManeuverResult) => string | null;

  /**
   * Readonly / panel mode — renders content in a panel below the maneuver
   * grid when a tile is tapped. Used by assessment-detail and viewer pages.
   */
  renderItem?: (item: TileManeuverResult) => React.ReactNode;

  /**
   * Interactive 4-layer mode (takes precedence over renderItem).
   * renderRating  → L3 — the 4 rating buttons; call onRatingSelected() after
   *                       the user picks a rating to advance to L4.
   * renderNotes   → L4 — notes dialog body; call onSave() or onSkip() to
   *                       close the dialog and return to L1.
   */
  renderRating?: (
    item: TileManeuverResult,
    onRatingSelected: () => void,
  ) => React.ReactNode;
  renderNotes?: (
    item: TileManeuverResult,
    onSave: () => void,
    onSkip: () => void,
  ) => React.ReactNode;
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

const LEVEL_DOT: Record<string, string> = {
  mastered:      "bg-green-500",
  practiced:     "bg-yellow-500",
  attempted:     "bg-red-500",
  not_attempted: "bg-gray-300",
};

const LEVEL_RING: Record<string, string> = {
  mastered:      "ring-green-400",
  practiced:     "ring-yellow-400",
  attempted:     "ring-red-400",
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
      <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden mb-2.5">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${consistentPct}%` }}
        />
      </div>
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
        transition-all duration-150 hover:shadow-md
        focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isSelected
          ? `border-primary shadow-lg ring-2 ${LEVEL_RING[level] ?? "ring-gray-200"}`
          : "border-border bg-white hover:-translate-y-0.5"
        }
      `}
    >
      <div className="w-full aspect-square bg-gray-100 overflow-hidden flex items-center justify-center relative">
        {img
          ? <img src={img} alt={displayName} className="w-full h-full object-cover" />
          : <ImageIcon className="w-8 h-8 text-gray-300" />
        }
        {/* Competency dot — top-right corner */}
        <span
          className={`absolute top-1.5 right-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${LEVEL_DOT[level] ?? "bg-gray-300"}`}
          aria-hidden="true"
        />
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium leading-snug text-foreground line-clamp-2">{displayName}</p>
      </div>
    </button>
  );
}

// ─── Shared breadcrumb (L2 / L3) ─────────────────────────────────────────────

function Breadcrumb({
  parts,
}: {
  parts: { label: string; onClick?: () => void }[];
}) {
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

export function AssessmentTileView({
  grouped,
  getImage,
  renderItem,
  renderRating,
  renderNotes,
}: AssessmentTileViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<TileManeuverResult | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [qsafeOpen, setQsafeOpen] = useState(false);

  // Readonly-mode panel state
  const [selectedKey, setSelectedKey] = useState<number | string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isInteractive = !!(renderRating && renderNotes);

  const getItemKey = (item: TileManeuverResult): number | string =>
    (item.id as number) ?? (item.maneuverId as number) ?? (item.name as string) ?? "";

  // Scroll readonly panel into view
  useEffect(() => {
    if (isInteractive || selectedKey == null) return;
    const t = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedKey, isInteractive]);

  // Navigation helpers
  const goToL1 = () => {
    setNotesOpen(false);
    setActiveItem(null);
    setSelectedCategory(null);
    setQsafeOpen(false);
    setSelectedKey(null);
  };

  const goToL2 = () => {
    setNotesOpen(false);
    setActiveItem(null);
    setQsafeOpen(false);
  };

  // ── L3: Rating view (interactive mode only) ───────────────────────────────

  if (isInteractive && selectedCategory && activeItem) {
    const img = getImage?.(activeItem) ?? null;
    const displayName = (activeItem.name as string) || (activeItem.maneuverName as string) || "";
    const complianceCriteria = activeItem.complianceCriteria as string | undefined;
    const masteryDefinition  = activeItem.masteryDefinition as string | undefined;
    const hasQsafe = !!(complianceCriteria || masteryDefinition);

    return (
      <>
        {/* L4: Notes dialog — overlaid on L3 */}
        <Dialog open={notesOpen} onOpenChange={(open) => { if (!open) setNotesOpen(false); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Instructor Notes</DialogTitle>
              <DialogDescription className="text-sm">{displayName}</DialogDescription>
            </DialogHeader>
            <div className="pt-1">
              {renderNotes!(
                activeItem,
                goToL1, // onSave — notes already in state, just navigate
                goToL1, // onSkip — same navigation, notes left empty
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          <Breadcrumb
            parts={[
              { label: "All categories", onClick: goToL1 },
              { label: selectedCategory, onClick: goToL2 },
              { label: displayName },
            ]}
          />

          {/* Maneuver card */}
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            {/* Image banner */}
            {img ? (
              <div className="w-full h-44 sm:h-56 overflow-hidden bg-gray-100">
                <img src={img} alt={displayName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-gray-300" />
              </div>
            )}

            {/* Name + category */}
            <div className="px-5 py-4 border-b">
              <p className="text-xl font-semibold leading-tight">{displayName}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{selectedCategory}</p>
            </div>

            {/* Rating buttons — provided by parent */}
            <div className="p-4 sm:p-5">
              {renderRating!(activeItem, () => setNotesOpen(true))}
            </div>

            {/* QSAFE / competency accordion */}
            {hasQsafe && (
              <div className="border-t">
                <button
                  type="button"
                  onClick={() => setQsafeOpen(p => !p)}
                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors"
                >
                  <span>QSAFE &amp; Competency Details</span>
                  {qsafeOpen
                    ? <ChevronUp className="w-4 h-4 shrink-0" />
                    : <ChevronDown className="w-4 h-4 shrink-0" />
                  }
                </button>
                {qsafeOpen && (
                  <div className="px-4 sm:px-5 pb-5 space-y-3">
                    {complianceCriteria && (
                      <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
                        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1.5">
                          QSAFE Compliance Criteria
                        </p>
                        <p className="text-sm text-blue-900/80 whitespace-pre-wrap leading-relaxed">
                          {complianceCriteria}
                        </p>
                      </div>
                    )}
                    {masteryDefinition && (
                      <div className="rounded-md bg-purple-50 border border-purple-100 p-3">
                        <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1.5">
                          Competency Definition
                        </p>
                        <p className="text-sm text-purple-900/80 whitespace-pre-wrap leading-relaxed">
                          {masteryDefinition}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── L2: Maneuver tile grid ────────────────────────────────────────────────

  if (selectedCategory) {
    const items = grouped[selectedCategory] ?? [];

    if (isInteractive) {
      return (
        <div className="space-y-4">
          <Breadcrumb
            parts={[
              { label: "All categories", onClick: goToL1 },
              { label: `${selectedCategory} (${items.length})` },
            ]}
          />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {items.map(item => {
              const key = getItemKey(item);
              return (
                <ManeuverTile
                  key={key}
                  item={item}
                  isSelected={false}
                  onClick={() => { setActiveItem(item); setQsafeOpen(false); }}
                  getImage={getImage}
                />
              );
            })}
          </div>
        </div>
      );
    }

    // Readonly mode — renderItem panel below grid
    const selectedItem = selectedKey != null
      ? (items.find(i => getItemKey(i) === selectedKey) ?? null)
      : null;

    return (
      <div className="space-y-4">
        <Breadcrumb
          parts={[
            { label: "All categories", onClick: () => { setSelectedCategory(null); setSelectedKey(null); } },
            { label: `${selectedCategory} (${items.length})` },
          ]}
        />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map(item => {
            const key = getItemKey(item);
            return (
              <ManeuverTile
                key={key}
                item={item}
                isSelected={selectedKey === key}
                onClick={() => setSelectedKey(prev => (prev === key ? null : key))}
                getImage={getImage}
              />
            );
          })}
        </div>

        {selectedItem && renderItem && (
          <div
            ref={panelRef}
            className="rounded-xl border-2 border-primary/30 bg-white overflow-hidden shadow-md"
          >
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
            {renderItem(selectedItem)}
          </div>
        )}
      </div>
    );
  }

  // ── L1: Category grid ─────────────────────────────────────────────────────

  const categories = Object.keys(grouped);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {categories.map((cat, i) => (
        <CategoryTile
          key={cat}
          category={cat}
          items={grouped[cat]}
          palette={TILE_PALETTES[i % TILE_PALETTES.length]}
          onClick={() => {
            setSelectedKey(null);
            setActiveItem(null);
            setSelectedCategory(cat);
          }}
        />
      ))}
    </div>
  );
}
