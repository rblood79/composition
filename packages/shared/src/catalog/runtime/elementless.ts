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
