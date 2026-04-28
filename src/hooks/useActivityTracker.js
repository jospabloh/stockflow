/**
 * useActivityTracker — Frontend hook.
 * Calls trackUserActivity backend function at most once every 15 minutes.
 * Fires on mount (page load) and on meaningful user interactions.
 * Never blocks the UI on failure.
 */
import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const CLIENT_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

export function useActivityTracker(isAuthenticated = true) {
  const lastCalledRef = useRef(0);

  const track = useCallback(async () => {
    if (!isAuthenticated) return;
    const now = Date.now();
    if (now - lastCalledRef.current < CLIENT_THROTTLE_MS) return;
    lastCalledRef.current = now;

    try {
      await base44.functions.invoke('trackUserActivity', {});
    } catch (_) {
      // Never crash the UI — activity tracking is non-critical
    }
  }, [isAuthenticated]);

  // Fire once on mount (page load / navigation)
  useEffect(() => {
    if (!isAuthenticated) return;
    track();
  }, [isAuthenticated, track]);

  return { track };
}