import type { CatalogConsumerNode } from "./compositionRoot";
import { CATALOG_SKELETON_LOOK_OF } from "../rule/skeletonLook";

/**
 * ADR-314 Phase 2 — S2 `SkeletonContext` (`@react-spectrum/s2/src/Skeleton.tsx`) on the catalog
 * records. S2 `<Skeleton isLoading>` provides a context its descendants read through React context
 * (instances, slots, repeated items and overlays included — the records' parent chain here). One
 * reading for the two consumers: the Canvas (`presence.ts` derived `isSkeleton`) and the DOM
 * (`domBinding.components.tsx` — `data-skeleton` · `inert`). Form components inside a loading
 * Skeleton are disabled through the inheritance host (`inheritedProps.ts` — S2 `useFormProps`
 * 「Skeleton always wins」).
 */

/** S2 components that read `SkeletonContext` and draw their own loading look (ADR-314 F2). */
export const CATALOG_SKELETON_PARTICIPANTS: ReadonlySet<string> = new Set([
  "Text", // S2 `Content.tsx` `Text` — `useSkeletonText`
  "Link", // `Link.tsx` — `useSkeletonText` · `isSkeleton` style
  "Icon", // `Icon.tsx` — `SkeletonWrapper`
  "Image", // `Image.tsx` — `useIsSkeleton` (Avatar draws an Image)
  "Avatar",
  "StatusLight", // `StatusLight.tsx` — the dot `gray-200`
  "Badge", // `Badge.tsx` — `SkeletonWrapper`
  "MeterTrack", // `Meter.tsx` — `SkeletonWrapper` around the track
  "Card", // `Card.tsx` — `useIsSkeleton` (menu disabled, `inert`)
  "MeterValue", // `Meter.tsx:156` — the value is a `<Text>` (Phase 3)
]);

/**
 * Where the context stops: S2 Button · ActionButton · ToggleButton provide `[SkeletonContext, null]`
 * to their content (a button's own text and icon are not a placeholder), and `SkeletonWrapper`
 * provides `null` inside what it wraps (a Badge's text is hidden with it, not drawn as text lines).
 */
const SKELETON_CONTEXT_CUT: ReadonlySet<string> = new Set([
  "Button",
  "LinkButton",
  "ActionButton",
  "ToggleButton",
  "Icon",
  "Badge",
  "MeterTrack",
]);

/** Participants whose element S2 marks `inert` while loading (Text's span · Link · wrappers · Card). */
export const CATALOG_SKELETON_INERT: ReadonlySet<string> = new Set([
  "Text",
  "Link",
  "Icon",
  "Badge",
  "MeterTrack",
  "Card",
  "MeterValue",
]);

/** Whether the nearest Skeleton above `node` (the context not cut between) is loading. */
export function catalogInLoadingSkeleton(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  const seen = new Set<string>();
  for (
    let parent = get(node.parentId);
    parent && !seen.has(parent.id);
    parent = get(parent.parentId)
  ) {
    seen.add(parent.id);
    const type = typeOf(parent);
    if (type === "Skeleton") return parent.props.isLoading === true;
    // (Phase 4 — S2 `SkeletonCollection` wraps its content in `<Skeleton isLoading>`.)
    if (type === "SkeletonCollection") return true;
    if (SKELETON_CONTEXT_CUT.has(type)) return false;
  }
  return false;
}

/** A participant's S2 `isSkeleton` (undefined for any other record — nothing to derive). */
export function catalogSkeletonParticipant(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  return (
    CATALOG_SKELETON_PARTICIPANTS.has(typeOf(node)) &&
    catalogInLoadingSkeleton(node, get, typeOf)
  );
}

/**
 * ADR-314 Phase 3 — below a loading wrapped participant (S2 `SkeletonWrapper` — `loadingStyle`'s
 * `* { visibility: hidden }`): a Badge's words, an Icon's glyph, a Meter track's fill. One walk up: a
 * wrapper above `node` counts until a cut above it (a wrapper is itself a cut — an Icon in a Badge is
 * hidden by the Badge, not by the Icon), and the nearest Skeleton decides.
 */
export function catalogSkeletonHidden(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  const seen = new Set<string>();
  let wrapped = false;
  for (
    let parent = get(node.parentId);
    parent && !seen.has(parent.id);
    parent = get(parent.parentId)
  ) {
    seen.add(parent.id);
    const type = typeOf(parent);
    if (type === "Skeleton") return wrapped && parent.props.isLoading === true;
    if (type === "SkeletonCollection") return wrapped;
    const look = CATALOG_SKELETON_LOOK_OF[type];
    const wrapper = look === "box" || look === "icon";
    if (SKELETON_CONTEXT_CUT.has(type)) wrapped = wrapper;
    else if (wrapper) wrapped = true;
  }
  return false;
}
