import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * Whether a type is a node RAC renders without an element of its own — MenuTrigger · DialogTrigger ·
 * TooltipTrigger · ContextualHelp · Autocomplete: the DOM gives only its children, and the catalog
 * rule's root `display: contents` lays the children out in its parent's flow on the Canvas. It has
 * no box, so a Layout · Style · Text value on it reaches neither consumer (the Design panel says so
 * — 2026-10-15). Read from the rule, the one place both consumers take it from.
 */
/**
 * Nodes whose DOM binding renders no element though the catalog has no `display: contents` rule for
 * them — a RAC part with no element of its own (`domBinding.runtime.ts`: `TreeItemContent` ·
 * SideNav's `NavigationTreeItemContent` · `SubmenuTrigger` · the calendar month · year pickers). A
 * value written on them reaches no DOM box, so the Design panel and the Canvas spacing handles treat
 * them as elementless too (2026-11-13 전수 감사 — the panel edited them, only the Canvas drew it).
 */
const DOM_ELEMENTLESS_TYPES: ReadonlySet<string> = new Set([
  "TreeItemContent",
  "SideNavItemContent",
  "SubmenuTrigger",
  "CalendarMonthPicker",
  "CalendarYearPicker",
]);

/**
 * RAC `FileTrigger` has no element either — a hidden input and a `PressResponder` around its
 * children. With no children the DOM binding draws its own `.react-aria-FileTrigger` Button (the
 * rule's box); with children (a FileUpload's trigger Button) only the children are drawn, so the
 * node has no box (2026-11-14 감사 — the Canvas drew the rule's button box around them).
 */
/**
 * ADR-314 사용자 결정 3 (2026-11-18): an S2 Skeleton with nothing in it has no box (`display:
 * contents`, no children) — the Canvas alone gives it an edit-only placeholder, a dashed stand-in
 * the author can click and drop content into (the Preview · Publish DOM has nothing, as S2). The
 * engine input (`compositionRoot.ts` `recordStyle`) and the Canvas paint (`canvasBinding.ts`
 * `skeleton`) read this one predicate.
 */
export function catalogEmptySkeleton(
  type: string | null | undefined,
  childCount: number,
): boolean {
  return type === "Skeleton" && childCount === 0;
}

/** The empty Skeleton's edit-only placeholder box (engine input — the Canvas only). */
export const CATALOG_EMPTY_SKELETON_STYLE: Readonly<Record<string, string>> = {
  display: "block",
  width: "100%",
  height: "48px",
};

export function catalogElementlessWithChildren(
  type: string | null | undefined,
): boolean {
  return type === "FileTrigger";
}

export function catalogElementlessType(
  type: string | null | undefined,
  hasChildren = false,
): boolean {
  if (!type) return false;
  if (DOM_ELEMENTLESS_TYPES.has(type)) return true;
  if (hasChildren && catalogElementlessWithChildren(type)) return true;
  const rule = (
    COMPONENT_RULES_TABLE as Readonly<
      Record<
        string,
        { structure?: { containerStyles?: { display?: unknown } } } | undefined
      >
    >
  )[type];
  return rule?.structure?.containerStyles?.display === "contents";
}
