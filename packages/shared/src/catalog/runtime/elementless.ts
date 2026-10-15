import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * Whether a type is a node RAC renders without an element of its own — MenuTrigger · DialogTrigger ·
 * TooltipTrigger · ContextualHelp · Autocomplete: the DOM gives only its children, and the catalog
 * rule's root `display: contents` lays the children out in its parent's flow on the Canvas. It has
 * no box, so a Layout · Style · Text value on it reaches neither consumer (the Design panel says so
 * — 2026-10-15). Read from the rule, the one place both consumers take it from.
 */
export function catalogElementlessType(
  type: string | null | undefined,
): boolean {
  if (!type) return false;
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
