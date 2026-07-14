/**
 * Bare-chrome print/download page for a single assessment report.
 * Opens in a new tab via the "Download PDF" button on assessment-detail.
 * Auto-triggers window.print() once the data has loaded and rendered.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useGetAssessment, getGetAssessmentQueryKey } from "@workspace/api-client-react";
import { ReportPreview } from "@/components/ReportPreview";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X } from "lucide-react";

export default function AssessmentPrint() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: assessment, isLoading } = useGetAssessment(id, {
    query: { enabled: !!id, queryKey: getGetAssessmentQueryKey(id) },
  });

  useEffect(() => {
    if (!assessment || autoTriggered) return;
    // Give Leaflet and fonts a moment to settle before printing
    printTimerRef.current = setTimeout(() => {
      setAutoTriggered(true);
      window.print();
    }, 1200);
    return () => {
      if (printTimerRef.current) clearTimeout(printTimerRef.current);
    };
  }, [assessment, autoTriggered]);

  if (isLoading || !assessment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">Preparing report…</p>
      </div>
    );
  }

  return (
    <>
      {/* Screen-only toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b px-4 py-2 flex items-center justify-between gap-3 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Use your browser's <strong>Save as PDF</strong> option in the print dialog.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            <X className="w-4 h-4 mr-1.5" /> Close
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Report — centred at a comfortable reading/print width */}
      <div className="max-w-[800px] mx-auto px-6 py-8 print:py-0 print:px-0">
        <ReportPreview assessment={assessment as any} />
      </div>
    </>
  );
}
