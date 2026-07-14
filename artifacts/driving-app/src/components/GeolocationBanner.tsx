/**
 * Soft banner that prompts mobile instructors to allow location access
 * before they start a lesson. Appears once per device; dismissed permanently
 * via localStorage.
 *
 * Only renders on:
 *   - Small viewports (≤ 768 px wide — typical mobile browser)
 *   - When geolocation permission is not yet granted
 *   - When the user is an instructor
 */
import { useState, useEffect } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "geo_banner_dismissed_v1";

function isMobileBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

export function GeolocationBanner({ role }: { role?: string }) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (role !== "instructor" && role !== "school_admin") return;
    if (!isMobileBrowser()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (!navigator.geolocation) return;

    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "prompt") setVisible(true);
        result.onchange = () => {
          if (result.state !== "prompt") dismiss();
        };
      }).catch(() => setVisible(true));
    } else {
      setVisible(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  async function handleAllow() {
    setRequesting(true);
    try {
      await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      dismiss();
    } catch {
      // User denied or timed out — still dismiss the banner, don't nag
      dismiss();
    } finally {
      setRequesting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="print:hidden mx-4 mt-3 mb-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3 text-sm shadow-sm">
      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-900 leading-snug">Enable location for GPS route tracking</p>
        <p className="text-blue-700 text-xs mt-0.5">
          Allow location access so lesson routes are recorded on your assessment reports.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
          onClick={handleAllow}
          disabled={requesting}
        >
          Allow
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="text-blue-400 hover:text-blue-600 transition-colors p-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
