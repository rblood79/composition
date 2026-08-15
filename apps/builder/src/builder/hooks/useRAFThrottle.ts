/**
 * RAF-based Throttle Hook
 *
 * Uses requestAnimationFrame to throttle updates to the browser's display refresh cycle.
 * More efficient than setTimeout-based debounce for visual updates.
 *
 * Benefits:
 * - Auto-syncs with browser's repaint cycle
 * - Automatically pauses when tab is inactive (battery efficient)
 * - No timer overhead (single RAF per update cycle)
 * - Perfect for scroll/resize handlers
 *
 * @example
 * ```tsx
 * const [scrollPosition, setScrollPosition] = useState(0);
 * const throttledPosition = useRAFThrottle(scrollPosition);
 *
 * // scrollPosition changes rapidly, throttledPosition updates at most once per display frame
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Throttle value updates to requestAnimationFrame cycle
 *
 * @param value - Value to throttle
 * @returns Throttled value that updates at most once per display frame
 */
export function useRAFThrottle<T>(value: T): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const rafIdRef = useRef<number | null>(null);
  const valueRef = useRef<T>(value);

  useEffect(() => {
    // Store latest value
    valueRef.current = value;

    // If RAF already scheduled, skip (prevents multiple RAF calls)
    if (rafIdRef.current !== null) {
      return;
    }

    // Schedule update for next frame
    rafIdRef.current = requestAnimationFrame(() => {
      setThrottledValue(valueRef.current);
      rafIdRef.current = null;
    });

    // Cleanup: cancel pending RAF on unmount or value change
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [value]);

  return throttledValue;
}

/**
 * Throttle callback execution to requestAnimationFrame cycle
 *
 * @param callback - Callback to throttle
 * @returns Throttled callback function
 *
 * @example
 * ```tsx
 * const handleScroll = useRAFCallback(() => {
 *   console.log('Scroll at display refresh cadence');
 * });
 *
 * useEffect(() => {
 *   window.addEventListener('scroll', handleScroll);
 *   return () => window.removeEventListener('scroll', handleScroll);
 * }, [handleScroll]);
 * ```
 */
export function useRAFCallback(callback: () => void): () => void {
  const rafIdRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Return memoized throttled callback
  return useCallback(() => {
    // If RAF already scheduled, skip
    if (rafIdRef.current !== null) {
      return;
    }

    // Schedule for next frame
    rafIdRef.current = requestAnimationFrame(() => {
      callbackRef.current();
      rafIdRef.current = null;
    });
  }, []);
}
