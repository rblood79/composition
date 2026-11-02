/**
 * ADR-300 Decision 7 (user decision 5) — the SideNav family's DOM loads with the first SideNav: the
 * RAC `NavigationTree` · `Link` parts and their components are a lazy chunk (the Builder's initial
 * bundle was over its ADR-201 ceiling with them — Phase 2 G4). Until it loads the panel · nav draw
 * their own box, empty (the same element · class · inline style); once loaded every later SideNav
 * draws at once (`use` reads the settled promise synchronously).
 */
import {
  cloneElement,
  createElement,
  Fragment,
  Suspense,
  use,
  type ReactElement,
} from "react";
import { overScopeProps } from "./racSlotScope";

type SideNavModule = typeof import("./sideNav.components");

let loaded: SideNavModule | undefined;
let pending: Promise<SideNavModule> | undefined;

/** Load the SideNav DOM chunk (once). Tests · a host that must draw it synchronously await it. */
export function loadCatalogSideNav(): Promise<SideNavModule> {
  if (!pending) {
    const promise = import("./sideNav.components").then((module) => {
      loaded = module;
      // (React's thenable fields: a settled chunk is read synchronously by `use` — no suspend for a
      //  SideNav drawn after the first, nor for a render that awaited the load.)
      Object.assign(promise, { status: "fulfilled", value: module });
      return module;
    });
    pending = promise;
  }
  return pending;
}

function WithSideNav({
  render,
}: {
  render: (module: SideNavModule) => ReactElement;
}): ReactElement {
  // (Always `use` — skipping it on the render after a suspend is React's conditional-use error.)
  return render(use(loadCatalogSideNav()));
}

/**
 * The panel · nav element's boundary: what the DOM pass puts on the binding's element (the rules'
 * handlers — `withRuntime`, the authored state styles — `withCatalogStateStyles`) reaches the
 * element the chunk draws (and its empty box), not the `Suspense` (RacSlotScope's merge).
 */
function SideNavLazyBoundary({
  fallback,
  render,
  ...given
}: {
  fallback: ReactElement;
  render: (module: SideNavModule) => ReactElement;
  [key: string]: unknown;
}): ReactElement {
  const over = (element: ReactElement) =>
    Object.keys(given).length
      ? cloneElement(element, overScopeProps(element, given))
      : element;
  return createElement(
    Suspense,
    { fallback: over(fallback) },
    createElement(WithSideNav, {
      render: (module: SideNavModule) => over(render(module)),
    }),
  );
}

/** A SideNav panel · nav element: drawn by the loaded chunk, its empty box until then. */
export function catalogSideNavLazy(
  key: string,
  fallback: ReactElement,
  render: (module: SideNavModule) => ReactElement,
): ReactElement {
  return createElement(SideNavLazyBoundary, { key, fallback, render });
}

/**
 * A row part (content · link · header): it renders inside a drawn SideNav, so the chunk is there;
 * a part outside one (no SideNav drew it) draws nothing (an empty fragment — the DOM pass decorates
 * an element).
 */
export function catalogSideNavPart(
  render: (module: SideNavModule) => ReactElement,
): ReactElement {
  return loaded ? render(loaded) : createElement(Fragment);
}
