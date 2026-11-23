import {
  Children,
  useCallback,
  useLayoutEffect,
  useState,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";

import { CATALOG_SKELETON_LOOK_ATTR } from "../rule/skeletonLook";
import { useCatalogImageGroup } from "./imageCoordinator.components";
import { catalogSkeletonAnimate } from "./skeletonAnimation";

/**
 * S2 `Image` (`@react-spectrum/s2` 1.8.2 `Image.tsx`) — the box around its `img`, by load state
 * (S2 체크리스트 부록 D.2, 사용자 결정 2026-11-23):
 *   - loading: the box takes the skeleton look (S2 `isAnimating` → `loadingStyle` — the same look and
 *     animation a loading Skeleton gives, `data-skeleton-look="box"`); the `img` is transparent
 *   - loaded: waiting for its group (S2 `ImageCoordinator` — 2026-11-24): inside a coordinator of its
 *     `group` it keeps the loading look until every Image of the group has loaded (or the
 *     coordinator's timeout); outside one it is revealed at once (S2's default group)
 *   - revealed: the `img` shows — fading in over 500ms when the reveal came over 200ms after the
 *     load began (S2 `imgStyles` `isTransitioning`), at once when it was quick (cached)
 *   - error: the Image's own nodes in place of the `img` (S2 `renderError`); with none the `img` stays,
 *     transparent (S2 — `!errorState && img`, never revealed)
 *   - no source: its own nodes show (as on the Canvas — `catalogImageFallbackHidden`), else the bare
 *     `img` as S2 draws it — no skeleton (an empty Image is not loading — a Card preview's placeholder)
 */
type ImageState = {
  src: string | undefined;
  phase: "empty" | "loading" | "loaded" | "shown" | "error";
  start: number;
  slow: boolean;
};

const initial = (src: string | undefined): ImageState => ({
  src,
  phase: src ? "loading" : "empty",
  start: Date.now(),
  slow: false,
});

export function CatalogImageBox({
  imgProps,
  group,
  children,
  ...box
}: HTMLAttributes<HTMLDivElement> & {
  imgProps: ImgHTMLAttributes<HTMLImageElement>;
  /** S2 `Image` `group` — the name of the ImageCoordinator group it is revealed with. */
  group?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  const src = imgProps.src;
  const coordinator = useCatalogImageGroup(group);
  const { register, unregister, load } = coordinator;
  const [state, setState] = useState(() => initial(src));
  // (a new source starts over — S2's `update` action)
  let current = state.src === src ? state : initial(src);
  // (loaded and its group reveals — S2's `revealed`, decided while rendering as S2 does)
  if (current.phase === "loaded" && coordinator.revealAll)
    current = {
      ...current,
      phase: "shown",
      slow: Date.now() - current.start > 200,
    };
  if (current !== state) setState(current);
  // (S2: the Image joins its group while it has a source to wait for)
  useLayoutEffect(() => {
    if (!src) return;
    register(src);
    return () => unregister(src);
  }, [src, register, unregister]);
  const loaded = useCallback(() => {
    if (src) load(src);
    setState((s) =>
      s.src === src && s.phase === "loading" ? { ...s, phase: "loaded" } : s,
    );
  }, [src, load]);
  const failed = useCallback(() => {
    // (a picture that will not come is not waited for — S2 `onError` unregisters it)
    if (src) unregister(src);
    setState((s) =>
      s.src === src && s.phase === "loading" ? { ...s, phase: "error" } : s,
    );
  }, [src, unregister]);
  // (an `img` already complete when it mounts — the browser's cache — fires no load event in time)
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img?.complete) return;
      if (img.naturalWidth > 0) loaded();
      else if (img.currentSrc) failed();
    },
    [loaded, failed],
  );
  // (S2 `isAnimating` — loading, and loaded while its group waits)
  const loading = current.phase === "loading" || current.phase === "loaded";
  const fallback =
    Children.count(children) > 0 &&
    (current.phase === "error" || current.phase === "empty");
  // (a loading Skeleton around it marks the box already — its look · animation win)
  const marked =
    (box as Record<string, unknown>)[CATALOG_SKELETON_LOOK_ATTR] !== undefined;
  return (
    <div
      {...box}
      data-image-state={current.phase}
      {...(loading && !marked
        ? { [CATALOG_SKELETON_LOOK_ATTR]: "box", ref: catalogSkeletonAnimate }
        : {})}
    >
      {fallback ? (
        children
      ) : (
        <img
          {...imgProps}
          ref={imgRef}
          onLoad={loaded}
          onError={failed}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: current.phase === "shown" ? 1 : 0,
            transition:
              current.phase === "shown" && current.slow
                ? "opacity 500ms"
                : "none",
          }}
        />
      )}
    </div>
  );
}
