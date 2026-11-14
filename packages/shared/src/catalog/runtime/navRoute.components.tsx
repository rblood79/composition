import { createContext, forwardRef, useContext } from "react";
import type { LinkProps } from "react-aria-components/Link";
import { LinkPrimitive as Link } from "../../components/LinkPrimitive";
import { CatalogCurrentRouteContext } from "./sideNavRoute";

/**
 * (2026-11-14) The route a Nav marks, given to the Links below it: its authored `selectedRoute`, or
 * `null` — the shown route (`CatalogCurrentRouteContext`, as a SideNav). `undefined` = not in a Nav.
 */
export const CatalogNavRouteContext = createContext<string | null | undefined>(
  undefined,
);

/** A catalog Link: the shared Link primitive, `aria-current="page"` when it is its Nav's route (RAC → `data-current`). */
export const CatalogNavLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function CatalogNavLink(props, ref) {
    const navRoute = useContext(CatalogNavRouteContext);
    const shownRoute = useContext(CatalogCurrentRouteContext);
    if (navRoute === undefined) return <Link {...props} ref={ref} />;
    const route = navRoute ?? shownRoute;
    return (
      <Link
        {...props}
        ref={ref}
        aria-current={
          route && props.href === route ? "page" : props["aria-current"]
        }
      />
    );
  },
);
