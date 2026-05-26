import { Button } from "@/components/ui/button";

const DEFAULT_CHIPS = [
  "too wide",
  "too tight",
  "missed mirror check",
  "forgot indicator",
  "good control",
  "needs repetition",
  "hesitant",
  "smooth execution",
];

interface QuickNoteChipsProps {
  value: string;
  onChange: (next: string) => void;
  chips?: string[];
  className?: string;
}

export function QuickNoteChips({ value, onChange, chips = DEFAULT_CHIPS, className }: QuickNoteChipsProps) {
  const handleAppend = (chip: string) => {
    const trimmed = value.trimEnd();
    const next = trimmed.length === 0 ? chip : `${trimmed}, ${chip}`;
    onChange(next);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {chips.map(chip => (
        <Button
          key={chip}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAppend(chip)}
          className="h-9 px-3 text-sm rounded-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
        >
          + {chip}
        </Button>
      ))}
    </div>
  );
}
