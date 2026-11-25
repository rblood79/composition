import { componentTypeSet } from "../../domain/componentTraits";
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
  ...componentTypeSet("submenuTrigger"),
  "CalendarMonthPicker",
  "CalendarYearPicker",
]);

/**
 * The S2 contexts placed empty, their content dropped in: Skeleton (ADR-314) · ImageCoordinator (S2
 * 체크리스트 부록 D.2, 2026-11-24).
 */
const DROP_SPOT_TYPES: ReadonlySet<string> = new Set([
  "Skeleton",
  "ImageCoordinator",
]);

/**
 * ADR-314 사용자 결정 3 (2026-11-18): an S2 Skeleton (· ImageCoordinator) with nothing in it has no box
 * (`display: contents`, no children) — the Canvas alone gives it an edit-only placeholder, a dashed
 * stand-in the author can click and drop content into (the Preview · Publish DOM has nothing, as S2).
 * The engine input (`compositionRoot.ts` `recordStyle`) and the Canvas paint (`canvasBinding.ts`
 * `skeleton` · `imagecoordinator`) read this one predicate.
 */
export function catalogEmptyDropSpot(
  type: string | null | undefined,
  childCount: number,
): boolean {
  return !!type && DROP_SPOT_TYPES.has(type) && childCount === 0;
}

/** The empty context's edit-only placeholder box (engine input — the Canvas only). */
export const CATALOG_EMPTY_DROP_SPOT_STYLE: Readonly<Record<string, string>> = {
  display: "block",
  width: "100%",
  height: "48px",
};

export function catalogElementlessType(
  type: string | null | undefined,
): boolean {
  if (!type) return false;
  if (DOM_ELEMENTLESS_TYPES.has(type)) return true;
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
