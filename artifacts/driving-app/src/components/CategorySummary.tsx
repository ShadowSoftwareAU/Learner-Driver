import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManeuverResultItemCompetencyLevel } from "@/lib/enums";
import { useMemo } from "react";

type Level = ManeuverResultItemCompetencyLevel;

interface Maneuver {
  id: number;
  name: string;
  category: string;
}

interface CategorySummaryProps {
  maneuvers: Maneuver[];
  results: Record<number, Level>;
  notes: Record<number, string>;
  title?: string;
  /** If true, only include maneuvers that have a result recorded. Defaults to false (full breakdown). */
  onlyAssessed?: boolean;
}

const LEVEL_META: Record<string, { label: string; color: string }> = {
  not_attempted: { label: "Not Attempted", color: "bg-gray-100 text-gray-700" },
  attempted: { label: "Attempted", color: "bg-red-100 text-red-700" },
  practiced: { label: "Practiced", color: "bg-yellow-100 text-yellow-700" },
  mastered: { label: "Mastered", color: "bg-green-100 text-green-700" },
};

export function CategorySummary({
  maneuvers,
  results,
  notes,
  title = "Lesson Summary",
  onlyAssessed = false,
}: CategorySummaryProps) {
  const { byCategory, totals, highlights } = useMemo(() => {
    const byCategory: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {
      not_attempted: 0,
      attempted: 0,
      practiced: 0,
      mastered: 0,
    };
    const highlights: { name: string; note: string; level: string }[] = [];

    const filtered = onlyAssessed
      ? maneuvers.filter(m => results[m.id])
      : maneuvers;

    for (const m of filtered) {
      const level = results[m.id] ?? "not_attempted";
      if (!byCategory[m.category]) {
        byCategory[m.category] = {
          not_attempted: 0,
          attempted: 0,
          practiced: 0,
          mastered: 0,
        };
      }
      byCategory[m.category][level] = (byCategory[m.category][level] ?? 0) + 1;
      totals[level] = (totals[level] ?? 0) + 1;
      const note = notes[m.id];
      if (note && note.trim().length > 0) {
        highlights.push({ name: m.name, note: note.trim(), level });
      }
    }

    return { byCategory, totals, highlights };
  }, [maneuvers, results, notes, onlyAssessed]);

  const totalCount = Object.values(totals).reduce((a, b) => a + b, 0);
  if (totalCount === 0) return null;

  return (
    <Card>
      <CardHeader className="p-6 pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-5">
        {/* Totals row */}
        <div className="grid grid-cols-4 gap-2">
          {(["not_attempted", "attempted", "practiced", "mastered"] as const).map(level => {
            const meta = LEVEL_META[level];
            return (
              <div key={level} className={`rounded-md p-3 text-center ${meta.color}`}>
                <div className="text-2xl font-bold">{totals[level] ?? 0}</div>
                <div className="text-xs font-medium mt-0.5">{meta.label}</div>
              </div>
            );
          })}
        </div>

        {/* Per-category breakdown */}
        {Object.keys(byCategory).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By Category</p>
            <div className="space-y-2">
              {Object.entries(byCategory).map(([cat, counts]) => (
                <div key={cat} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate font-medium">{cat}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {(["not_attempted", "attempted", "practiced", "mastered"] as const).map(level => {
                      const count = counts[level] ?? 0;
                      if (count === 0) return null;
                      const meta = LEVEL_META[level];
                      return (
                        <span
                          key={level}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}
                          title={meta.label}
                        >
                          {count} {meta.label.toLowerCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights with notes */}
        {highlights.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Highlights & Notes</p>
            <div className="space-y-1.5">
              {highlights.map((h, i) => {
                const meta = LEVEL_META[h.level];
                return (
                  <div key={i} className="text-sm border-l-2 border-blue-200 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{h.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
