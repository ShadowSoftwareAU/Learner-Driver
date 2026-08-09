/**
 * useRouteRecording
 *
 * Continuously tracks the device's GPS position during an assessment and
 * records a chronological route path.  Also exposes `captureCurrentPosition`
 * so callers can snapshot the device's position at any moment (e.g. when an
 * instructor rates a maneuver).
 *
 * Designed for Expo Go / managed workflow — uses expo-location only.
 */

import * as Location from "expo-location";
import { useCallback, useRef, useState } from "react";

export type RoutePoint = { lat: number; lng: number; ts: number };
export type RecordingStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";

export function useRouteRecording() {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);

  // Keep a ref copy of routePoints so captureCurrentPosition (and stopRecording)
  // always see the freshest value without closing over stale state.
  const routePointsRef = useRef<RoutePoint[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  /** Snapshot of the most-recently-recorded position (for maneuver markers). */
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // ── Start ──────────────────────────────────────────────────────────────────

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (subscriptionRef.current) return true; // Already running

    setStatus("requesting");
    routePointsRef.current = [];
    setRoutePoints([]);

    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setStatus("denied");
        return false;
      }

      // Capture an immediate first point so the route starts exactly at the
      // assessment location even before the watch interval fires.
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const first: RoutePoint = {
          lat: initial.coords.latitude,
          lng: initial.coords.longitude,
          ts: initial.timestamp,
        };
        routePointsRef.current = [first];
        lastPositionRef.current = { lat: first.lat, lng: first.lng };
        setRoutePoints([first]);
      } catch {
        // Non-fatal — watch will fill in the route
      }

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 8000,   // Sample every 8 s
          distanceInterval: 15, // Or every 15 m — whichever comes first
        },
        (location) => {
          const point: RoutePoint = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            ts: location.timestamp,
          };
          lastPositionRef.current = { lat: point.lat, lng: point.lng };
          routePointsRef.current = [...routePointsRef.current, point];
          setRoutePoints((prev) => [...prev, point]);
        },
      );

      setStatus("active");
      return true;
    } catch {
      setStatus("unavailable");
      return false;
    }
  }, []);

  // ── Stop ───────────────────────────────────────────────────────────────────

  /** Stop watching and return the final route path. */
  const stopRecording = useCallback((): RoutePoint[] => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setStatus("idle");
    return routePointsRef.current;
  }, []);

  // ── Capture ────────────────────────────────────────────────────────────────

  /**
   * Returns the most-recently-seen position without making a new location
   * request.  Returns null if recording hasn't started or no fix exists yet.
   * Call this when the instructor rates a maneuver to attach a lat/lng pin.
   */
  const captureCurrentPosition = useCallback((): { lat: number; lng: number } | null => {
    return lastPositionRef.current;
  }, []);

  return {
    /** "idle" | "requesting" | "active" | "denied" | "unavailable" */
    status,
    /** All recorded route points so far */
    routePoints,
    startRecording,
    stopRecording,
    captureCurrentPosition,
  };
}
