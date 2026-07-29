import * as Location from "expo-location";
import { useState, useCallback } from "react";

export type GpsCoordinate = { lat: number; lng: number; ts: number };
export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "error";

/**
 * Hook for anti-fraud GPS capture during supervised sessions.
 *
 * Usage:
 *   const { status, requestAndCapture, captureNow } = useGpsLocation();
 *
 * - Call `requestAndCapture()` on session open to ask for permission and capture start coords.
 * - Call `captureNow()` on submit to capture end coords (re-uses already-granted permission).
 * - Check `status` to render the GPS indicator and handle denied/error states.
 */
export function useGpsLocation() {
  const [status, setStatus] = useState<GpsStatus>("idle");

  /** Request foreground permission (if not already granted) then capture current position. */
  const requestAndCapture = useCallback(async (): Promise<GpsCoordinate | null> => {
    setStatus("requesting");
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setStatus("denied");
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setStatus("active");
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ts: pos.timestamp,
      };
    } catch {
      setStatus("error");
      return null;
    }
  }, []);

  /**
   * Capture current position without re-requesting permission.
   * Safe to call after `requestAndCapture` has already resolved.
   * Returns null silently on failure — end coords are best-effort.
   */
  const captureNow = useCallback(async (): Promise<GpsCoordinate | null> => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ts: pos.timestamp,
      };
    } catch {
      return null;
    }
  }, []);

  return { status, requestAndCapture, captureNow };
}
