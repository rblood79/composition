import { createElement, type ReactNode, type Ref, type RefCallback } from "react";
import {
  CATALOG_SKELETON_LOOK,
  CATALOG_SKELETON_LOOK_ATTR,
} from "../rule/skeletonLook";

/**
 * ADR-314 Phase 3 — S2 `useLoadingAnimation` (`Skeleton.tsx`): Web Animations, not a CSS animation, so
 * every loading element on the page runs in step (`startTime = 0`). None under
 * `prefers-reduced-motion: reduce` (the look stays — `background-position` 0% is `gray-100`). Preview ·
 * Publish only; the Canvas draws the still frame (HC5).
 */
const RUNNING = new WeakMap<Element, Animation>();

function reducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Ref callback (React 19 — its return is the cleanup): start the shared animation on `element`. */
export const catalogSkeletonAnimate: RefCallback<Element> = (element) => {
  if (
    !element ||
    RUNNING.has(element) ||
    typeof (element as HTMLElement).animate !== "function" ||
    reducedMotion()
  )
    return;
  const { animation } = CATALOG_SKELETON_LOOK;
  const running = (element as HTMLElement).animate(
    [
      { backgroundPosition: animation.from },
      { backgroundPosition: animation.to },
    ],
    {
      duration: animation.durationMs,
      iterations: Infinity,
      easing: animation.easing,
    },
  );
  running.startTime = 0;
  RUNNING.set(element, running);
  return () => {
    running.cancel();
    RUNNING.delete(element);
  };
};

const MERGED = new WeakMap<object, RefCallback<Element>>();

/**
 * The animation ref beside an element's own ref (a RAC component's) — one stable callback per own ref,
 * so a re-render does not restart the animation.
 */
export function catalogSkeletonRef(
  own: Ref<Element> | undefined,
): Ref<Element> {
  if (own == null) return catalogSkeletonAnimate;
  let merged = MERGED.get(own as object);
  if (!merged) {
    merged = (element) => {
      let ownCleanup: void | (() => void) = undefined;
      if (typeof own === "function")
        ownCleanup = own(element) as void | (() => void);
      else (own as { current: Element | null }).current = element;
      const stop = catalogSkeletonAnimate(element);
      return () => {
        if (typeof stop === "function") stop();
        if (typeof ownCleanup === "function") ownCleanup();
        else if (typeof own === "function") own(null);
        else (own as { current: Element | null }).current = null;
      };
    };
    MERGED.set(own as object, merged);
  }
  return merged;
}

/**
 * S2 `SkeletonText` (`Skeleton.tsx`) — the words in an inline span whose line boxes draw the look
 * (`box-decoration-break: clone` — the generated `CatalogSkeleton.css`), `inert`, animated.
 */
export function catalogSkeletonText(children: ReactNode): ReactNode {
  return createElement(
    "span",
    {
      [CATALOG_SKELETON_LOOK_ATTR]: "text",
      inert: true,
      ref: catalogSkeletonAnimate,
    },
    children,
  );
}
