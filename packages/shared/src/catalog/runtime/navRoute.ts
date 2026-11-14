/**
 * (2026-11-14, 사용자 「Nav 현재 경로 표시」) A Nav marks the Link whose `href` is its route — S2 SideNav's
 * `selectedRoute` (unset: the shown page's route, as a SideNav — `catalogSideNavRoute`). The Canvas reads it
 * as derived values (`presence.ts`), the DOM as RAC `aria-current` (`navRoute.components.tsx`); the weight
 * is the Link rule's `isCurrent` state value, one place for both.
 */
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluateConditionTree } from "../rule/conditionTree";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogSideNavRoute, type CatalogSideNavShownRoute } from "./sideNav";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** The nearest Nav above a node (through any frame · Group between). */
export function catalogNavOf(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId))
    if (typeOf(parent) === "Nav") return parent;
  return undefined;
}

/** Every Link under a Nav (not under a Nav nested in it). */
export function catalogNavLinks(
  nav: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  return nav.children.flatMap((id) => {
    const child = get(id);
    if (!child || typeOf(child) === "Nav") return [];
    return [
      ...(typeOf(child) === "Link" ? [child] : []),
      ...catalogNavLinks(child, get, typeOf),
    ];
  });
}

/** The Link rule's current weight (its `isCurrent` state value — S2 SideNav's bold current row). */
export function catalogNavCurrentWeight(): number | undefined {
  const weight = evaluateConditionTree(
    COMPONENT_RULES_TABLE.Link?.structure?.stateStyles?.fontWeight as never,
    { isCurrent: true },
  );
  return weight === undefined ? undefined : Number(weight);
}

/** A Nav Link's derived values: `_navCurrent` (the `isCurrent` condition) and the current weight. */
export function catalogNavLinkDerived(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  shownRoute?: CatalogSideNavShownRoute,
): Record<string, boolean | number> | undefined {
  if (typeOf(node) !== "Link") return undefined;
  const nav = catalogNavOf(node, get, typeOf);
  const route = nav && catalogSideNavRoute(nav, shownRoute);
  if (!route || node.props.href !== route) return undefined;
  const weight = catalogNavCurrentWeight();
  return {
    _navCurrent: true,
    ...(weight === undefined ? {} : { fontWeight: weight }),
  };
}
