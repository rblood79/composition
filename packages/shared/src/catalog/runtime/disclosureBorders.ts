import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluateConditionTree } from "../rule/conditionTree";

/**
 * S2 1.8.0 Disclosure borders (2026-10-10): a 1px top and bottom border, none when quiet, and inside
 * an Accordion only the last item keeps its bottom border (S2 `isInGroup` · `:last-child`). The
 * same declarations the generated sheet applies — the Disclosure rule's `composition.containerStyles`
 * (`border-top` · `border-bottom`) refined by its state tree (`structure.stateStyles` — quiet ·
 * `inGroup`, ADR-297 Phase 3c). The Canvas reads them for the engine's per-side border
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
  // ADR-297 Phase 3c — the rule's state tree (`structure.stateStyles` — quiet · `inGroup` = an item of a
  //   group that is not its last, the DOM's `[data-in-group]:not(:last-child)`).
  const trees = COMPONENT_RULES_TABLE.Disclosure.structure?.stateStyles;
  const conditions = {
    isQuiet: state.quiet,
    inGroup: state.inGroup && !state.last,
  };
  const topWidth = evaluateConditionTree(trees?.borderTopWidth, conditions);
  const bottomWidth = evaluateConditionTree(
    trees?.borderBottomWidth,
    conditions,
  );
  if (topWidth !== undefined)
    widths.top = Number.parseFloat(String(topWidth)) || 0;
  if (bottomWidth !== undefined)
    widths.bottom = Number.parseFloat(String(bottomWidth)) || 0;
  return { ...widths, color: (top ?? bottom)!.color };
}
