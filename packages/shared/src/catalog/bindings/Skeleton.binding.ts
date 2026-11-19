/**
 * Skeleton — S2 `Skeleton` (ADR-314, 2026-11-18): a loading context around real content, not a
 * placeholder box. `<Skeleton isLoading>{children}</Skeleton>` renders no element of its own
 * (`@react-spectrum/s2/src/Skeleton.tsx` — `SkeletonContext.Provider`); the wrapped Text · Link ·
 * Icon · Image · StatusLight · Badge · Meter · Card draw their own loading look (Phase 3).
 *
 * D1: no element — the DOM gives only the children (`domBinding.runtime.ts` `skeleton`); the Canvas
 *     lays it out as `display: contents` (its rule).
 * D2: S2 `SkeletonProps` — `isLoading` (+ `children`, the node's own). No `size` (S2 · design-data · v3
 *     have none — removed, contract 71). No `dataBinding` (2026-11-19 사용자 결정): S2's
 *     `<Skeleton isLoading={list.isLoading}>` is the list its content shows — the Preview gives the
 *     Skeleton the load of the content bound inside it (`resolver.ts` `skeletonContentLoading`), so a
 *     second collection pick on the Skeleton is not asked for.
 * D3: none of its own — the loading look is each wrapped component's rule.
 */

import type { PrimitiveBinding } from "../types";

export const skeletonBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "skeleton",
  },
  props: {
    accepts: {
      // S2 `isLoading` (required there; default true here — a placed Skeleton shows its loading look).
      //   `false` = the wrapped content as it is (the content is the Skeleton's, not a hidden box).
      isLoading: {
        kind: "boolean",
        label: "Loading",
        section: "state",
        default: true,
      },
    },
    toRacProps: "default",
  },
};
