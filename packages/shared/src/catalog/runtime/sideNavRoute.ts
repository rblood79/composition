import { createContext } from "react";

/**
 * ADR-300 user decision 1 — the route a SideNav marks when its `selectedRoute` is unset: the path
 * the running Preview · Publish shows (`CatalogPreviewSession.path` — the page's route, or the path
 * a link went to). Absent (no session) = none marked.
 */
export const CatalogCurrentRouteContext = createContext<string | undefined>(
  undefined,
);
