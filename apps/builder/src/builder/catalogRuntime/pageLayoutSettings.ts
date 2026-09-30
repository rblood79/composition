import type { BreakpointName } from "@composition/shared";
import type { PageLayoutDeclaration } from "../../../../../packages/shared/src/catalog/document/types";
import { setPageLayoutSettings } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  resolveAutoColumns,
  resolvePageLayout,
} from "../workspace/canvas/scene/pagePlacement";
import {
  catalogPageLayoutSettings,
  type CatalogCompositionRoot,
} from "./compositionRoot";

export type CatalogPageDirection = "auto" | "vertical" | "horizontal";

/** What Settings shows for the page grid at a breakpoint (ADR-232). */
export interface CatalogPageLayoutView {
  direction: CatalogPageDirection;
  gap: number;
  /** `"auto"` = as many as the visible Canvas fits; else the column count. */
  columns: number | "auto";
  /** A tier below desktop may override gap and columns. */
  tierOverrideAvailable: boolean;
  hasTierOverride: boolean;
}

export function catalogPageLayoutView(
  layout: PageLayoutDeclaration | undefined,
  breakpoint: BreakpointName,
): CatalogPageLayoutView {
  const resolved = resolvePageLayout(
    catalogPageLayoutSettings(layout),
    breakpoint,
  );
  const tier =
    breakpoint === "desktop" ? undefined : layout?.breakpoints?.[breakpoint];
  return {
    direction: layout?.direction ?? "auto",
    gap: resolved.gap,
    columns: resolved.columnsAuto ? "auto" : resolved.columns,
    tierOverrideAvailable: breakpoint !== "desktop",
    hasTierOverride:
      !!tier && (tier.gap !== undefined || tier.columns !== undefined),
  };
}

export type CatalogPageLayoutChange =
  | { kind: "direction"; direction: CatalogPageDirection }
  | { kind: "gap"; gap: number }
  | { kind: "columns"; columns: number | "auto" }
  | { kind: "tierOverride"; enabled: boolean };

/**
 * One Settings edit as a page layout command. Gap and columns write the active tier when it
 * overrides them, else the base; turning the override on pins the current values to the tier (the
 * toggle itself changes nothing drawn), off removes the tier's values.
 */
export function catalogPageLayoutCommand(
  layout: PageLayoutDeclaration | undefined,
  breakpoint: BreakpointName,
  change: CatalogPageLayoutChange,
): CatalogCommand {
  const view = catalogPageLayoutView(layout, breakpoint);
  const next: PageLayoutDeclaration = { ...layout };
  const breakpoints = { ...(layout?.breakpoints ?? {}) };
  const writeTier = view.tierOverrideAvailable && view.hasTierOverride;
  const setValue = (key: "gap" | "columns", value: number | "auto") => {
    if (writeTier)
      breakpoints[breakpoint] = { ...breakpoints[breakpoint], [key]: value };
    else (next as Record<string, unknown>)[key] = value;
  };
  switch (change.kind) {
    case "direction":
      next.direction = change.direction;
      break;
    case "gap":
      setValue("gap", change.gap);
      break;
    case "columns":
      setValue("columns", change.columns);
      break;
    case "tierOverride":
      if (change.enabled)
        breakpoints[breakpoint] = {
          gap: view.gap,
          columns: layout?.columns ?? view.columns,
        };
      else delete breakpoints[breakpoint];
      break;
  }
  if (Object.keys(breakpoints).length) next.breakpoints = breakpoints;
  else delete next.breakpoints;
  return setPageLayoutSettings({ pageLayout: next, label: "Page layout" });
}

/**
 * `columns: "auto"` (ADR-232 follow-up): the integer column count the visible Canvas fits at this
 * zoom — the Canvas width minus the floating panel rails (`readCanvasRailInset`). `undefined` when
 * the page grid's columns are fixed.
 */
export function catalogAutoColumns(
  root: Pick<CatalogCompositionRoot, "pageLayout">,
  visibleWidth: number,
  zoom: number,
): number | undefined {
  const layout = root.pageLayout();
  if (!layout.columnsAuto) return undefined;
  return resolveAutoColumns(visibleWidth, zoom, layout.trackWidth, layout.gap);
}
