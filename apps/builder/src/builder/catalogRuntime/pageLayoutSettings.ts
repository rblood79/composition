import type { BreakpointName } from "@composition/shared";
import type { PageLayoutDeclaration } from "../../../../../packages/shared/src/catalog/document/types";
import { setPageLayoutSettings } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  MAX_PAGE_LAYOUT_COLUMNS,
  normalizeAutoFitZoom,
  resolvePageLayout,
} from "../workspace/canvas/scene/pagePlacement";
import { catalogPageLayoutSettings } from "./compositionRoot";

export type CatalogPageDirection = "auto" | "vertical" | "horizontal";

/** What Settings shows for the page grid at a breakpoint (ADR-232). */
export interface CatalogPageLayoutView {
  direction: CatalogPageDirection;
  gap: number;
  /** `"auto"` = as many as the monitor fits at `autoFitZoom`; else the column count. */
  columns: number | "auto";
  /** The auto columns' fit zoom (%) — one value for every breakpoint (ADR-274). */
  autoFitZoom: number;
  /** The column count drawn now (auto: derived from the monitor width; else `columns`). */
  columnCount: number;
  /** A tier below desktop may override gap and columns. */
  tierOverrideAvailable: boolean;
  hasTierOverride: boolean;
}

export function catalogPageLayoutView(
  layout: PageLayoutDeclaration | undefined,
  breakpoint: BreakpointName,
  /** The monitor width the Canvas derives auto columns from (`screen.width`). */
  screenWidth?: number,
): CatalogPageLayoutView {
  const resolved = resolvePageLayout(
    catalogPageLayoutSettings(layout),
    breakpoint,
    screenWidth,
  );
  const tier =
    breakpoint === "desktop" ? undefined : layout?.breakpoints?.[breakpoint];
  return {
    direction: layout?.direction ?? "auto",
    gap: resolved.gap,
    columns: resolved.columnsAuto ? "auto" : resolved.columns,
    autoFitZoom: resolved.autoFitZoom,
    columnCount: resolved.columns,
    tierOverrideAvailable: breakpoint !== "desktop",
    hasTierOverride:
      !!tier && (tier.gap !== undefined || tier.columns !== undefined),
  };
}

export type CatalogPageLayoutChange =
  | { kind: "direction"; direction: CatalogPageDirection }
  | { kind: "gap"; gap: number }
  | { kind: "columns"; columns: number | "auto" }
  /** Auto columns at this fit zoom (%): columns become `"auto"`, the zoom is breakpoint-wide. */
  | { kind: "autoFitZoom"; percent: number }
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
    case "autoFitZoom":
      setValue("columns", "auto");
      next.autoFitZoom = Math.round(normalizeAutoFitZoom(change.percent));
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
 * The Settings column field (ADR-274): `%` = Auto at that fit zoom, no unit = a fixed count.
 * Auto shows the zoom (`40%`), Fixed the count (`3`).
 */
export function catalogPageColumnsFieldValue(
  view: Pick<CatalogPageLayoutView, "columns" | "autoFitZoom">,
): string {
  return view.columns === "auto" ? `${view.autoFitZoom}%` : String(view.columns);
}

/**
 * A typed (or unit-menu) value of the column field as an edit. The number means a zoom under `%`
 * and a count without a unit, so a unit switch that carries the shown number over (the unit
 * menu keeps it) reads as a mode switch: Fixed → `%` keeps the stored zoom, Auto → no unit pins
 * the count drawn now. `auto` typed = Auto at the stored zoom (absent = 40 %). `null` = ignore.
 */
export function catalogPageColumnsChange(
  view: Pick<CatalogPageLayoutView, "columns" | "autoFitZoom" | "columnCount">,
  typed: string,
): CatalogPageLayoutChange | null {
  const text = typed.trim().toLowerCase();
  if (text === "auto") return { kind: "autoFitZoom", percent: view.autoFitZoom };
  const match = /^(\d+(?:\.\d+)?)(%?)$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (match[2] === "%")
    return {
      kind: "autoFitZoom",
      percent:
        view.columns !== "auto" && value === view.columns
          ? view.autoFitZoom
          : value,
    };
  if (view.columns === "auto" && value === view.autoFitZoom)
    return { kind: "columns", columns: view.columnCount };
  const columns = Math.round(value);
  if (columns < 1) return null;
  return {
    kind: "columns",
    columns: Math.min(MAX_PAGE_LAYOUT_COLUMNS, columns),
  };
}
