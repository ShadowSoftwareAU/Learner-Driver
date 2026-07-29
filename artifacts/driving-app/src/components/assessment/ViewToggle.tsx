import { useState } from "react";
import { LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = "list" | "tile";

const STORAGE_KEY = "assessment-view-mode";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useViewMode(defaultMode: ViewMode = "list"): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "list" || stored === "tile") return stored as ViewMode;
    } catch { /* storage unavailable */ }
    return defaultMode;
  });

  const setAndStore = (newMode: ViewMode) => {
    setMode(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch { /* ignore */ }
  };

  return [mode, setAndStore];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className = "" }: ViewToggleProps) {
  return (
    <div className={`flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2.5 gap-1.5 text-xs font-medium transition-all rounded-md ${
          value === "list"
            ? "bg-white shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-transparent"
        }`}
        onClick={() => onChange("list")}
      >
        <LayoutList className="w-3.5 h-3.5" />
        List
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2.5 gap-1.5 text-xs font-medium transition-all rounded-md ${
          value === "tile"
            ? "bg-white shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-transparent"
        }`}
        onClick={() => onChange("tile")}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Tiles
      </Button>
    </div>
  );
}
