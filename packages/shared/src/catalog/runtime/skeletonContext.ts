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

/**
 * S2 components that read `SkeletonContext` and draw their own loading look (ADR-314 F2) — the look is
 * `rule/skeletonLook.ts` `CATALOG_SKELETON_LOOK_OF` (Card has none). `inert`: S2 marks the element inert
 * while loading (Text's span · Link · wrappers · Card). `cut`: S2 `SkeletonWrapper` provides `null`
 * inside what it wraps (a Badge's text is hidden with it, not drawn as text lines).
 */
const PARTICIPANT: Readonly<
  Record<string, { readonly inert?: true; readonly cut?: true }>
> = {
  Text: { inert: true }, // S2 `Content.tsx` `Text` — `useSkeletonText`
  Link: { inert: true }, // `Link.tsx` — `useSkeletonText` · `isSkeleton` style
  Icon: { inert: true, cut: true }, // `Icon.tsx` — `SkeletonWrapper`
  Image: {}, // `Image.tsx` — `useIsSkeleton` (Avatar draws an Image)
  Avatar: {},
  StatusLight: {}, // `StatusLight.tsx` — the dot `gray-200`
  Badge: { inert: true, cut: true }, // `Badge.tsx` — `SkeletonWrapper`
  MeterTrack: { inert: true, cut: true }, // `Meter.tsx` — `SkeletonWrapper` around the track
  Card: { inert: true }, // `Card.tsx` — `useIsSkeleton` (menu disabled, `inert`)
  MeterValue: { inert: true }, // `Meter.tsx:156` — the value is a `<Text>` (Phase 3)
};

export const CATALOG_SKELETON_PARTICIPANTS: ReadonlySet<string> = new Set(
  Object.keys(PARTICIPANT),
);

export const CATALOG_SKELETON_INERT: ReadonlySet<string> = new Set(
  Object.keys(PARTICIPANT).filter((type) => PARTICIPANT[type]!.inert),
);

/**
 * Where the context stops: S2 Button · ActionButton · ToggleButton provide `[SkeletonContext, null]`
 * to their content (a button's own text and icon are not a placeholder), and the wrapped participants.
 */
const SKELETON_CONTEXT_CUT: ReadonlySet<string> = new Set([
  "Button",
  "LinkButton",
  "ActionButton",
  "ToggleButton",
  ...Object.keys(PARTICIPANT).filter((type) => PARTICIPANT[type]!.cut),
]);

export interface CatalogSkeletonState {
  /** A participant's S2 `isSkeleton`: the nearest Skeleton above (the context not cut between) is loading. */
  readonly isSkeleton: boolean;
  /**
   * ADR-314 Phase 3 — below a loading wrapped participant (S2 `SkeletonWrapper` — `loadingStyle`'s
   * `* { visibility: hidden }`): a Badge's words, an Icon's glyph, a Meter track's fill. A wrapper above
   * `node` counts until a cut above it (a wrapper is itself a cut — an Icon in a Badge is hidden by the
   * Badge, not by the Icon), and the nearest Skeleton decides.
   */
  readonly hidden: boolean;
}

const NOT_LOADING: CatalogSkeletonState = { isSkeleton: false, hidden: false };

/**
 * A Table part's own words — no participant. S2 TableView draws a Column's · Cell's `children` in a
 * plain span (`TableView.tsx` `ColumnContents` `columnHeaderText` · `Cell` `cellContent`), not a
 * `Text`, so a Skeleton around a table leaves them as they are. Here those words are a Text node of
 * the Column · Cell origin (`Column > frame > Text` · `Cell > Text`): the first Text of a Cell, or of
 * a Column's content wrapper (its first frame). A Text the author puts beside them is S2
 * `<Cell>…<Text/></Cell>` — a participant; the wrapper's Icons (⋮ · sort arrow) are S2 Icons.
 * Why (2026-11-19 사용자 보고): a Table inside a Skeleton drew every header and cell as a gray bar.
 */
function tablePartWords(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  if (typeOf(node) !== "Text") return false;
  const parent = get(node.parentId);
  if (!parent) return false;
  const first = (owner: CatalogConsumerNode, type: string) =>
    owner.children
      .map(get)
      .find((child) => child !== undefined && typeOf(child) === type);
  if (first(parent, "Text")?.id !== node.id) return false;
  const parentType = typeOf(parent);
  if (parentType === "Cell") return true;
  if (parentType !== "frame") return false;
  const column = get(parent.parentId);
  return (
    column !== undefined &&
    typeOf(column) === "Column" &&
    first(column, "frame")?.id === parent.id
  );
}

/** `node`'s skeleton state — one walk up to the nearest Skeleton (or SkeletonCollection). */
export function catalogSkeletonState(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): CatalogSkeletonState {
  const participant =
    CATALOG_SKELETON_PARTICIPANTS.has(typeOf(node)) &&
    !tablePartWords(node, get, typeOf);
  const seen = new Set<string>();
  let cut = false;
  let wrapped = false;
  for (
    let parent = get(node.parentId);
    parent && !seen.has(parent.id);
    parent = get(parent.parentId)
  ) {
    seen.add(parent.id);
    const type = typeOf(parent);
    // (Phase 4 — S2 `SkeletonCollection` wraps its content in `<Skeleton isLoading>`.)
    const loading =
      type === "Skeleton"
        ? parent.props.isLoading === true
        : type === "SkeletonCollection"
          ? true
          : undefined;
    if (loading !== undefined)
      return loading
        ? { isSkeleton: participant && !cut, hidden: wrapped }
        : NOT_LOADING;
    const look = CATALOG_SKELETON_LOOK_OF[type];
    const wrapper = look === "box" || look === "icon";
    if (SKELETON_CONTEXT_CUT.has(type)) {
      cut = true;
      wrapped = wrapper;
    } else if (wrapper) wrapped = true;
  }
  return NOT_LOADING;
}
