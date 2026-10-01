import { createContext } from "react";
import type { BreakpointName } from "@composition/shared";
import type { ElementStyleContext } from "./hooks/useElementStyleContext";
import type { RatioEditError } from "../../stores/inspectorActions";
import type { FillItem } from "../../../types/builder/fill.types";
import type { SelectedElement } from "../../inspector/types";
import type { ResponsiveOverridesInfo } from "./hooks/useResponsiveOverrides";

/** The selected element as the style actions read it when they run. */
export interface StylesTargetSnapshot {
  id: string | null;
  type: string | undefined;
  /** Authored style at the active breakpoint (a reusable instance: its origin's under its own). */
  style: Record<string, unknown>;
  props: Record<string, unknown>;
}

/** One Size axis edit (ADR-026 size mode): fill with a weight, a CSS length, or reset. */
export interface StylesSizingEdit {
  axis: "width" | "height";
  mode: "fill" | "css" | "reset";
  value?: string;
  factor?: number;
}

/** A record's measured box key (px). */
export type StylesLayoutKey = "width" | "height" | "x" | "y";

/**
 * Where the Styles panel reads the selection and writes its edits. Hooks (`use*`) subscribe;
 * commands read the current state when they run. The default is the old store; the catalog
 * Styles panel (ADR-248 Phase 4e-4d) provides the catalog workspace, so the sections are shared.
 */
export interface StylesHost {
  useSelectedId(): string | null;
  /** The selected id now (a field's blur compares it with the id it was focused on). */
  readSelectedId(): string | null;
  useActiveBreakpoint(): BreakpointName;
  useElementStyleContext(id: string | null): ElementStyleContext;
  readSelectedTarget(): StylesTargetSnapshot;
  /** One CSS key (empty = remove); one history step. */
  updateStyle(property: string, value: string): void;
  /** Several CSS keys as one step. */
  updateStyles(styles: Record<string, string>): void;
  /** A live value while dragging (no history). */
  previewStyle(property: string, value: string): void;
  updateProperty(key: string, value: unknown): void;
  updateProperties(props: Record<string, unknown>): void;
  /** The parent record of a record (its layout decides the size modes on offer). */
  useParentId(id: string | null): string | null;
  /** A record's parent box layout: `display` and `flexDirection` (fill availability, size mode). */
  useParentLayout(id: string | null): { display: string; flexDirection: string };
  /** A record's measured box (px), following layout. */
  useLayoutValue(id: string | null, key: StylesLayoutKey): number | undefined;
  /** One Size axis edit on the selection, as one step (ignored if `selectedId` is stale). */
  applySizing(selectedId: string | null, edit: StylesSizingEdit): void;
  /** Ratio preset / lock at the measured ratio (`null`) / unlock (`""`); an error code or null. */
  applyRatio(
    selectedId: string | null,
    value: string | null,
  ): RatioEditError | null;
  /**
   * The Position section's absolute toggle on the selection (ADR-224 §6.1): on keeps where each
   * element is drawn; off returns it to the flow. An error code or null.
   */
  applyAbsolute(selectedId: string | null, on: boolean): RatioEditError | null;
  /** The selected element's paint layers (a legacy background color as one virtual layer). */
  readFills(): FillItem[];
  /** Replace the selection's paint layers; fill-derived background CSS goes (one step). */
  updateFills(fills: FillItem[]): void;
  /** Fill reset: the selection's own layers go (an instance child shows its template's again). */
  resetFills(): void;
  /** Which of `properties` (CSS keys) the selection authors at the active breakpoint. */
  useDirtyStyleProps(properties: readonly string[]): string[];
  /** Reset `properties` on the selection (only what is authored; nothing = no step). */
  resetStyles(properties: readonly string[]): void;
  /** The selection's breakpoint overrides and per-breakpoint visibility (Responsive tab). */
  useResponsiveOverrides(): ResponsiveOverridesInfo;
  /**
   * Turn a property's override at the active tablet/mobile breakpoint on (the current value is
   * copied into that layer — `seedDefaults` where the element has none) or off (the layer's value
   * goes). No-op on desktop.
   */
  setResponsiveOverride(
    property: string,
    enabled: boolean,
    seedDefaults?: Partial<Record<string, string>>,
  ): void;
  /** Show or hide the selection at a tablet/mobile breakpoint. */
  setResponsiveVisibility(breakpoint: BreakpointName, visible: boolean): void;
  /** The selected element as the panel frame reads it (title, Modified list, copy). */
  useSelectedElement(): SelectedElement | null;
  /** The old Canvas editor presentation channel (live paint while editing) is available. */
  presentation: boolean;
  /**
   * The color picker's Document palette sources from the host's own document (absent = the old
   * store's elements): `revision` changes when they may have changed.
   */
  documentColors?: {
    subscribe(listener: () => void): () => void;
    revision(): number;
    read(): Iterable<{
      style?: Record<string, unknown> | null;
      fills?: readonly FillItem[] | null;
    }>;
  };
}

/** `null` = the old store (`STORE_STYLES_HOST`); the catalog Styles panel provides its own. */
export const StylesHostContext = createContext<StylesHost | null>(null);
