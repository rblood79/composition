import { createContext } from "react";
import type { BreakpointName } from "@composition/shared";
import type { ElementStyleContext } from "./hooks/useElementStyleContext";
import type { RatioEditError } from "../../stores/inspectorActions";

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
  /** The old Canvas editor presentation channel (live paint while editing) is available. */
  presentation: boolean;
}

/** `null` = the old store (`STORE_STYLES_HOST`); the catalog Styles panel provides its own. */
export const StylesHostContext = createContext<StylesHost | null>(null);
