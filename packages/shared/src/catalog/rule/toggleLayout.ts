import { resolveToken, type TokenRef } from "@composition/rendering";

/**
 * (2026-11-15, 사용자 「toggle 레이아웃 차이 3개 진행」) S2 1.8.2 `Checkbox.tsx` · `Switch.tsx` · `RadioGroup.tsx`
 * (`Radio`): the field is a grid `[max-content 1fr]` with `columnGap: text-to-control`; its button is a
 * `subgrid` row with `alignItems: baseline` and the indicator in a `CenterBaseline` (centred on the first
 * line); the HelpText sits in column 1 (a Checkbox · Switch) or column 2 (a Radio, a Checkbox in a group),
 * `rowGap` `calc(var(--field-height) - 1lh)` (a Checkbox · Switch) or 1 · 1 · 2 · 2 (a Radio, a Checkbox in a
 * group). Our toggle stays a flex column (root `gap` = `text-to-control`, the button's row gap too — one
 * size value): these delegations place the same boxes — both consumers read them (the generated sheet; the
 * Canvas part rules compiled from them).
 *
 * - ① the help text's start: a column-2 help text starts past the indicator and the gap
 *   (`{size.height-sm.<S>}` + 10/14 em).
 * - ② the button ↔ help text distance: the help text's top margin is S2's row gap less the root's gap.
 * - ③ the indicator on the first line: the button rows from the top, the indicator `(1lh − box) / 2` down
 *   (S2 `CenterBaseline` — the same place as centring for one line, the first line's for several).
 */
/** A rule `composition.delegation` entry (`DelegationSpec` — `@composition/rendering` spec types). */
interface ToggleDelegation {
  childSelector: string;
  prefix: string;
  variables: Record<string, Record<string, string>>;
  bridges: Record<string, string>;
}
/** The toggle sizes (the Checkbox · Radio · Switch rules). */
export const TOGGLE_SIZES = ["S", "M", "L", "XL"] as const;
export type ToggleSize = (typeof TOGGLE_SIZES)[number];
const isToggleSize = (size: unknown): size is ToggleSize =>
  (TOGGLE_SIZES as readonly unknown[]).includes(size);
/** S2 `controlFont()` per size (repository text steps). */
export const TOGGLE_FONT: Record<ToggleSize, string> = {
  S: "text-xs",
  M: "text-sm",
  L: "text-base",
  XL: "text-lg",
};
/** S2's group row gap (`space(1)` · `space(1)` · 2 · 2). */
const GROUP_ROW_GAP: Record<ToggleSize, number> = { S: 1, M: 1, L: 2, XL: 2 };

const line = (size: ToggleSize) => `typography.${TOGGLE_FONT[size]}--line-height`;
const font = (size: ToggleSize) => `typography.${TOGGLE_FONT[size]}`;
const box = (size: ToggleSize) => `size.height-sm.${size}`;
const perSize = (vars: (size: ToggleSize) => Record<string, string>) =>
  Object.fromEntries(TOGGLE_SIZES.map((size) => [size, vars(size)]));

/** ③ — the indicator's top margin on a button that rows from the top: `(1lh − box) / 2`. */
const indicatorTop = (size: ToggleSize) =>
  `{length.${line(size)}*1/2+${box(size)}*-1/2}`;
/** ② — the help text's top margin: S2's row gap less the root's `text-to-control` gap. */
const helpTop = (size: ToggleSize, help: "field" | "item") =>
  help === "field"
    ? `{length.size.height.${size}*1/1+${line(size)}*-1/1+${font(size)}*-10/14}`
    : `{length.${font(size)}*-10/14+${GROUP_ROW_GAP[size]}}`;
/** ① — a column-2 help text's start: the indicator and the `text-to-control` gap. */
const helpStart = (size: ToggleSize) =>
  `{length.${box(size)}*1/1+${font(size)}*10/14}`;

/**
 * A toggle's S2 field layout delegations: `prefix` (the rule's variable namespace), its button's and
 * indicator's selectors, and its help text's kind — `field` (column 1, the field-height row gap: a
 * Checkbox · Switch) or `item` (column 2, the group row gap: a Radio).
 */
export function toggleFieldLayout(
  prefix: string,
  indicator: string,
  help: "field" | "item",
): ToggleDelegation[] {
  const top = `--${prefix}-help-top`;
  const start = `--${prefix}-help-start`;
  const item = help === "item";
  return [
    {
      childSelector: indicator,
      prefix: `${prefix}-mark`,
      variables: perSize((size) => ({
        [`--${prefix}-mark-top`]: indicatorTop(size),
      })),
      // (The indicator keeps its size beside a long label — S2's `max-content` column.)
      bridges: {
        "margin-top": `var(--${prefix}-mark-top)`,
        "flex-shrink": "0",
      },
    },
    {
      childSelector: '> [slot="description"]',
      prefix: `${prefix}-help`,
      variables: perSize((size) => ({
        [top]: helpTop(size, help),
        ...(item ? { [start]: helpStart(size) } : {}),
      })),
      bridges: {
        "margin-top": `var(${top})`,
        ...(item ? { "margin-left": `var(${start})` } : {}),
      },
    },
  ];
}

/**
 * ①② for a Checkbox in a CheckboxGroup (its help text's derived `_toggleItemHelp` = the item's size,
 * `presence.ts`): the length refs both consumers place it with — the Canvas `styleOf` (resolved), the DOM
 * inline style (the refs' device formulas). The part-rule compiler does not reach a grouped item's help
 * text through the group, so this is the one channel (as an ActionButton's badge place, `actionBadge.ts`).
 */
export function catalogToggleItemHelpRefs(
  derived: Readonly<Record<string, unknown>> | undefined,
): { marginTop: string; marginLeft: string } | undefined {
  const size = derived?._toggleItemHelp;
  return isToggleSize(size)
    ? { marginTop: helpTop(size, "item"), marginLeft: helpStart(size) }
    : undefined;
}

/** The grouped Checkbox help text's margins in px (the Canvas — `catalogToggleItemHelpRefs`). */
export function catalogToggleItemHelpLayout(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string> {
  const refs = catalogToggleItemHelpRefs(derived);
  if (!refs) return {};
  const px = (ref: string) => {
    const value = resolveToken(ref as TokenRef, "light");
    if (typeof value !== "number")
      throw new Error(`CATALOG_TOGGLE_LENGTH:${ref}`);
    return `${Math.round(value * 100) / 100}px`;
  };
  return { marginTop: px(refs.marginTop), marginLeft: px(refs.marginLeft) };
}
