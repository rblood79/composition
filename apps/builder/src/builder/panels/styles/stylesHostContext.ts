import { createContext } from "react";
import type { BreakpointName } from "@composition/shared";
import type { ElementStyleContext } from "./hooks/useElementStyleContext";
import type { CatalogPositionChange } from "../../catalogRuntime/position";
import type { RatioEditError } from "../../utils/ratioEditError";
import type { FillItem } from "../../../types/builder/fill.types";
import type { SelectedElement } from "../../inspector/types";
import type { ResponsiveOverridesInfo } from "./hooks/useResponsiveOverrides";

/** The selected element as the style actions read it when they run. */
export interface StylesTargetSnapshot {
  id: string | null;
  type: string | undefined;
  /** Authored style at the active breakpoint (a reusable instance: its origin's under its own). */
  style: Record<string, unknown>;
  /** The drawn record's effective CSS view (`catalogEffectiveStyle`); undefined without a record. */
  effective?: Record<string, string | number>;
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
 * commands read the current state when they run. The catalog Styles panel (ADR-248 Phase 4e-4d)
 * provides the catalog workspace; there is no default (4e-7 removed the old store host).
 */
/** One axis of a {@link StylesHost.applyGridTracks} edit. */
export interface StylesGridTrackEdit {
  axis: "column" | "row";
  template: string;
  removed: readonly number[];
  /** A reorder (`order[newIndex] = oldIndex`): the pinned items go with their tracks. */
  order?: readonly number[];
  /**
   * A track delete (Figma — the Layout 「−」, the Canvas header's Delete): the items only in the
   * removed tracks are deleted. Without it (a smaller count, the grid picker) they move to the
   * nearest cells.
   */
  deleteContents?: boolean;
  /**
   * Tracks that become Hug (Figma — a hugging track cannot be filled): the items only in one of
   * them whose size along the axis is not fixed get their drawn size as a fixed size, so the
   * track keeps its size (one step with the template).
   */
  hugged?: readonly number[];
}

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
  /**
   * Flex container keys (alignment · direction · space · wrap) as one step, with `display: flex` on
   * each selected target that is not already `inline-flex` (judged per target, not by the first).
   */
  updateFlexStyles(styles: Record<string, string>): void;
  /** A live value while dragging (no history). */
  previewStyle(property: string, value: string): void;
  updateProperty(key: string, value: unknown): void;
  updateProperties(props: Record<string, unknown>): void;
  /** Props and CSS keys (empty = remove) as one history step. */
  updatePropertiesWithStyles(
    props: Record<string, unknown>,
    styles: Record<string, string>,
  ): void;
  /** The parent record of a record (its layout decides the size modes on offer). */
  useParentId(id: string | null): string | null;
  /** A record's parent box layout: `display` and `flexDirection` (fill availability, size mode). */
  useParentLayout(id: string | null): {
    display: string;
    flexDirection: string;
  };
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
  applyAbsolute(
    selectedId: string | null,
    on: boolean,
    /** ADR-275 Phase 7: placed in the page viewport (`fixed`) instead of the parent. */
    position?: "absolute" | "fixed",
  ): RatioEditError | null;
  /**
   * ADR-275 — one Position section edit on the selection (pin · side value · Fill · Relative
   * offset), as one step; the box stays where it is drawn. An error code or null.
   */
  applyPosition(
    selectedId: string | null,
    change: CatalogPositionChange,
  ): RatioEditError | null;
  /**
   * A grid's column · row templates with the tracks each removed (0-based, in the old list): the
   * items in them move — the pinned ones past them shift back, spans across them shrink — one step
   * for all the edits (the grid picker sets both axes).
   */
  applyGridTracks?(
    selectedId: string | null,
    edits: readonly StylesGridTrackEdit[],
  ): void;
  /** The selected element's paint layers (a legacy background color as one virtual layer). */
  readFills(): FillItem[];
  /** Replace the selection's paint layers; fill-derived background CSS goes (one step). */
  updateFills(fills: FillItem[]): void;
  /** Fill reset: the selection's own layers go (an instance child shows its template's again). */
  resetFills(): void;
  /**
   * Live paint layers while dragging a Fill (no history; the release commits through
   * `updateFills`). Absent = commit-only.
   */
  previewFills?(fills: FillItem[]): void;
  /**
   * Put the selection's own values back after a cancelled drag (Escape, pointer cancel).
   */
  cancelPreview?(): void;
  /**
   * Counts the ends of drags (each commit, each `cancelPreview`): a preview a section scheduled
   * before the count moved is stale and is not shown.
   */
  previewEpoch?(): number;
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
  /**
   * The parent that owns the element's style axis as a delegated sub-part: the panel shows the
   * owner notice instead of fields nothing reads.
   */
  subpartStyleOwnerOf(id: string | null | undefined): string | null;
  /**
   * A page body's position on the page canvas, which the Position row edits: `usePosition` is a
   * hook (null = not a page body).
   */
  pagePosition: {
    usePosition(selectedId: string | null): {
      pageId: string;
      x: number;
      y: number;
      editable: boolean;
    } | null;
    commit(pageId: string, point: { x: number; y: number }): void;
  };
  /**
   * The color picker's Document palette sources from the host's own document: `revision` changes
   * when they may have changed.
   */
  documentColors: {
    subscribe(listener: () => void): () => void;
    revision(): number;
    read(): Iterable<{
      style?: Record<string, unknown> | null;
      fills?: readonly FillItem[] | null;
    }>;
  };
}

/** Provided by the catalog Styles panel; `useStylesHost` throws without it. */
export const StylesHostContext = createContext<StylesHost | null>(null);
