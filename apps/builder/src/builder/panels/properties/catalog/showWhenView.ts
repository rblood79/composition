import type {
  CatalogShowCondition,
  CatalogShowWhen,
  CatalogStateKey,
  CatalogStateOwnerRef,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";

/** The panel's owner choice: the nearest, an authored ancestor's address, or the stored one kept. */
export const NEAREST = "nearest";
export const KEEP = "keep";

/** One condition as the "Show when" section edits it. */
export interface ShowWhenConditionView {
  key: CatalogStateKey;
  not: boolean;
  /** `nearest`, `node:<id>` (an authored ancestor's address), or `keep` (the stored `from`). */
  owner: string;
  /** The stored owner reference a `keep` choice writes back (a type · an instance address). */
  from?: CatalogStateOwnerRef;
}

/** A stored `showWhen` → the section's rows (each condition's own `from`, else the whole one). */
export function showWhenViews(
  showWhen: CatalogShowWhen | undefined,
): ShowWhenConditionView[] {
  if (!showWhen) return [];
  return showWhen.all.map((item) => {
    const key =
      typeof item === "string" ? item : "key" in item ? item.key : item.not;
    const not = typeof item !== "string" && "not" in item;
    const from =
      (typeof item !== "string" && "from" in item ? item.from : undefined) ??
      showWhen.from;
    return {
      key,
      not,
      ...(from && "ancestor" in from && "nodeId" in from.ancestor
        ? { owner: `node:${from.ancestor.nodeId}` }
        : from
          ? { owner: KEEP, from }
          : { owner: NEAREST }),
    };
  });
}

/** The section's rows → the stored `showWhen` (absent rows = no condition). */
export function showWhenOf(
  views: readonly ShowWhenConditionView[],
): CatalogShowWhen | null {
  if (!views.length) return null;
  const all = views.map((view): CatalogShowCondition => {
    const from: CatalogStateOwnerRef | undefined =
      view.owner === NEAREST
        ? undefined
        : view.owner === KEEP
          ? view.from
          : { ancestor: { nodeId: view.owner.slice(5) as NodeId } };
    if (!from) return view.not ? { not: view.key } : view.key;
    return view.not ? { not: view.key, from } : { key: view.key, from };
  });
  return { all };
}

/** A kept owner's label. */
export function keptOwnerLabel(from: CatalogStateOwnerRef | undefined): string {
  if (!from) return "Nearest";
  if ("type" in from) return `Nearest ${from.type}`;
  return "Template position";
}
