import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown",
  "touchstart", "scroll", "click", "pointerdown",
] as const;

interface Options {
  timeoutMs?: number;
  warnMs?: number;
  onExpire: () => void;
}

interface Result {
  isWarning: boolean;
  remainingSeconds: number;
  reset: () => void;
}

/**
 * Tracks user inactivity. Fires onExpire() after timeoutMs of no activity.
 * Returns isWarning=true for the window between warnMs and timeoutMs so the UI
 * can show a "you're about to be signed out" countdown.
 *
 * Defaults: 30-minute timeout, warning starts at 25 minutes.
 */
export function useInactivityTimeout({
  timeoutMs = 30 * 60 * 1000,
  warnMs = 25 * 60 * 1000,
  onExpire,
}: Options): Result {
  const lastActivityRef = useRef<number>(Date.now());
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [isWarning, setIsWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.round((timeoutMs - warnMs) / 1000)
  );

  const clearTimers = useCallback(() => {
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    expireTimerRef.current = null;
    warnTimerRef.current = null;
    tickRef.current = null;
  }, []);

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsWarning(false);
    setRemainingSeconds(Math.round((timeoutMs - warnMs) / 1000));
    clearTimers();

    warnTimerRef.current = setTimeout(() => {
      setIsWarning(true);
      const warnDurationMs = timeoutMs - warnMs;
      setRemainingSeconds(Math.round(warnDurationMs / 1000));

      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - lastActivityRef.current;
        const remaining = Math.max(0, Math.round((timeoutMs - elapsed) / 1000));
        setRemainingSeconds(remaining);
      }, 1000);
    }, warnMs);

    expireTimerRef.current = setTimeout(() => {
      clearTimers();
      onExpireRef.current();
    }, timeoutMs);
  }, [timeoutMs, warnMs, clearTimers]);

  useEffect(() => {
    reset();
    const handleActivity = () => {
      if (!isWarning) reset();
    };
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, []);

  return { isWarning, remainingSeconds, reset };
}
