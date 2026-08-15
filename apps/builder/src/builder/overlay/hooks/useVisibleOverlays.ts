/**
 * Virtual Scrolling for Overlays
 *
 * Only renders overlays visible in viewport to improve performance
 * with large number of selected elements (100+).
 *
 * Features:
 * - RAF-based viewport tracking (one update per display frame at most)
 * - AABB collision detection
 * - Passive event listeners for scroll performance
 * - Automatic cleanup
 */

import { useEffect, useState, useMemo, useRef } from "react";

/**
 * Viewport bounds in Preview iframe coordinates
 */
export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Overlay data with position/size
 */
export interface OverlayData {
  id: string;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  isPrimary?: boolean;
}

/**
 * Hook to filter overlays to only those visible in viewport
 *
 * @param overlays - All overlay data
 * @param iframeRef - Reference to Preview iframe
 * @returns Overlays visible in current viewport
 *
 * @example
 * ```tsx
 * const overlays = useStore(state => state.overlays);
 * const visibleOverlays = useVisibleOverlays(overlays, iframeRef);
 *
 * return (
 *   <div>
 *     {visibleOverlays.map(overlay => (
 *       <OverlayRect key={overlay.id} data={overlay} />
 *     ))}
 *     <div className="stats">
 *       {visibleOverlays.length} / {overlays.length} visible
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useVisibleOverlays(
  overlays: OverlayData[],
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
): OverlayData[] {
  const [viewport, setViewport] = useState<ViewportBounds>({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });

  const rafIdRef = useRef<number | null>(null);

  // Track viewport changes with RAF throttling
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const updateViewport = () => {
      // Prevent multiple RAF calls within the same display frame
      if (rafIdRef.current !== null) return;

      rafIdRef.current = requestAnimationFrame(() => {
        const doc = iframe.contentDocument;
        if (!doc) {
          rafIdRef.current = null;
          return;
        }

        // Calculate viewport bounds
        const scrollLeft =
          doc.documentElement.scrollLeft || doc.body.scrollLeft;
        const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
        const clientWidth = iframe.clientWidth;
        const clientHeight = iframe.clientHeight;

        setViewport({
          left: scrollLeft,
          top: scrollTop,
          right: scrollLeft + clientWidth,
          bottom: scrollTop + clientHeight,
        });

        rafIdRef.current = null;
      });
    };

    // Initial viewport calculation
    updateViewport();

    // Listen to scroll/resize with passive listeners (better scroll performance)
    iframe.contentWindow.addEventListener("scroll", updateViewport, {
      passive: true,
    });
    iframe.contentWindow.addEventListener("resize", updateViewport, {
      passive: true,
    });

    return () => {
      iframe.contentWindow?.removeEventListener("scroll", updateViewport);
      iframe.contentWindow?.removeEventListener("resize", updateViewport);

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [iframeRef]);

  // Filter to visible overlays using AABB collision detection
  const visibleOverlays = useMemo(() => {
    // If viewport not initialized yet, show all
    if (viewport.right === 0 && viewport.bottom === 0) {
      return overlays;
    }

    return overlays.filter((overlay) => {
      const { rect } = overlay;

      // AABB (Axis-Aligned Bounding Box) collision detection
      // Two rectangles DON'T overlap if:
      // - One is completely to the left of the other
      // - One is completely to the right of the other
      // - One is completely above the other
      // - One is completely below the other
      const isOutsideViewport =
        rect.right < viewport.left ||
        rect.left > viewport.right ||
        rect.bottom < viewport.top ||
        rect.top > viewport.bottom;

      return !isOutsideViewport;
    });
  }, [overlays, viewport]);

  return visibleOverlays;
}

/**
 * Check if a single overlay is visible in viewport
 *
 * @param rect - Overlay rectangle
 * @param viewport - Viewport bounds
 * @returns True if overlay intersects viewport
 */
export function isOverlayVisible(
  rect: OverlayData["rect"],
  viewport: ViewportBounds,
): boolean {
  return !(
    rect.right < viewport.left ||
    rect.left > viewport.right ||
    rect.bottom < viewport.top ||
    rect.top > viewport.bottom
  );
}
