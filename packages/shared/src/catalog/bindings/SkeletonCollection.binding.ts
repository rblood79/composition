/**
 * SkeletonCollection — S2 `SkeletonCollection` (ADR-314 Phase 4): placeholder items inside a
 * collection (a CardView). S2 renders its children function wrapped in `<Skeleton isLoading>` as a
 * collection node of type `skeleton` (`@react-spectrum/s2/src/SkeletonCollection.tsx`), and the
 * collection's layout repeats it to fill the view (RAC `GridLayout` · `WaterfallLayout`).
 *
 * D1: no element of its own — the CardView draws its Card template as `skeleton` collection items
 *     while its collection loads (`delegatedDom.runtime.ts` `cardview` · `skeletonCollection.components.tsx`).
 * D2: S2 `SkeletonCollectionProps` — `children` only (the node's own Card template).
 * D3: none of its own — the template draws the loading look (`skeletonContext.ts` — a SkeletonCollection
 *     is a loading Skeleton to its content).
 */

import type { PrimitiveBinding } from "../types";

export const skeletonCollectionBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "skeletoncollection",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
