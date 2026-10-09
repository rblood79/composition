import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * S2 1.8.0 Disclosure borders (2026-10-10): a 1px top and bottom border, none when quiet, and inside
 * a DisclosureGroup only the last item keeps its bottom border (S2 `isInGroup` · `:last-child`). The
 * same declarations the generated sheet applies — the Disclosure rule's `composition.containerStyles`
 * (`border-top` · `border-bottom`) refined by its `rootSelectors` (`&[data-quiet="true"]` ·
 * `&[data-in-group]:not(:last-child)`). The Canvas reads them for the engine's per-side border
 * (`styleOf`) and the box's side strokes (`canvasBinding.ts`).
 */
export type CatalogDisclosureBorders = {
  readonly top: number;
  readonly bottom: number;
  /** The CSS color as declared (`var(--border)`). */
  readonly color: string;
};

export function catalogDisclosureBorders(state: {
  readonly quiet: boolean;
  readonly inGroup: boolean;
  readonly last: boolean;
}): CatalogDisclosureBorders | undefined {
  const composition = COMPONENT_RULES_TABLE.Disclosure.structure
    ?.composition as
    | {
        containerStyles?: Record<string, string>;
        rootSelectors?: Record<string, { styles?: Record<string, string> }>;
      }
    | undefined;
  const side = (key: "border-top" | "border-bottom") => {
    const value = composition?.containerStyles?.[key];
    if (value === undefined) return undefined;
    const match = /^(\d+(?:\.\d+)?)px solid (.+)$/.exec(value);
    if (!match) throw new Error(`CATALOG_DISCLOSURE_BORDER_UNSUPPORTED:${key}`);
    return { width: Number(match[1]), color: match[2] };
  };
  const top = side("border-top");
  const bottom = side("border-bottom");
  if (!top && !bottom) return undefined;
  const widths = { top: top?.width ?? 0, bottom: bottom?.width ?? 0 };
  const active: Readonly<Record<string, boolean>> = {
    '[data-quiet="true"]': state.quiet,
    "[data-in-group]": state.inGroup,
    ":last-child": state.last,
    ":not(:last-child)": !state.last,
  };
  for (const [selector, entry] of Object.entries(
    composition?.rootSelectors ?? {},
  )) {
    const conditions = selector
      .slice(1)
      .match(/:not\(:last-child\)|:last-child|\[[\w-]+(?:="[\w-]+")?\]/g);
    if (conditions?.join("") !== selector.slice(1))
      throw new Error(`CATALOG_DISCLOSURE_SELECTOR_UNSUPPORTED:${selector}`);
    if (!conditions.every((condition) => active[condition])) continue;
    const styles = entry.styles ?? {};
    if (styles["border-top-width"] !== undefined)
      widths.top = Number.parseFloat(styles["border-top-width"]) || 0;
    if (styles["border-bottom-width"] !== undefined)
      widths.bottom = Number.parseFloat(styles["border-bottom-width"]) || 0;
  }
  return { ...widths, color: (top ?? bottom)!.color };
}
