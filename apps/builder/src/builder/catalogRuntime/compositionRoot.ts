import type {
  DefinitionId,
  EntryId,
  NodeId,
  PageLayoutDeclaration,
  PagePlacementDeclaration,
  StateName,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { ResolvedCatalogNode } from "../../../../../packages/shared/src/catalog/resolution/resolver";
import type {
  CatalogOperation,
  CatalogTransactionResult,
} from "../../../../../packages/shared/src/catalog/transactions/transaction";
import {
  catalogNodeState,
  resolveCatalogNode,
} from "../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogAuthoredVisual } from "./libraryVisual";
import { catalogRuleTextColor } from "./ruleShapes";
import {
  PersistentLayoutTree,
  type PersistentBatchNode,
} from "../workspace/canvas/layout/engines/persistentLayoutTree";
import type { LayoutEngineAPI } from "../workspace/canvas/wasm-bindings/layoutBridge";
import type { LayoutResult } from "../workspace/canvas/wasm-bindings/engine";
import { parseGridTemplate } from "../workspace/canvas/layout/engines/gridStyleAdapter";
import {
  catalogBreadcrumbSeparatorIcon,
  catalogCurrentTextWeight,
  catalogCalendarGridSize,
  catalogCalendarHeaderParts,
} from "../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import { resolveTextSourceText } from "@composition/specs";
import { applyTextTransform } from "../workspace/canvas/styleConversion/styleConverter";
import {
  catalogAspectRatio,
  catalogFillDependents,
  catalogFillLayout,
} from "./fillLayout";
import type {
  BreakpointName,
  PagePlacement,
  PageLayoutSettingsDocument,
} from "@composition/shared";
import {
  buildContainerStyle,
  resolvePageLayout,
  resolvePagePlacementStyle,
} from "../workspace/canvas/scene/pagePlacement";
import { CANVAS_VIEWPORT } from "../workspace/canvasBreakpoints";
import {
  racDateSegmentParts,
  type DateSegmentPart,
} from "../../../../../packages/shared/src/catalog/document/dateSegments";
import { catalogDateSegmentPaddingX } from "../../../../../packages/shared/src/catalog/document/rulePartRules";
import {
  catalogBoxModel,
  catalogTextTypography,
  catalogGlyphSize,
  type CatalogLength,
} from "./boxModel";
import {
  catalogComposedParts,
  catalogDerivedProps,
  catalogDerivedPropsDependents,
  type CatalogComposedPart,
  catalogHiddenAtRest,
  catalogPresenceDependents,
  catalogPresenceScope,
  catalogBreadcrumbItems,
  catalogBreadcrumbSeparator,
  catalogItemLabels,
  catalogItemSlotInset,
  catalogLabelSuffix,
  catalogLabelSuffixDependents,
  catalogSliderThumbLayout,
  catalogSliderThumbs,
} from "./presence";
import {
  CatalogRuntime,
  type CatalogStepConsumer,
  type CatalogStepContext,
} from "./controller";
import {
  deriveSlotChromeInput,
  slotChromeLayoutNodes,
  type SlotChromeContext,
  type SlotChromeInput,
} from "./slotChrome";

export interface CatalogConsumerNode {
  readonly id: string;
  readonly sourceId: string;
  readonly definitionId: string;
  readonly bindingId: string | undefined;
  readonly definitionMode?: "primitive" | "composite" | "native";
  /** D3 rule key of a rule-backed definition (`CatalogLibrary.rules`). */
  readonly ruleId?: string;
  readonly parentId: string;
  readonly children: readonly string[];
  readonly props: ResolvedCatalogNode["props"];
  readonly visual: ResolvedCatalogNode["visual"];
  readonly layout: ResolvedCatalogNode["layout"];
  /** Author-written layout keys (`ResolvedCatalogNode.authoredLayout`): the DOM inlines these. */
  readonly authoredLayout?: ResolvedCatalogNode["authoredLayout"];
  readonly sizing: ResolvedCatalogNode["sizing"];
  readonly placement: ResolvedCatalogNode["placement"];
  /** Authored paint layers and fill intent (ADR-248 Phase 4a); absent = definition paint. */
  readonly fills?: ResolvedCatalogNode["fills"];
  readonly fillSizing?: ResolvedCatalogNode["fillSizing"];
  readonly themeOverride?: ResolvedCatalogNode["themeOverride"];
  /** The author's DOM `id` (`metadata.htmlId`). */
  readonly htmlId?: string;
  readonly slot: ResolvedCatalogNode["slot"];
  readonly name: ResolvedCatalogNode["name"];
  readonly regions: ResolvedCatalogNode["regions"];
  readonly placeholder: ResolvedCatalogNode["placeholder"];
  readonly instancePath: ResolvedCatalogNode["instancePath"];
  /**
   * A composite instance is its template root (instance root values, ADR-248 §3.4): the record
   * keeps the instance identity and source, and takes the root's definition, values and
   * children. These are the resolved identities/sources of the collapsed layers below it
   * (innermost last — the value source).
   */
  readonly collapsedIds?: readonly string[];
  readonly collapsedSourceIds?: readonly string[];
  /** Not shown in the resting state (`presence.ts`): no layout box, not drawn; subtree follows. */
  readonly hidden?: true;
  /** State-origin display state of the collapsed instance (`ResolvedCatalogNode.displayState`). */
  readonly displayState?: ResolvedCatalogNode["displayState"];
  /**
   * Values the owning RAC component gives this sub-part (`catalogDerivedProps` — a progress
   * track's fill): the Canvas paints them over the resolved props; the DOM owner renders its own.
   */
  readonly derivedProps?: Readonly<Record<string, string | number | boolean>>;
  /**
   * Inheritable text values (CSS inheritance) the nearest ancestors declare and this node does
   * not (`CATALOG_INHERITED_TEXT_KEYS`). Resolved here so the Canvas paint, the layout measure
   * and the DOM inline style read one value instead of relying on the browser cascade.
   */
  readonly inheritedText?: Readonly<Record<string, string | number | boolean>>;
  /** Fill intent projected against the parent box (`fillLayout.ts`); Rust and DOM apply it. */
  readonly fillLayout?: Readonly<Record<string, string | number>>;
}
/** Text keys a text leaf takes from its nearest declaring ancestor (CSS inherited properties). */
export const CATALOG_INHERITED_TEXT_KEYS = [
  "fontFamily",
  "fontStyle",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "whiteSpace",
  "wordBreak",
] as const;
function inheritedTextOf(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): Record<string, string | number | boolean> | undefined {
  const out: Record<string, string | number | boolean> = {};
  let missing = CATALOG_INHERITED_TEXT_KEYS.filter(
    (key) => node.visual[key] === undefined,
  );
  for (
    let cursor = get(node.parentId);
    cursor && missing.length;
    cursor = get(cursor.parentId)
  )
    missing = missing.filter((key) => {
      const value = cursor!.visual[key];
      if (value === undefined) return true;
      out[key] = value;
      return false;
    });
  return Object.keys(out).length ? out : undefined;
}
/** Descendants whose inherited text reads `node` (re-planned when its text keys change). */
function textInheritors(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (id: string) => {
    const child = get(id);
    if (!child) return;
    out.push(child);
    for (const next of child.children) visit(next);
  };
  for (const id of node.children) visit(id);
  return out;
}
/** Inputs of a record's own box that its fill children project against. */
const boxInputsChanged = (
  left: CatalogConsumerNode | undefined,
  right: CatalogConsumerNode,
): boolean =>
  !left ||
  !sameFields(left.layout, right.layout) ||
  !sameFields(left.sizing, right.sizing) ||
  JSON.stringify(left.fillSizing ?? null) !==
    JSON.stringify(right.fillSizing ?? null) ||
  left.placement?.kind !== right.placement?.kind ||
  ["width", "height", "minWidth", "minHeight", "aspectRatio"].some(
    (key) => left.visual[key] !== right.visual[key],
  ) ||
  left.bindingId !== right.bindingId;
const textKeysChanged = (
  left: CatalogConsumerNode | undefined,
  right: CatalogConsumerNode,
): boolean =>
  CATALOG_INHERITED_TEXT_KEYS.some(
    (key) => left?.visual[key] !== right.visual[key],
  );
/** The optional authored fields a record carries only when the resolved node declares them. */
function authoredFields(
  node: ResolvedCatalogNode,
): Pick<
  CatalogConsumerNode,
  "fills" | "fillSizing" | "themeOverride" | "authoredLayout" | "htmlId"
> {
  return {
    ...(node.fills ? { fills: node.fills } : {}),
    ...(node.fillSizing ? { fillSizing: node.fillSizing } : {}),
    ...(node.themeOverride ? { themeOverride: node.themeOverride } : {}),
    ...(node.authoredLayout ? { authoredLayout: node.authoredLayout } : {}),
    ...(node.htmlId ? { htmlId: node.htmlId } : {}),
  };
}
export interface CatalogRootMetrics {
  readonly revision: number;
  readonly changedIds: readonly string[];
  readonly removedIds: readonly string[];
  readonly affectedRootIds: readonly string[];
  readonly layoutInputVisits: number;
  readonly resolverVisits: number;
  /** Pruned re-resolution `include` predicate calls (one per sibling of every ancestor). */
  readonly resolverIncludeChecks: number;
  readonly affectedInstanceCount: number;
  readonly canvasInputUpdates: number;
  readonly domInputUpdates: number;
  readonly traversedWholeInputGraph: boolean;
}

/**
 * A record's Rust children: its leading composed parts, its children (a wrapper part standing in
 * for the children it wraps, at the first of them), then its Slot chrome.
 */
function layoutChildrenOf(
  children: readonly string[],
  parts: readonly CatalogComposedPart[],
  chromeId: string | undefined,
): string[] {
  const out = parts.filter((part) => !part.wraps).map((part) => part.id);
  for (const child of children) {
    const wrapper = parts.find((part) => part.wraps?.includes(child));
    if (!wrapper) out.push(child);
    else if (!out.includes(wrapper.id)) out.push(wrapper.id);
  }
  if (chromeId) out.push(chromeId);
  return out;
}

function identity(node: ResolvedCatalogNode): string {
  return `${node.instancePath.join("/")}::${node.sourceId}`;
}
/**
 * Children of a collapsed record: the innermost root's children, then each composite layer's own
 * children after its template root (instance-owned or template children, in order).
 */
function collapsedChildren(
  layers: readonly ResolvedCatalogNode[],
): readonly ResolvedCatalogNode[] {
  if (layers.length === 1) return layers[0].children;
  return [
    ...layers[layers.length - 1].children,
    ...layers
      .slice(0, -1)
      .reverse()
      .flatMap((layer) => layer.children.slice(1)),
  ];
}
/** Every graph source a record reads: its own and those of its collapsed layers. */
function recordSources(record: CatalogConsumerNode): readonly string[] {
  return record.collapsedSourceIds
    ? [record.sourceId, ...record.collapsedSourceIds]
    : [record.sourceId];
}
/** One record update computed before any root state changes (all consumer code runs here). */
interface RecordPlan {
  readonly id: string;
  readonly record: CatalogConsumerNode;
  readonly rootId: NodeId;
  readonly style: Record<string, unknown>;
  readonly styleChanged: boolean;
  readonly chrome: SlotChromeInput | undefined;
  readonly parts: readonly CatalogComposedPart[];
}
interface ConsumePlan {
  readonly result: CatalogTransactionResult;
  /** Per affected root: removed ids, then updates — applied in this order. */
  readonly roots: readonly {
    readonly rootId: NodeId;
    readonly removed: readonly string[];
    readonly updates: readonly RecordPlan[];
    /** Structural path only: the root's new member set (empty = the root is gone). */
    readonly members?: ReadonlySet<string>;
  }[];
  readonly nextRootIds?: readonly NodeId[];
  readonly rootChildren?: readonly string[];
  readonly computeLayout: boolean;
  readonly metrics: Omit<
    CatalogRootMetrics,
    "canvasInputUpdates" | "domInputUpdates"
  >;
}
type Notice = { readonly id: string; readonly record?: CatalogConsumerNode };

/** Bindings whose label never wraps (button): min-content = max-content. */
const noWrapTextBindings: ReadonlySet<string> = new Set(["button", "label"]);
/**
 * Text bindings that paint one line (`white-space: nowrap`: the button label, `Label.css`, the
 * field value); every other text wraps at its box width (CSS `normal`), as the layout measures.
 */
export const CATALOG_NOWRAP_TEXT_BINDINGS: ReadonlySet<string> = new Set([
  ...noWrapTextBindings,
  "selectvalue",
]);
/** Bindings that must measure their label (a missing font metric is an input error). */
const requiredTextBindings = new Set(["button", "label"]);
/**
 * Field value sub-parts whose width is the field's (flex / `width: 100%` in the owner's box), not
 * their text: the placeholder or value sets only the line box height.
 */
const heightOnlyTextTypes = new Set(["Input", "SelectValue", "TextArea"]);
/** Icon-font glyph bindings (Skia `icon_font`). */
const glyphBindings = new Set(["icon", "selecticon"]);

/**
 * Layout text measurement (CanvasKit paragraph metrics). Without `maxWidth`: single-line
 * max-content `width`, optional min-content `minWidth` and one line box `height`; with
 * `maxWidth`: the wrapped `height` at that content width.
 */
export interface CatalogTextMeasure {
  (
    text: string,
    font: CatalogTextFont,
    maxWidth?: number,
  ): { width: number; height: number; minWidth?: number; exactWidth?: number };
}
/** Environment of one composition root (a breakpoint switch builds a new root). */
export interface CatalogRootOptions {
  breakpoint?: BreakpointName;
  /** Product layout: pages as frames on the page container grid (ADR-232). */
  pageFrames?: boolean;
  /** `columns: "auto"`: the integer column count the visible canvas fits (host-computed). */
  autoColumns?: number;
  /** Theme color mode the Canvas resolves theme variables in (the DOM's `data-theme` scope). */
  colorMode?: "light" | "dark";
}
/** The graph's page container declaration in the old placement derivation's input shape. */
function catalogPageLayoutSettings(
  layout: PageLayoutDeclaration | undefined,
): PageLayoutSettingsDocument | undefined {
  if (!layout) return undefined;
  const gap: Partial<Record<BreakpointName, number>> = {};
  const columns: Partial<Record<BreakpointName, number | "auto">> = {};
  for (const [name, tier] of Object.entries(layout.breakpoints ?? {})) {
    if (tier?.gap !== undefined) gap[name as BreakpointName] = tier.gap;
    if (tier?.columns !== undefined)
      columns[name as BreakpointName] = tier.columns;
  }
  return {
    ...(layout.direction ? { direction: layout.direction } : {}),
    ...(layout.gap !== undefined ? { gap: layout.gap } : {}),
    ...(layout.columns !== undefined ? { columns: layout.columns } : {}),
    responsive: { gap, columns },
    placementModel: "derived",
  };
}
/** A page placement (base + breakpoint layers) in the old per-key cascade shape. */
function catalogPagePlacement(
  placement: PagePlacementDeclaration,
): PagePlacement {
  const responsive: Record<
    string,
    Partial<Record<BreakpointName, string | number>>
  > = {};
  for (const [name, values] of Object.entries(placement.breakpoints ?? {}))
    for (const [key, value] of Object.entries(values ?? {}))
      (responsive[key] ??= {})[name as BreakpointName] = value;
  return { style: { ...placement.base }, responsive };
}
/** Font inputs of one text measure (the typography the Canvas paragraph and the DOM share). */
export interface CatalogTextFont {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  /** CSS font-family list; absent = the default family. */
  fontFamily?: string;
  fontStyle?: string;
  letterSpacing?: number;
  wordBreak?: string;
}

/** Rust intrinsic content box of a calendar header row (`calendarHeaderBox`). */
interface CatalogCalendarHeaderBox {
  contentMinWidth: number;
  contentMaxWidth: number;
  contentHeight: number;
}

/**
 * A text leaf: a childless node with a text source (`resolveTextSourceText`, the Preview/Skia
 * contract) and a font size. Its measured content box is the Rust intrinsic input.
 */
function textLeaf(
  node: CatalogConsumerNode,
  typeName: string,
  suffix = "",
  inheritedLineHeight?: number,
):
  | {
      text: string;
      font: CatalogTextFont;
      /** `white-space` keeps the text on one line (nowrap/pre). */
      singleLine: boolean;
    }
  | undefined {
  if (node.children.length > 0) return undefined;
  const own = resolveTextSourceText(
    typeName,
    node.props as Record<string, unknown>,
  );
  const typography = catalogTextTypography(node);
  const text = own
    ? applyTextTransform(own + suffix, typography.textTransform)
    : own;
  if (!text) return undefined;
  const fontSize = Number(node.visual.fontSize);
  const lineHeight = Number(node.visual.lineHeight ?? inheritedLineHeight ?? 0);
  const required = requiredTextBindings.has(node.bindingId ?? "");
  if (!(fontSize > 0) || (required && !(lineHeight > 0))) {
    if (required) throw new Error(`CATALOG_TEXT_METRIC_REQUIRED:${node.id}`);
    return undefined;
  }
  // RAC Breadcrumbs' current (last) crumb — its own text or its label Text child: catalog
  // `Breadcrumb.currentTextWeight` (the Canvas crumb primitive paints `_isLast` at the same weight;
  // DOM `Breadcrumbs.css` writes the value on the Link, which the label Text inherits).
  const current =
    (typeName === "Breadcrumb" || typeName === "Text") &&
    node.derivedProps?._isLast === true;
  return {
    text,
    font: {
      fontSize,
      fontWeight: current
        ? (catalogCurrentTextWeight("Breadcrumb") ?? 600)
        : Number(node.visual.fontWeight ?? 400),
      lineHeight: lineHeight > 0 ? lineHeight : 0,
      ...(typography.fontFamily !== undefined
        ? { fontFamily: typography.fontFamily }
        : {}),
      ...(typography.fontStyle !== undefined
        ? { fontStyle: typography.fontStyle }
        : {}),
      ...(typography.letterSpacing !== undefined
        ? { letterSpacing: typography.letterSpacing }
        : {}),
      ...(typography.wordBreak !== undefined
        ? { wordBreak: typography.wordBreak }
        : {}),
    },
    singleLine:
      typography.whiteSpace === "nowrap" || typography.whiteSpace === "pre",
  };
}

/**
 * CSS `line-height` inheritance: a node without its own line height uses the nearest ancestor's
 * (the unitless ratio, as the DOM inherits it — a Select value span reads its trigger button's).
 */
function inheritedLineHeight(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): number | undefined {
  if (Number(node.visual.lineHeight) > 0) return undefined;
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (Number(cursor.visual.lineHeight) > 0)
      return Number(cursor.visual.lineHeight);
  return undefined;
}

/**
 * Text leaves whose inherited line height is `node`'s: the descendants without their own line
 * height, down to (not past) the next declaring node. Re-planned when `node` changes.
 */
function lineHeightInheritors(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (id: string) => {
    const child = get(id);
    if (!child || Number(child.visual.lineHeight) > 0) return;
    if (child.children.length === 0) out.push(child);
    else for (const next of child.children) visit(next);
  };
  for (const id of node.children) visit(id);
  return out;
}

/**
 * The size a calendar's header row / day table follows: the owning Calendar's (RAC composes both
 * inside the element carrying `data-size`; the typed sub-part's own size is not read by the DOM).
 */
const calendarBindings = new Set(["calendargrid", "calendarheader"]);
function calendarPartSize(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): string | undefined {
  if (!calendarBindings.has(node.bindingId ?? "")) return undefined;
  const owner = get(node.parentId);
  const size = owner?.props.size ?? node.props.size;
  return typeof size === "string" ? size : undefined;
}

/** A DateInput's RAC segment row (`segmentText`). */
interface CatalogDateSegments {
  parts: readonly DateSegmentPart[];
  paddingX: number;
  /** DateRangePicker: start/end rows around the separator span, spaced by the trigger gap. */
  range?: { gap: number; separator: string };
  lineHeight?: number;
}

/** Rust `NodeStyle` input. It has no `padding`/`gap` shorthand (serde drops unknown keys). */
function styleOf(
  node: CatalogConsumerNode,
  measure: CatalogTextMeasure | undefined,
  typeName: string,
  wrappedHeight?: number,
  segmentText?: CatalogDateSegments,
  labelSuffix = "",
  inheritedLineHeight?: number,
  calendarSize?: string,
  calendarHeader?: CatalogCalendarHeaderBox,
): Record<string, unknown> {
  if (node.hidden) return { display: "none" };
  const box = catalogBoxModel(node);
  const px = (value: CatalogLength | undefined): string | undefined =>
    typeof value === "number" ? `${value}px` : value;
  // A calendar header's content box is its DOM composition (`calendarHeader`), not its own text.
  const leaf =
    measure && node.bindingId !== "calendarheader"
      ? textLeaf(node, typeName, labelSuffix, inheritedLineHeight)
      : undefined;
  // The calendar table's own box (7 day columns × the shown month's weeks).
  const table =
    node.bindingId === "calendargrid"
      ? catalogCalendarGridSize(calendarSize)
      : undefined;
  const headerRow =
    node.bindingId === "calendarheader" ? calendarHeader : undefined;
  // Date segments: the RAC segment row at the node's own font — each part is its own inline span
  // (editable parts padded), a range repeats the row around its separator with the trigger gap.
  const segments =
    measure && segmentText && Number(node.visual.fontSize) > 0
      ? (() => {
          const font = {
            fontSize: Number(node.visual.fontSize),
            fontWeight: Number(node.visual.fontWeight ?? 400),
            lineHeight: segmentText.lineHeight ?? 0,
          };
          let height = 0;
          const widthOf = (text: string) => {
            const size = measure(text, font);
            height = Math.max(height, size.height);
            return size.exactWidth ?? size.width;
          };
          const row = segmentText.parts.reduce(
            (sum, part) =>
              sum +
              widthOf(part.text) +
              (part.editable ? 2 * segmentText.paddingX : 0),
            0,
          );
          const width = segmentText.range
            ? 2 * row +
              2 * segmentText.range.gap +
              widthOf(segmentText.range.separator)
            : row;
          return {
            contentMinWidth: width,
            contentMaxWidth: width,
            contentHeight: height,
          };
        })()
      : undefined;
  // A glyph leaf's content box is its icon square (the DOM svg at `--icon-size`).
  const glyph =
    glyphBindings.has(node.bindingId ?? "") && node.children.length === 0
      ? catalogGlyphSize(node)
      : undefined;
  const contentText =
    measure && leaf
      ? (() => {
          const size = measure(leaf.text, leaf.font);
          if (heightOnlyTextTypes.has(typeName))
            return { contentHeight: wrappedHeight ?? size.height };
          // CSS max-content is the fractional advance (the DOM box is not rounded); a single-line
          // label is also its own min-content. The wrap decision (`rewrap`) compares against the
          // same exact width, so a box laid out at max-content never wraps on a sub-pixel.
          const width = size.exactWidth ?? size.width;
          if (noWrapTextBindings.has(node.bindingId ?? "") || leaf.singleLine)
            return {
              contentMinWidth: width,
              contentMaxWidth: width,
              contentHeight: wrappedHeight ?? size.height,
            };
          return {
            contentMinWidth: Math.min(size.minWidth ?? width, width),
            contentMaxWidth: width,
            contentHeight: wrappedHeight ?? size.height,
          };
        })()
      : undefined;
  const out: Record<string, unknown> = {
    display: box.display,
    ...(box.flexDirection ? { flexDirection: box.flexDirection } : {}),
    ...(box.alignItems ? { alignItems: box.alignItems } : {}),
    ...(box.justifyContent ? { justifyContent: box.justifyContent } : {}),
    ...(box.flexWrap ? { flexWrap: box.flexWrap } : {}),
    ...(box.position
      ? {
          position: "absolute",
          insetLeft: `${box.position.x}px`,
          insetTop: `${box.position.y}px`,
        }
      : {}),
    ...(box.width !== undefined ? { width: px(box.width) } : {}),
    ...(box.height !== undefined ? { height: px(box.height) } : {}),
    ...(box.minHeight !== undefined ? { minHeight: px(box.minHeight) } : {}),
    ...(box.minWidth !== undefined ? { minWidth: px(box.minWidth) } : {}),
    ...(box.gap !== undefined
      ? { rowGap: px(box.gap), columnGap: px(box.gap) }
      : {}),
    ...(box.padding
      ? {
          paddingTop: px(box.padding.top),
          paddingBottom: px(box.padding.bottom),
          paddingRight: px(box.padding.right),
          paddingLeft: px(box.padding.left),
        }
      : {}),
    ...(box.borderWidth !== undefined
      ? {
          borderTop: px(box.borderWidth),
          borderRight: px(box.borderWidth),
          borderBottom: px(box.borderWidth),
          borderLeft: px(box.borderWidth),
        }
      : {}),
    // Authored per-side widths refine the uniform width (the DOM longhands, `authoredStyle.ts`).
    ...Object.fromEntries(
      (
        [
          ["borderTopWidth", "borderTop"],
          ["borderRightWidth", "borderRight"],
          ["borderBottomWidth", "borderBottom"],
          ["borderLeftWidth", "borderLeft"],
        ] as const
      )
        .filter(([key]) => node.visual[key] !== undefined)
        .map(([key, side]) => [side, `${Number(node.visual[key])}px`]),
    ),
    ...(typeof node.visual.overflow === "string" &&
    node.visual.overflow !== "visible"
      ? { overflowX: node.visual.overflow, overflowY: node.visual.overflow }
      : {}),
    ...containerTracks(node, measure),
    ...itemLayout(node),
    ...(node.fillLayout ?? {}),
    ...(catalogAspectRatio(node.visual.aspectRatio) !== undefined
      ? { aspectRatio: catalogAspectRatio(node.visual.aspectRatio) }
      : {}),
    ...(contentText ?? {}),
    ...(glyph !== undefined
      ? { contentMinWidth: glyph, contentMaxWidth: glyph, contentHeight: glyph }
      : {}),
    ...(segments ?? {}),
    ...(headerRow ?? {}),
    // A table never lays out narrower than its columns (CSS table width ≥ min-content), and an
    // auto-width table is not stretched by its flex column (it keeps its columns' width).
    ...(table
      ? {
          contentMinWidth: table.width,
          contentMaxWidth: table.width,
          contentHeight: table.height,
          minWidth: `${table.width}px`,
          maxWidth: `${table.width}px`,
        }
      : {}),
  };
  // CSS `min-height: auto` of a flex item is min(content, specified height): a measured leaf with
  // a declared px height keeps that height in a column that overflows (the engine's column floor
  // takes the content-box value and adds padding/border).
  if (typeof out.contentHeight === "number" && typeof box.height === "number") {
    const edges =
      Number(box.padding?.top ?? 0) +
      Number(box.padding?.bottom ?? 0) +
      2 * Number(box.borderWidth ?? 0);
    out.contentMinHeight = Math.max(
      0,
      Math.min(out.contentHeight, box.height - edges),
    );
  }
  return out;
}

/** Grid track lists (Rust takes top-level tokens) and max box limits of the typed layout. */
function containerTracks(
  node: CatalogConsumerNode,
  measure: CatalogTextMeasure | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["gridTemplateColumns", "gridTemplateRows"] as const) {
    const value = node.layout[key];
    if (value !== undefined) out[key] = parseGridTemplate(value);
  }
  for (const key of ["maxWidth", "maxHeight"] as const) {
    const sized = node.sizing[key];
    const value =
      node.layout[key] ??
      (typeof sized === "number" ? `${sized}px` : undefined);
    if (value === undefined || value === "none") continue;
    // `ch` = the advance of "0" in the node's own font (CSS Values 4).
    const ch = /^(\d+(?:\.\d+)?)ch$/.exec(value);
    if (!ch) out[key] = value;
    else if (measure && Number(node.visual.fontSize) > 0)
      out[key] = `${
        Number(ch[1]) *
        (measure("0", {
          fontSize: Number(node.visual.fontSize),
          fontWeight: Number(node.visual.fontWeight ?? 400),
          lineHeight: 0,
        }).exactWidth ?? 0)
      }px`;
  }
  return out;
}

/** Typed item/placement layout fields (same names as Rust `NodeStyle`). */
const ITEM_LAYOUT_FIELDS = [
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
  "rowGap",
  "columnGap",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "verticalAlign",
  "insetLeft",
  "insetTop",
  "insetRight",
  "insetBottom",
] as const;
const NUMERIC_ITEM_FIELDS = new Set(["flexGrow", "flexShrink"]);
function itemLayout(node: CatalogConsumerNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ITEM_LAYOUT_FIELDS) {
    const value = node.layout[key];
    if (value === undefined) continue;
    out[key] = NUMERIC_ITEM_FIELDS.has(key) ? Number(value) : value;
  }
  // `position: relative` is the default flow box; authored absolute placement is
  // `node.placement`, a stylesheet-placed sub-part is `position: absolute` + insets.
  if (node.layout.position === "relative" && !node.placement)
    out.position = "relative";
  if (node.layout.position === "absolute" && !node.placement)
    out.position = "absolute";
  return out;
}
function sameFields(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.is(left[key], right[key]))
  );
}
function sameList(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}
function sameRecord(
  left: CatalogConsumerNode,
  right: CatalogConsumerNode,
): boolean {
  return (
    left.sourceId === right.sourceId &&
    sameList(left.collapsedIds ?? [], right.collapsedIds ?? []) &&
    left.definitionId === right.definitionId &&
    left.bindingId === right.bindingId &&
    left.definitionMode === right.definitionMode &&
    left.ruleId === right.ruleId &&
    left.parentId === right.parentId &&
    sameList(left.children, right.children) &&
    sameFields(left.props, right.props) &&
    sameFields(left.visual, right.visual) &&
    sameFields(left.layout, right.layout) &&
    sameFields(left.sizing, right.sizing) &&
    left.placement?.kind === right.placement?.kind &&
    left.placement?.x === right.placement?.x &&
    left.placement?.y === right.placement?.y &&
    sameFields(left.slot ?? {}, right.slot ?? {}) &&
    left.name === right.name &&
    left.placeholder === right.placeholder &&
    left.hidden === right.hidden &&
    sameFields(left.derivedProps ?? {}, right.derivedProps ?? {}) &&
    sameFields(left.inheritedText ?? {}, right.inheritedText ?? {}) &&
    sameFields(left.fillLayout ?? {}, right.fillLayout ?? {}) &&
    sameFields(left.authoredLayout ?? {}, right.authoredLayout ?? {}) &&
    left.htmlId === right.htmlId &&
    JSON.stringify(left.fills ?? null) ===
      JSON.stringify(right.fills ?? null) &&
    JSON.stringify(left.fillSizing ?? null) ===
      JSON.stringify(right.fillSizing ?? null) &&
    JSON.stringify(left.themeOverride ?? null) ===
      JSON.stringify(right.themeOverride ?? null) &&
    sameList(
      left.regions?.map((item) => `${item.name}:${item.required}`) ?? [],
      right.regions?.map((item) => `${item.name}:${item.required}`) ?? [],
    )
  );
}

/** Test-entry-only assembly. Consumer maps are inputs, not G3 visual parity results. */
export class CatalogCompositionRoot {
  private readonly layout: PersistentLayoutTree;
  /** Active breakpoint (desktop-first cascade); a switch builds a new root (cold path). */
  readonly breakpoint: BreakpointName;
  /** Product layout: each page a frame on the ADR-232 page container grid. */
  private readonly pageFrames: boolean;
  private autoColumns: number | undefined;
  /** Theme color mode (a switch builds a new root, like a breakpoint switch). */
  readonly colorMode: "light" | "dark";
  /** Page of each page root node (`pageRoots`). */
  private readonly rootPage = new Map<NodeId, EntryId<"page">>();
  private readonly records = new Map<string, CatalogConsumerNode>();
  private readonly rootMembers = new Map<NodeId, Set<string>>();
  private readonly sourceRoots = new Map<string, Set<NodeId>>();
  private readonly sourceInstances = new Map<string, Set<string>>();
  private readonly recordRoots = new Map<string, NodeId>();
  private readonly rootIds = new Set<NodeId>();
  private readonly slotChrome = new Map<string, SlotChromeInput>();
  /** Owner-composed layout leaves per record (`catalogComposedParts`), before its children. */
  private readonly composedParts = new Map<
    string,
    readonly CatalogComposedPart[]
  >();
  /** Wrapped text-leaf content heights from the last `rewrap` (absent = one line). */
  private readonly wrapHeights = new Map<string, number>();
  private readonly canvasListeners = new Map<
    string,
    Set<(node: CatalogConsumerNode | undefined) => void>
  >();
  private readonly domListeners = new Map<
    string,
    Set<(node: CatalogConsumerNode | undefined) => void>
  >();
  private currentMetrics: CatalogRootMetrics;
  /** Set while a plan is applied: undo steps for every map mutation, replayed if the apply fails. */
  private undoLog: (() => void)[] | undefined;
  private layoutTouched = false;

  constructor(
    readonly runtime: CatalogRuntime,
    engine: LayoutEngineAPI,
    readonly viewport: { width: number; height: number },
    readonly state?: StateName,
    private readonly slotChromeContext?: SlotChromeContext,
    private readonly textMeasure?: CatalogTextMeasure,
    /**
     * The rendering environment's locale: what RAC reads when a node sets none (the DOM
     * consumer's surrounding `I18nProvider`, else `navigator.language`).
     */
    private readonly locale?: string,
    options: CatalogRootOptions = {},
  ) {
    this.breakpoint = options.breakpoint ?? "desktop";
    this.pageFrames = options.pageFrames === true;
    this.autoColumns = options.autoColumns;
    this.colorMode = options.colorMode ?? "light";
    // Definite-zero heights shrink their column children (CSS-FLEXBOX-1 §9.8). The engine keeps
    // this off by default so the current Builder's output is unchanged until the Phase 4 cutover.
    engine.setDefiniteZeroHeight?.(true);
    this.layout = new PersistentLayoutTree(engine);
    this.currentMetrics = this.emptyMetrics(runtime.graph.revision);
    this.loadInitial();
  }

  get metrics(): CatalogRootMetrics {
    return this.currentMetrics;
  }
  get canvasInputs(): ReadonlyMap<string, CatalogConsumerNode> {
    return this.records;
  }
  get domInputs(): ReadonlyMap<string, CatalogConsumerNode> {
    return this.records;
  }
  get layoutInputs(): ReadonlyMap<string, CatalogConsumerNode> {
    return this.records;
  }
  /** Owner-composed parts per record id (layout leaves the Canvas paints; the DOM owner renders its own). */
  get composedPartInputs(): ReadonlyMap<
    string,
    readonly CatalogComposedPart[]
  > {
    return this.composedParts;
  }
  get slotChromeInputs(): ReadonlyMap<string, SlotChromeInput> {
    return this.slotChrome;
  }
  /** The Rust style input of one record (diagnostic; same function the layout tree receives). */
  getLayoutInput(id: string): Record<string, unknown> | undefined {
    const record = this.records.get(id);
    return record ? this.styleFor(record) : undefined;
  }
  /** Scoped, computed engine results for independent consumer verification. */
  /** Rects relative to each record's parent record (a wrapper part's offset folded in). */
  getGeometry(ids: Iterable<string>): ReadonlyMap<string, LayoutResult> {
    const list = [...ids];
    const rects = this.layout.getLayoutsForIds(list);
    let wrappers: Map<string, string> | undefined;
    for (const id of list) {
      const parentId = this.records.get(id)?.parentId;
      const part = parentId
        ? this.composedParts
            .get(parentId)
            ?.find((item) => item.wraps?.includes(id))
        : undefined;
      if (part) (wrappers ??= new Map()).set(id, part.id);
    }
    if (!wrappers) return rects;
    const out = new Map(rects);
    const partRects = this.layout.getLayoutsForIds(new Set(wrappers.values()));
    for (const [id, partId] of wrappers) {
      const rect = out.get(id);
      const part = partRects.get(partId);
      if (rect && part)
        out.set(id, { ...rect, x: rect.x + part.x, y: rect.y + part.y });
    }
    return out;
  }

  subscribeCanvas(
    id: string,
    callback: (node: CatalogConsumerNode | undefined) => void,
  ): () => void {
    return this.subscribe(this.canvasListeners, id, callback);
  }
  subscribeDom(
    id: string,
    callback: (node: CatalogConsumerNode | undefined) => void,
  ): () => void {
    return this.subscribe(this.domListeners, id, callback);
  }
  private subscribe(
    map: Map<string, Set<(node: CatalogConsumerNode | undefined) => void>>,
    id: string,
    callback: (node: CatalogConsumerNode | undefined) => void,
  ): () => void {
    let listeners = map.get(id);
    if (!listeners) {
      listeners = new Set();
      map.set(id, listeners);
    }
    listeners.add(callback);
    return () => {
      listeners!.delete(callback);
      if (!listeners!.size) map.delete(id);
    };
  }

  dispatch(
    label: string,
    ops: readonly CatalogOperation[],
  ): CatalogTransactionResult {
    return this.runtime.dispatch(
      label,
      ops,
      this.runtime.graph.revision,
      this.consume,
    );
  }
  undo(): CatalogTransactionResult | undefined {
    return this.runtime.undo(this.consume);
  }
  redo(): CatalogTransactionResult | undefined {
    return this.runtime.redo(this.consume);
  }

  /**
   * Takes a staged runtime step before it is published. Computing the new inputs runs before any
   * root state changes; applying them (maps and layout tree, no consumer code) is journaled. If
   * either throws — including the layout engine — the maps are restored from the journal, the
   * layout tree is rebuilt from the restored records, and the error aborts the step, so the
   * runtime reverts the graph and publishes nothing. On success, subscribers are notified only
   * after the runtime has published the step.
   */
  private readonly consume: CatalogStepConsumer = (step) => {
    if (step.result.revision !== this.currentMetrics.revision + 1)
      throw new Error("REVISION_GAP");
    const plan = this.plan(step);
    this.undoLog = [];
    this.layoutTouched = false;
    let notices: Notice[];
    try {
      notices = this.apply(plan);
    } catch (cause) {
      this.restore(cause);
      throw cause;
    } finally {
      this.undoLog = undefined;
    }
    return () => this.deliver(plan, notices);
  };
  /** Undo a partial apply: maps from the journal, then the layout tree from the restored maps. */
  private restore(cause: unknown): void {
    const log = this.undoLog!;
    this.undoLog = undefined;
    for (let index = log.length - 1; index >= 0; index--) log[index]();
    if (!this.layoutTouched) return;
    try {
      this.layout.reset();
      this.buildLayout();
    } catch (rebuild) {
      throw new AggregateError(
        [cause, rebuild],
        "CATALOG_LAYOUT_UNRECOVERABLE",
        { cause: rebuild },
      );
    }
  }
  /** Record `key`'s current value in `map` (Set values copied) before it is mutated. */
  private keep<K, V>(map: Map<K, V>, key: K): void {
    if (!this.undoLog) return;
    const had = map.has(key);
    const value = map.get(key);
    const saved = value instanceof Set ? (new Set(value) as V) : value;
    this.undoLog.push(() => {
      if (had) map.set(key, saved as V);
      else map.delete(key);
    });
  }
  private emptyMetrics(revision: number): CatalogRootMetrics {
    return {
      revision,
      changedIds: [],
      removedIds: [],
      affectedRootIds: [],
      layoutInputVisits: 0,
      resolverVisits: 0,
      resolverIncludeChecks: 0,
      affectedInstanceCount: 0,
      canvasInputUpdates: 0,
      domInputUpdates: 0,
      traversedWholeInputGraph: false,
    };
  }

  private pageRoots(): NodeId[] {
    const project = this.runtime.graph.getEntry(this.runtime.graph.projectId);
    if (project?.kind !== "project") throw new Error("PROJECT_ROOT_REQUIRED");
    const ids: NodeId[] = [];
    for (const pageId of project.pageIds) {
      const page = this.runtime.graph.getEntry(pageId);
      if (page?.kind !== "page") throw new Error("PAGE_REQUIRED");
      for (const childId of page.children) {
        const child = this.runtime.graph.getEntry(childId);
        // A disabled page node renders nowhere (canonical `enabled`).
        if (child?.kind === "node" && child.enabled === false) continue;
        ids.push(childId);
        this.rootPage.set(childId, page.id);
      }
    }
    return ids;
  }
  private flatten(rootId: NodeId): Map<string, CatalogConsumerNode> {
    const output = new Map<string, CatalogConsumerNode>();
    const visit = (node: ResolvedCatalogNode, parentId: string): string => {
      const id = identity(node);
      const layers = this.collapseLayers(node);
      const children = collapsedChildren(layers).map((child) =>
        visit(child, id),
      );
      output.set(id, this.consumerRecord(id, parentId, children, node, layers));
      return id;
    };
    visit(
      resolveCatalogNode(
        this.runtime.graph,
        rootId,
        this.state,
        undefined,
        this.breakpoint,
      ),
      "catalog:root",
    );
    const get = (key: string) => output.get(key);
    for (const [id, record] of output)
      if (catalogHiddenAtRest(record, get, this.typeOf))
        output.set(id, { ...record, hidden: true });
    for (const [id, record] of output) {
      const derivedProps = this.derivedOf(record, get);
      if (derivedProps) output.set(id, { ...record, derivedProps });
    }
    for (const [id, record] of output) {
      const inheritedText = inheritedTextOf(record, get);
      if (inheritedText) output.set(id, { ...record, inheritedText });
    }
    for (const [id, record] of output) {
      const fillLayout = catalogFillLayout(record, get, this.typeOf);
      if (fillLayout) output.set(id, { ...record, fillLayout });
    }
    return output;
  }
  /**
   * Owner-derived values of a record (`catalogDerivedProps`), and a Tab/Tag label Text's item
   * color (`catalogItemLabels` — DOM `color: inherit`): the item's rule paint for its variant,
   * state and selection (`catalogRuleTextColor`), unless the label authors its own color.
   */
  private derivedOf(
    record: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined,
  ): Readonly<Record<string, string | number | boolean>> | undefined {
    const derived = catalogDerivedProps(record, get, this.typeOf, this.locale);
    const item = get(record.parentId);
    if (
      !item?.ruleId ||
      !catalogItemLabels(item, get, this.typeOf).some(
        (label) => label.id === record.id,
      ) ||
      catalogAuthoredVisual(this, record).color !== undefined
    )
      return derived;
    const rule = this.runtime.graph.library.rules.get(item.ruleId);
    if (!rule) return derived;
    const itemDerived = catalogDerivedProps(
      item,
      get,
      this.typeOf,
      this.locale,
    );
    const color = catalogRuleTextColor({
      node: itemDerived
        ? { ...item, props: { ...item.props, ...itemDerived } }
        : item,
      rule,
      type: item.ruleId,
      authoredVisual: catalogAuthoredVisual(this, item),
      state: catalogNodeState(item.displayState, this.state),
    });
    return color === undefined ? derived : { ...derived, color };
  }
  /** Registered type name of a record (rule key, else definition name). */
  readonly typeOf = (node: CatalogConsumerNode): string =>
    node.ruleId ??
    this.runtime.graph.getDefinition(node.definitionId as DefinitionId)?.name ??
    "";
  private styleFor(
    record: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined = (id) =>
      this.records.get(id),
  ): Record<string, unknown> {
    const frame = this.pageFrameStyle(record);
    const style = styleOf(
      record,
      this.textMeasure,
      this.typeOf(record),
      this.wrapHeights.get(record.id),
      this.segmentText(record),
      catalogLabelSuffix(record, get, this.typeOf),
      inheritedLineHeight(record, get),
      calendarPartSize(record, get),
      this.calendarHeaderBox(record, get),
    );
    const thumb = record.hidden
      ? undefined
      : catalogSliderThumbLayout(record, get, this.typeOf);
    const separator = record.hidden
      ? undefined
      : this.crumbSeparator(record, get);
    const slotInset = record.hidden
      ? undefined
      : catalogItemSlotInset(record, get, this.typeOf);
    return {
      ...style,
      ...frame,
      ...thumb,
      ...(slotInset !== undefined ? { paddingLeft: `${slotInset}px` } : {}),
      ...(separator !== undefined
        ? {
            paddingRight: `${
              Number.parseFloat(String(style.paddingRight ?? "0")) + separator
            }px`,
          }
        : {}),
    };
  }
  /**
   * A calendar header row's content box: the DOM `<header>` flex row of two nav buttons and the
   * heading (`flex: 1`, the owner's visible-range title — the record's derived `children`). Its
   * width contribution is both buttons, the two gaps and the heading's min-content (a `0%` basis
   * item contributes no more); its height is the taller of the buttons and the heading wrapped in
   * the width left beside them (`rewrap`).
   */
  private calendarHeaderBox(
    record: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined,
  ): CatalogCalendarHeaderBox | undefined {
    const heading = this.calendarHeading(record, get);
    if (!heading) return undefined;
    const size =
      heading.text && this.textMeasure
        ? this.textMeasure(heading.text, heading.font)
        : undefined;
    const row =
      heading.beside +
      (size ? (size.minWidth ?? size.exactWidth ?? size.width) : 0);
    return {
      contentMinWidth: row,
      contentMaxWidth: row,
      contentHeight: Math.max(
        heading.navHeight,
        this.wrapHeights.get(record.id) ?? size?.height ?? 0,
      ),
    };
  }
  /** A calendar header's heading: its text and font, and the width its nav buttons take beside it. */
  private calendarHeading(
    record: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined = (id) =>
      this.records.get(id),
  ):
    | {
        text: string;
        font: { fontSize: number; fontWeight: number; lineHeight: number };
        beside: number;
        navHeight: number;
      }
    | undefined {
    if (record.bindingId !== "calendarheader" || record.hidden)
      return undefined;
    const parts = catalogCalendarHeaderParts(calendarPartSize(record, get));
    if (!parts) return undefined;
    const title = record.derivedProps?.children;
    const gap = catalogBoxModel(record).gap;
    return {
      text: typeof title === "string" ? title : "",
      font: parts.heading,
      beside: 2 * parts.navWidth + 2 * (typeof gap === "number" ? gap : 0),
      navHeight: parts.navHeight,
    };
  }
  /**
   * Width of the default separator Icon after a non-last crumb without children (gap + icon — the
   * catalog `Breadcrumb.sizes[size]`); a crumb with children lays out its own separator Icon child.
   */
  private crumbSeparator(
    record: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined,
  ): number | undefined {
    if (record.children.length > 0) return undefined;
    const crumb = catalogBreadcrumbSeparator(record, get, this.typeOf);
    if (!crumb) return undefined;
    const separator = catalogBreadcrumbSeparatorIcon(
      crumb.orphan ? "M" : String(crumb.owner.props.size ?? "M"),
    );
    return separator.gap + separator.iconSize;
  }
  /** Text the DOM appends to this Label (field necessity indicator), for the Canvas paint. */
  labelSuffix(id: string): string {
    const record = this.records.get(id);
    return record
      ? catalogLabelSuffix(record, (key) => this.records.get(key), this.typeOf)
      : "";
  }
  /** Whether the layout wrapped this text leaf onto more than one line (last `rewrap`). */
  textWraps(id: string): boolean {
    return this.wrapHeights.has(id);
  }
  /**
   * A DateInput's DOM content is its RAC date segments (`racDateSegmentParts` in the rendering
   * locale, padded by the owning field's `.react-aria-DateSegment` delegation, past the
   * SelectTrigger wrapper): the typed node has no text of its own. A DateRangePicker's one typed
   * DateInput is the product's start/end pair around its `–` span, spaced by the trigger gap.
   */
  private segmentText(
    record: CatalogConsumerNode,
  ): CatalogDateSegments | undefined {
    if (record.bindingId !== "dateinput") return undefined;
    const wrapper = this.records.get(record.parentId);
    let owner = wrapper;
    while (owner && this.typeOf(owner) === "SelectTrigger")
      owner = this.records.get(owner.parentId);
    const ownerType = owner ? this.typeOf(owner) : undefined;
    // RAC-owned segments inherit the line height of their nearest declaring ancestor (CSS
    // inheritance of the unitless ratio).
    let lineHeight: number | undefined;
    for (
      let cursor: CatalogConsumerNode | undefined = record;
      cursor && lineHeight === undefined;
      cursor = this.records.get(cursor.parentId)
    )
      if (Number(cursor.visual.lineHeight) > 0)
        lineHeight = Number(cursor.visual.lineHeight);
    const prop = (key: string) => record.props[key] ?? owner?.props[key];
    const granularity = prop("granularity");
    const hourCycle = prop("hourCycle");
    const parts = racDateSegmentParts({
      locale:
        typeof prop("locale") === "string"
          ? String(prop("locale"))
          : this.locale,
      granularity:
        typeof granularity === "string"
          ? granularity
          : ownerType === "TimeField"
            ? "minute"
            : undefined,
      hourCycle: typeof hourCycle === "number" ? hourCycle : undefined,
    });
    // A TimeField shows the time fields only (RAC `TimeField` omits the date).
    const firstTime = parts.findIndex((part) => part.text === "\u2013\u2013");
    const shown =
      ownerType === "TimeField" && firstTime >= 0
        ? parts.slice(firstTime)
        : parts;
    return {
      parts: shown,
      paddingX: ownerType ? catalogDateSegmentPaddingX(ownerType) : 0,
      ...(ownerType === "DateRangePicker"
        ? {
            range: {
              gap: Number(wrapper?.visual.gap ?? 0),
              separator: "\u2013",
            },
          }
        : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
    };
  }
  /**
   * Re-wrap text leaves whose computed content width is narrower than their max-content: the
   * wrapped height becomes their `contentHeight` and layout is recomputed once (Rust has no
   * measure callback). `candidates` bounds the check to the edited subtrees.
   */
  private rewrap(candidates: Iterable<string>): void {
    if (!this.textMeasure) return;
    let changed = false;
    for (const id of candidates) {
      const record = this.records.get(id);
      if (!record || record.hidden) continue;
      // A calendar header wraps its heading in the width its nav buttons leave.
      const heading = this.calendarHeading(record);
      const leaf =
        heading ??
        textLeaf(
          record,
          this.typeOf(record),
          catalogLabelSuffix(
            record,
            (key) => this.records.get(key),
            this.typeOf,
          ),
          inheritedLineHeight(record, (key) => this.records.get(key)),
        );
      if (
        !leaf?.text ||
        (!heading &&
          (noWrapTextBindings.has(record.bindingId ?? "") ||
            ("singleLine" in leaf && leaf.singleLine) ||
            heightOnlyTextTypes.has(this.typeOf(record))))
      )
        continue;
      const rect = this.layout.getLayoutsForIds([id]).get(id);
      if (!rect) continue;
      const box = catalogBoxModel(record);
      const num = (value: CatalogLength | undefined) =>
        typeof value === "number" ? value : 0;
      const contentWidth =
        rect.width -
        num(box.padding?.left) -
        num(box.padding?.right) -
        2 * num(box.borderWidth) -
        (heading?.beside ?? 0);
      const single = this.textMeasure(leaf.text, leaf.font);
      // CSS breaks lines only between words (`overflow-wrap: normal`): a word wider than the box
      // overflows on its own line instead of splitting. Lines are broken at no less than the
      // min-content width (the longest word), so a lone overflowing word stays one line.
      const breakWidth = Math.max(contentWidth, single.minWidth ?? 0);
      const next =
        (heading ? rect.width > 0 : contentWidth > 0) &&
        breakWidth + 0.5 < (single.exactWidth ?? single.width)
          ? this.textMeasure(leaf.text, leaf.font, breakWidth).height
          : undefined;
      if (next === this.wrapHeights.get(id)) continue;
      this.keep(this.wrapHeights, id);
      if (next === undefined) this.wrapHeights.delete(id);
      else this.wrapHeights.set(id, next);
      this.layout.updateNodeStyle(id, this.styleFor(record));
      changed = true;
    }
    if (changed)
      this.layout.computeLayout(this.viewport.width, this.viewport.height);
  }
  /** Records in the subtrees of the given records' parents (siblings can change their width). */
  private rewrapScope(ids: Iterable<string>): Set<string> {
    const scope = new Set<string>();
    const visit = (id: string) => {
      if (scope.has(id)) return;
      scope.add(id);
      for (const child of this.records.get(id)?.children ?? []) visit(child);
    };
    for (const id of ids) {
      const parentId = this.records.get(id)?.parentId;
      visit(parentId && this.records.has(parentId) ? parentId : id);
    }
    return scope;
  }
  /**
   * `node` and the template roots it collapses into (a composite instance is its root). The
   * resolver puts a composite's template projection first; a replaced root counts as the root.
   */
  private collapseLayers(node: ResolvedCatalogNode): ResolvedCatalogNode[] {
    const layers = [node];
    for (;;) {
      const current = layers[layers.length - 1];
      const definition = this.runtime.graph.getDefinition(
        current.definitionId as DefinitionId,
      );
      const first = current.children[0];
      if (definition?.mode !== "composite" || !first) return layers;
      const entry = this.runtime.graph.getEntry(current.sourceId);
      const isRoot =
        first.sourceId === definition.templateRootId ||
        (entry?.kind === "node" &&
          entry.descendantOverrides.some(
            (override) =>
              override.kind === "replace" &&
              override.replacementId === first.sourceId &&
              override.address.templatePath.length === 1,
          ));
      if (!isRoot) return layers;
      layers.push(first);
    }
  }
  private consumerRecord(
    id: string,
    parentId: string,
    children: readonly string[],
    top: ResolvedCatalogNode,
    layers: readonly ResolvedCatalogNode[],
  ): CatalogConsumerNode {
    const target = layers[layers.length - 1];
    const definition = this.runtime.graph.getDefinition(
      target.definitionId as DefinitionId,
    );
    return {
      id,
      sourceId: top.sourceId,
      definitionId: target.definitionId,
      bindingId: definition?.bindingId,
      definitionMode: definition?.mode,
      ...(definition && "ruleId" in definition && definition.ruleId
        ? { ruleId: definition.ruleId }
        : {}),
      parentId,
      children,
      props: target.props,
      visual: target.visual,
      layout: target.layout,
      sizing: target.sizing,
      placement: top.placement ?? target.placement,
      ...authoredFields(target),
      slot: top.slot ?? target.slot,
      name: top.name ?? target.name,
      regions: top.regions ?? target.regions,
      placeholder: top.placeholder ?? target.placeholder,
      ...(target.displayState ? { displayState: target.displayState } : {}),
      instancePath: top.instancePath,
      ...(layers.length > 1
        ? {
            collapsedIds: layers.slice(1).map(identity),
            collapsedSourceIds: layers.slice(1).map((layer) => layer.sourceId),
          }
        : {}),
    };
  }
  private loadInitial(): void {
    for (const rootId of this.pageRoots()) {
      this.rootIds.add(rootId);
      const flattened = this.flatten(rootId);
      this.rootMembers.set(rootId, new Set(flattened.keys()));
      for (const [id, record] of flattened) {
        this.records.set(id, record);
        this.recordRoots.set(id, rootId);
        for (const sourceId of recordSources(record)) {
          this.addSourceInstance(sourceId, id);
          let roots = this.sourceRoots.get(sourceId);
          if (!roots) {
            roots = new Set();
            this.sourceRoots.set(sourceId, roots);
          }
          roots.add(rootId);
        }
        const chrome = deriveSlotChromeInput(record, this.slotChromeContext);
        if (chrome) this.slotChrome.set(id, chrome);
      }
    }
    const get = (key: string) => this.records.get(key);
    for (const [id, record] of this.records) {
      const parts = catalogComposedParts(record, get, this.typeOf);
      if (parts.length) this.composedParts.set(id, parts);
    }
    this.buildLayout();
  }
  /** Build the whole layout tree from the current records (post-order, roots in page order). */
  private buildLayout(): void {
    const batch: PersistentBatchNode[] = [];
    const childIds = new Map<string, string[]>();
    const indexes = new Map<string, number>();
    const visit = (id: string): void => {
      const record = this.records.get(id)!;
      for (const child of record.children) visit(child);
      const chrome = this.slotChrome.get(id);
      if (chrome)
        for (const entry of slotChromeLayoutNodes(chrome)) {
          indexes.set(entry.id, batch.length);
          batch.push({
            elementId: entry.id,
            style: entry.style,
            children: entry.children.map((child) => indexes.get(child)!),
          });
          childIds.set(entry.id, [...entry.children]);
        }
      const parts = this.composedParts.get(id) ?? [];
      for (const part of parts) {
        const wraps = part.wraps ?? [];
        indexes.set(part.id, batch.length);
        batch.push({
          elementId: part.id,
          style: { ...part.style },
          children: wraps.map((child) => indexes.get(child)!),
        });
        childIds.set(part.id, [...wraps]);
      }
      const layoutChildren = layoutChildrenOf(
        record.children,
        parts,
        chrome?.id,
      );
      indexes.set(id, batch.length);
      batch.push({
        elementId: id,
        style: this.styleFor(record),
        children: layoutChildren.map((child) => indexes.get(child)!),
      });
      childIds.set(id, [...layoutChildren]);
    };
    const rootChildren = [...this.rootIds].map((rootId) =>
      [...this.rootMembers.get(rootId)!].find(
        (id) => this.records.get(id)!.parentId === "catalog:root",
      )!,
    );
    for (const id of rootChildren) visit(id);
    batch.push({
      elementId: "catalog:root",
      style: this.rootStyle(),
      children: rootChildren.map((id) => indexes.get(id)!),
    });
    childIds.set("catalog:root", rootChildren);
    this.layout.buildFull("catalog:root", batch, childIds);
    this.layout.computeLayout(this.viewport.width, this.viewport.height);
    this.rewrap(this.records.keys());
  }

  /**
   * The container of the page roots. Test assemblies: one viewport-size flex box. Product
   * (`pageFrames`): the ADR-232 page container grid (`buildContainerStyle` — the old app's
   * placement derivation, now in the same layout tree as the pages).
   */
  private rootStyle(): Record<string, unknown> {
    if (!this.pageFrames)
      return {
        display: "flex",
        width: `${this.viewport.width}px`,
        height: `${this.viewport.height}px`,
      };
    const project = this.runtime.graph.getEntry(this.runtime.graph.projectId);
    const layout = project?.kind === "project" ? project.pageLayout : undefined;
    return buildContainerStyle(
      resolvePageLayout(
        catalogPageLayoutSettings(layout),
        this.breakpoint,
        this.autoColumns,
      ),
    );
  }
  /**
   * A page root's frame on the page grid: the breakpoint's page size unless the root authored its
   * own width/height (`resolvePageFrameSize`), plus the page's placement at this breakpoint.
   */
  private pageFrameStyle(
    record: CatalogConsumerNode,
  ): Record<string, unknown> | undefined {
    if (!this.pageFrames || record.parentId !== "catalog:root")
      return undefined;
    const pageId = this.rootPage.get(record.sourceId as NodeId);
    const page = pageId ? this.runtime.graph.getEntry(pageId) : undefined;
    const tier = CANVAS_VIEWPORT[this.breakpoint];
    const out: Record<string, unknown> = {};
    if (record.sizing.width == null && record.visual.width == null)
      out.width = `${tier.width}px`;
    if (record.sizing.height == null && record.visual.height == null)
      out.height = `${tier.height}px`;
    if (page?.kind !== "page" || !page.placement) return out;
    const placement = resolvePagePlacementStyle(
      catalogPagePlacement(page.placement),
      this.breakpoint,
    );
    for (const [key, value] of Object.entries(placement)) {
      if (key === "left")
        out.insetLeft = typeof value === "number" ? `${value}px` : value;
      else if (key === "top")
        out.insetTop = typeof value === "number" ? `${value}px` : value;
      else
        out[key] =
          typeof value === "number" && key.startsWith("grid")
            ? String(value)
            : value;
    }
    return out;
  }
  /**
   * `columns: "auto"` follows the visible canvas: the host passes the new integer column count.
   * Only the page container's tracks change; the page frames move and their contents keep their
   * layout. Returns whether any page frame moved (the Canvas host rebinds the page shells).
   */
  setAutoColumns(columns: number): boolean {
    if (!this.pageFrames || columns === this.autoColumns) return false;
    const before = this.pageFrameRects();
    this.autoColumns = columns;
    this.layout.updateNodeStyle("catalog:root", this.rootStyle());
    this.layout.computeLayout(this.viewport.width, this.viewport.height);
    const after = this.pageFrameRects();
    for (const [pageId, rect] of after) {
      const old = before.get(pageId);
      if (!old || old.x !== rect.x || old.y !== rect.y) return true;
    }
    return false;
  }
  /** Laid-out frame of every page (its root node's box on the page grid). */
  pageFrameRects(): Map<
    string,
    { x: number; y: number; width: number; height: number }
  > {
    const rects = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    for (const rootId of this.rootIds) {
      const pageId = this.rootPage.get(rootId);
      const member = [...(this.rootMembers.get(rootId) ?? [])].find(
        (id) => this.records.get(id)?.parentId === "catalog:root",
      );
      const rect = member ? this.getGeometry([member]).get(member) : undefined;
      if (pageId && rect) rects.set(pageId, rect);
    }
    return rects;
  }

  private addSourceInstance(sourceId: string, id: string): void {
    this.keep(this.sourceInstances, sourceId);
    let instances = this.sourceInstances.get(sourceId);
    if (!instances) {
      instances = new Set();
      this.sourceInstances.set(sourceId, instances);
    }
    instances.add(id);
  }

  private removeSourceInstance(sourceId: string, id: string): void {
    this.keep(this.sourceInstances, sourceId);
    const instances = this.sourceInstances.get(sourceId);
    instances?.delete(id);
    if (instances?.size === 0) this.sourceInstances.delete(sourceId);
  }

  /** Consumer computations for one record (style, measured text, Slot chrome). May throw. */
  private planRecord(
    id: string,
    record: CatalogConsumerNode,
    rootId: NodeId,
    get?: (id: string) => CatalogConsumerNode | undefined,
  ): RecordPlan {
    const old = this.records.get(id);
    const style = this.styleFor(record, get);
    return {
      id,
      record,
      rootId,
      style,
      styleChanged: !old || !sameFields(this.styleFor(old), style),
      chrome: deriveSlotChromeInput(record, this.slotChromeContext),
      parts: catalogComposedParts(
        record,
        get ?? ((key) => this.records.get(key)),
        this.typeOf,
      ),
    };
  }

  /** State mutation only (maps and layout tree); notifications are queued, not delivered. */
  private applyRecord(plan: RecordPlan, notices: Notice[]): void {
    const { id, record, rootId, chrome, parts } = plan;
    const old = this.records.get(id);
    const oldChrome = this.slotChrome.get(id);
    const oldParts = this.composedParts.get(id) ?? [];
    this.keep(this.records, id);
    this.keep(this.recordRoots, id);
    this.keep(this.slotChrome, id);
    this.keep(this.composedParts, id);
    this.layoutTouched = true;
    this.records.set(id, record);
    this.recordRoots.set(id, rootId);
    // Sources a record reads can change with it (a replaced template root joins its instance).
    const oldSources = old ? recordSources(old) : [];
    const nextSources = recordSources(record);
    for (const sourceId of oldSources)
      if (!nextSources.includes(sourceId)) {
        this.keep(this.sourceRoots, sourceId);
        const roots = this.sourceRoots.get(sourceId);
        roots?.delete(rootId);
        if (roots?.size === 0) this.sourceRoots.delete(sourceId);
        this.removeSourceInstance(sourceId, id);
      }
    for (const sourceId of nextSources)
      if (!oldSources.includes(sourceId)) {
        this.addSourceInstance(sourceId, id);
        this.keep(this.sourceRoots, sourceId);
        let roots = this.sourceRoots.get(sourceId);
        if (!roots) {
          roots = new Set();
          this.sourceRoots.set(sourceId, roots);
        }
        roots.add(rootId);
      }
    if (!old) this.layout.addNode(id, plan.style);
    else if (plan.styleChanged) this.layout.updateNodeStyle(id, plan.style);
    if (chrome) {
      this.slotChrome.set(id, chrome);
      const entries = slotChromeLayoutNodes(chrome);
      for (const entry of entries)
        if (oldChrome) this.layout.updateNodeStyle(entry.id, entry.style);
        else this.layout.addNode(entry.id, entry.style);
      for (const entry of entries)
        this.layout.updateChildren(entry.id, [...entry.children]);
    } else if (oldChrome) this.slotChrome.delete(id);
    for (const part of parts) {
      const before = oldParts.find((item) => item.id === part.id);
      if (!before) this.layout.addNode(part.id, { ...part.style });
      else if (!sameFields(before.style, part.style))
        this.layout.updateNodeStyle(part.id, { ...part.style });
    }
    if (parts.length) this.composedParts.set(id, parts);
    else this.composedParts.delete(id);
    const beforeChildren = layoutChildrenOf(
      old?.children ?? [],
      oldParts,
      oldChrome?.id,
    );
    const nextChildren = layoutChildrenOf(record.children, parts, chrome?.id);
    // A child moving out of a wrapper leaves it before joining the record (one parent at a time).
    for (const part of parts) {
      const before = oldParts.find((item) => item.id === part.id);
      if (!before || !sameList(before.wraps ?? [], part.wraps ?? []))
        this.layout.updateChildren(part.id, []);
    }
    if (!old || !sameList(beforeChildren, nextChildren))
      this.layout.updateChildren(id, [...nextChildren]);
    for (const part of parts) {
      const before = oldParts.find((item) => item.id === part.id);
      if (!before || !sameList(before.wraps ?? [], part.wraps ?? []))
        this.layout.updateChildren(part.id, [...(part.wraps ?? [])]);
    }
    for (const part of oldParts)
      if (!parts.some((item) => item.id === part.id)) {
        this.layout.updateChildren(part.id, []);
        this.layout.removeNode(part.id);
      }
    if (oldChrome && !chrome)
      for (const entry of [...slotChromeLayoutNodes(oldChrome)].reverse()) {
        this.layout.updateChildren(entry.id, []);
        this.layout.removeNode(entry.id);
      }
    if (!old || !sameRecord(old, record)) notices.push({ id, record });
  }

  private applyRemoval(id: string, rootId: NodeId, notices: Notice[]): void {
    const old = this.records.get(id);
    this.keep(this.records, id);
    this.keep(this.recordRoots, id);
    this.keep(this.slotChrome, id);
    this.keep(this.composedParts, id);
    this.layoutTouched = true;
    if (old) {
      for (const sourceId of recordSources(old)) {
        this.keep(this.sourceRoots, sourceId);
        const roots = this.sourceRoots.get(sourceId);
        roots?.delete(rootId);
        if (roots?.size === 0) this.sourceRoots.delete(sourceId);
        this.removeSourceInstance(sourceId, id);
      }
    }
    this.records.delete(id);
    const parts = this.composedParts.get(id) ?? [];
    if (parts.length) {
      this.composedParts.delete(id);
      this.layout.updateChildren(id, []);
      for (const part of parts) {
        this.layout.updateChildren(part.id, []);
        this.layout.removeNode(part.id);
      }
    }
    const chrome = this.slotChrome.get(id);
    if (chrome) {
      this.slotChrome.delete(id);
      this.layout.updateChildren(id, []);
      for (const entry of [...slotChromeLayoutNodes(chrome)].reverse()) {
        this.layout.updateChildren(entry.id, []);
        this.layout.removeNode(entry.id);
      }
    }
    this.recordRoots.delete(id);
    this.layout.removeNode(id);
    notices.push({ id });
  }

  /**
   * How the pruned re-resolution reaches `child` from `parent`. The resolver's owned-children
   * loop gives an owned child the path `[...parentPath, childId]`; a replacement of the parent's
   * template root gets the same shape, so a child named in the parent's `descendantOverrides`
   * keeps the full owned-children scan (`"scan"`). Any other shape is not an owned-children hop.
   */
  private ownedHop(
    parent: CatalogConsumerNode,
    child: CatalogConsumerNode,
  ): NodeId | "scan" | undefined {
    const path = parent.instancePath;
    const childPath = child.instancePath;
    if (
      childPath.length !== path.length + 1 ||
      childPath[path.length] !== child.sourceId ||
      !path.every((id, index) => childPath[index] === id)
    )
      return undefined;
    const entry = this.runtime.graph.getEntry(parent.sourceId);
    if (entry?.kind !== "node") return "scan";
    return entry.descendantOverrides.some(
      (override) =>
        (override.kind === "replace" &&
          override.replacementId === child.sourceId) ||
        (override.kind === "fillSlot" &&
          override.childIds.includes(child.sourceId as NodeId)),
    )
      ? "scan"
      : (child.sourceId as NodeId);
  }

  /**
   * Direct child instances whose resolved values can change because the parent's props changed:
   * a partRule of the parent definition targets the child's definition and child props, and its
   * `when` reads a parent prop whose value changed.
   */
  private partRuleChildren(
    before: CatalogConsumerNode,
    after: CatalogConsumerNode,
  ): string[] {
    const definition = this.runtime.graph.getDefinition(
      after.definitionId as DefinitionId,
    );
    const rules =
      definition && "partRules" in definition
        ? (definition.partRules ?? [])
        : [];
    if (!rules.length) return [];
    const changed = new Set(
      [...Object.keys(before.props), ...Object.keys(after.props)].filter(
        (key) => !Object.is(before.props[key], after.props[key]),
      ),
    );
    const live = rules.filter(
      (rule) =>
        (rule.state === undefined || rule.state === this.state) &&
        Object.keys(rule.when ?? {}).some((key) => changed.has(key)),
    );
    if (!live.length) return [];
    const targets = (
      ids: readonly string[],
      via: string | undefined,
    ): string[] =>
      ids.filter((childId) => {
        const child = this.records.get(childId);
        return (
          !!child &&
          live.some(
            (rule) =>
              rule.child.via === via &&
              rule.child.definitionId === child.definitionId &&
              Object.entries(rule.child.props ?? {}).every(
                ([key, value]) => child.props[key] === value,
              ),
          )
        );
      });
    // Direct children, and the children of a `via` wrapper child (descendant rules).
    const wrapped = after.children.flatMap((childId) => {
      const child = this.records.get(childId);
      return child && live.some((rule) => rule.child.via === child.definitionId)
        ? targets(child.children, child.definitionId)
        : [];
    });
    return [...targets(after.children, undefined), ...wrapped];
  }

  private planInstances(sourceIds: ReadonlySet<string>): {
    resolverVisits: number;
    includeChecks: number;
    updates: RecordPlan[];
    roots: Set<NodeId>;
  } {
    let resolverVisits = 0;
    let includeChecks = 0;
    const updates: RecordPlan[] = [];
    const roots = new Set<NodeId>();
    const queue: string[] = [];
    for (const sourceId of sourceIds)
      queue.push(...(this.sourceInstances.get(sourceId) ?? []));
    const queued = new Set(queue);
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      const before = this.records.get(id)!;
      const rootId = this.recordRoots.get(id)!;
      const allowed = new Set<string>();
      // Owned node on the path → its one owned child on the path. A parent absent from both
      // maps has no owned child on the path (it is the target, or the path continues through
      // its template root), so no owned child can pass `include`.
      const ownedNext = new Map<string, NodeId>();
      const scanAll = new Set<string>();
      const chain: CatalogConsumerNode[] = [];
      let cursor: CatalogConsumerNode | undefined = before;
      while (cursor) {
        allowed.add(cursor.id);
        // A collapsed record is reached through its composite layers' template roots.
        for (const layerId of cursor.collapsedIds ?? []) allowed.add(layerId);
        chain.push(cursor);
        const parent = this.records.get(cursor.parentId);
        if (parent) {
          const hop = this.ownedHop(parent, cursor);
          if (hop === "scan") scanAll.add(parent.id);
          else if (hop) ownedNext.set(parent.id, hop);
        }
        cursor = parent;
      }
      // A replacement on the path is reached through the template position it replaces: the
      // resolver tests `include` with that template id, so its identity joins the path.
      const chainSources = new Set(chain.flatMap(recordSources));
      for (const record of chain) {
        const entry = this.runtime.graph.getEntry(record.sourceId);
        if (entry?.kind !== "node") continue;
        for (const override of entry.descendantOverrides)
          if (
            override.kind === "replace" &&
            chainSources.has(override.replacementId)
          )
            // The address starts at the owner; the resolution path also carries its ancestors.
            allowed.add(
              `${[...record.instancePath, ...override.address.instances.slice(1)].join("/")}::${override.address.templatePath.at(-1)}`,
            );
      }
      const pruned = resolveCatalogNode(
        this.runtime.graph,
        rootId,
        this.state,
        {
          include: (candidate, instancePath) => {
            includeChecks++;
            return allowed.has(`${instancePath.join("/")}::${candidate}`);
          },
          ownedChildren: (sourceId, instancePath) => {
            const key = `${instancePath.join("/")}::${sourceId}`;
            if (scanAll.has(key)) return undefined;
            const next = ownedNext.get(key);
            return next ? [next] : [];
          },
          onVisit: () => resolverVisits++,
        },
        this.breakpoint,
      );
      const find = (
        node: ResolvedCatalogNode,
        target: string,
      ): ResolvedCatalogNode | undefined => {
        if (identity(node) === target) return node;
        for (const child of node.children) {
          const found = find(child, target);
          if (found) return found;
        }
        return undefined;
      };
      const top = find(pruned, id);
      if (!top) throw new Error(`RESOLVED_INSTANCE_MISSING:${id}`);
      const valueId = before.collapsedIds?.at(-1);
      const resolved = valueId ? find(top, valueId) : top;
      if (!resolved) throw new Error(`RESOLVED_INSTANCE_MISSING:${valueId}`);
      // The authored optional fields follow the new resolution (an undo can drop them).
      const {
        fills: _fills,
        fillSizing: _fillSizing,
        themeOverride: _themeOverride,
        authoredLayout: _authoredLayout,
        htmlId: _htmlId,
        ...kept
      } = before;
      const record: CatalogConsumerNode = {
        ...kept,
        props: resolved.props,
        visual: resolved.visual,
        layout: resolved.layout,
        sizing: resolved.sizing,
        placement: top.placement ?? resolved.placement,
        ...authoredFields(resolved),
        slot: top.slot ?? resolved.slot,
        name: top.name ?? resolved.name,
        regions: top.regions ?? resolved.regions,
        placeholder: top.placeholder ?? resolved.placeholder,
      };
      // A parent prop change reaches the direct children its partRules target.
      for (const childId of this.partRuleChildren(before, record))
        if (!queued.has(childId)) {
          queued.add(childId);
          queue.push(childId);
        }
      updates.push(this.planRecord(id, record, rootId));
      roots.add(rootId);
    }
    // Presence follows scope values (Tabs selection, Tree expansion): re-derive the dependents
    // of every scope an update touches.
    const planned = new Map(updates.map((update) => [update.id, update]));
    const get = (key: string) =>
      planned.get(key)?.record ?? this.records.get(key);
    const owners = new Set<string>();
    for (const update of updates) {
      const owner = catalogPresenceScope(update.record, get, this.typeOf);
      if (owner) owners.add(owner.id);
    }
    for (const ownerId of owners)
      for (const panel of catalogPresenceDependents(
        get(ownerId)!,
        get,
        this.typeOf,
      )) {
        const hidden = catalogHiddenAtRest(panel, get, this.typeOf);
        if (hidden === (panel.hidden === true)) continue;
        const { hidden: _hidden, ...shown } = panel;
        const rootId = this.recordRoots.get(panel.id)!;
        const next = this.planRecord(
          panel.id,
          hidden ? { ...shown, hidden: true } : shown,
          rootId,
        );
        const index = updates.findIndex((update) => update.id === panel.id);
        if (index >= 0) updates[index] = next;
        else updates.push(next);
        roots.add(rootId);
      }
    // Slider thumbs follow the Slider's value, field Labels the necessity inputs (their layout
    // reads them): re-plan them against the planned records.
    for (const update of [...updates])
      for (const thumb of [
        ...catalogSliderThumbs(update.record, get, this.typeOf),
        ...catalogLabelSuffixDependents(update.record, get, this.typeOf),
        ...catalogBreadcrumbItems(update.record, get, this.typeOf),
        // An icon slot child's presence decides its ListBox item's inset.
        ...(update.record.props.slot === "icon" && get(update.record.parentId)
          ? [get(update.record.parentId)!]
          : []),
        ...catalogDerivedPropsDependents(update.record, get, this.typeOf),
        ...(update.record.children.length > 0 &&
        this.records.get(update.id)?.visual.lineHeight !==
          update.record.visual.lineHeight
          ? lineHeightInheritors(update.record, get)
          : []),
        ...(update.record.children.length > 0 &&
        textKeysChanged(this.records.get(update.id), update.record)
          ? textInheritors(update.record, get)
          : []),
        // A fill child projects against this box (and its grandchildren against their parent).
        ...(update.record.children.length > 0 &&
        boxInputsChanged(this.records.get(update.id), update.record)
          ? catalogFillDependents(update.record, get)
          : []),
        ...(update.record.fillSizing || update.record.fillLayout
          ? [update.record]
          : []),
        ...(this.records.get(update.id)?.props.size !== update.record.props.size
          ? update.record.children
              .map((id) => get(id))
              .filter(
                (child): child is CatalogConsumerNode =>
                  !!child && calendarBindings.has(child.bindingId ?? ""),
              )
          : []),
        ...(update.record.derivedProps || this.derivedOf(update.record, get)
          ? [update.record]
          : []),
      ]) {
        const rootId = this.recordRoots.get(thumb.id)!;
        const current = get(thumb.id)!;
        const derivedProps = this.derivedOf(current, get);
        const inheritedText = inheritedTextOf(current, get);
        const fillLayout = catalogFillLayout(current, get, this.typeOf);
        const {
          derivedProps: _previous,
          inheritedText: _previousText,
          fillLayout: _previousFill,
          ...rest
        } = current;
        const next = this.planRecord(
          thumb.id,
          {
            ...rest,
            ...(derivedProps ? { derivedProps } : {}),
            ...(inheritedText ? { inheritedText } : {}),
            ...(fillLayout ? { fillLayout } : {}),
          },
          rootId,
          get,
        );
        const index = updates.findIndex((item) => item.id === thumb.id);
        if (index >= 0) updates[index] = next;
        else updates.push(next);
        roots.add(rootId);
      }
    return { resolverVisits, includeChecks, updates, roots };
  }

  /**
   * Compute the root's next inputs for a committed transaction without changing root state. Uses
   * transaction IDs/revision and the runtime's pre/post influence closure. May throw.
   */
  private plan({ result, invalidatedIds }: CatalogStepContext): ConsumePlan {
    const valueOnly = result.forward.every(
      (op) =>
        [
          "patchNodeProp",
          "patchNodeVisual",
          "patchNodeSizing",
          "patchNodeLayout",
          "setNodeField",
          "setNodePlacement",
          "setNodeBinding",
          "patchDefinitionOverride",
        ].includes(op.kind) ||
        (op.kind === "put" &&
          (op.entry.kind === "token" ||
            op.entry.kind === "definitionOverride")),
    );
    if (valueOnly) {
      const indirect = result.forward.some(
        (op) =>
          op.kind === "patchDefinitionOverride" ||
          (op.kind === "put" &&
            (op.entry.kind === "token" ||
              op.entry.kind === "definitionOverride")),
      );
      const sources = new Set(indirect ? invalidatedIds : result.changedIds);
      const planned = this.planInstances(sources);
      const byRoot = new Map<NodeId, RecordPlan[]>();
      for (const update of planned.updates) {
        let list = byRoot.get(update.rootId);
        if (!list) byRoot.set(update.rootId, (list = []));
        list.push(update);
      }
      return {
        result,
        roots: [...byRoot].map(([rootId, updates]) => ({
          rootId,
          removed: [],
          updates,
        })),
        computeLayout: planned.roots.size > 0,
        metrics: {
          revision: result.revision,
          changedIds: [...result.changedIds],
          removedIds: [...result.removedIds],
          affectedRootIds: [...planned.roots],
          layoutInputVisits: planned.updates.length,
          resolverVisits: planned.resolverVisits,
          resolverIncludeChecks: planned.includeChecks,
          affectedInstanceCount: planned.updates.length,
          traversedWholeInputGraph:
            this.records.size > 0 &&
            planned.updates.length >= this.records.size,
        },
      };
    }
    const structureChanged = [...result.changedIds, ...result.removedIds].some(
      (id) => {
        const entry = this.runtime.graph.getEntry(id);
        return entry?.kind === "page" || entry?.kind === "project";
      },
    );
    const currentRoots = structureChanged
      ? new Set(this.pageRoots())
      : this.rootIds;
    const affectedRoots = new Set<NodeId>();
    if (structureChanged)
      for (const id of new Set([...this.rootIds, ...currentRoots]))
        affectedRoots.add(id);
    else
      for (const id of invalidatedIds) {
        for (const root of this.sourceRoots.get(id) ?? [])
          affectedRoots.add(root);
        if (this.rootIds.has(id as NodeId)) affectedRoots.add(id as NodeId);
      }
    let visits = 0;
    const roots: ConsumePlan["roots"][number][] = [];
    for (const rootId of affectedRoots) {
      const previous = this.rootMembers.get(rootId) ?? new Set<string>();
      const next = currentRoots.has(rootId)
        ? this.flatten(rootId)
        : new Map<string, CatalogConsumerNode>();
      visits += next.size;
      roots.push({
        rootId,
        removed: [...previous].filter((id) => !next.has(id)),
        // The root's next records are the lookup (a derived value reads its new neighbors).
        updates: [...next].map(([id, record]) =>
          this.planRecord(id, record, rootId, (key) => next.get(key)),
        ),
        members: new Set(next.keys()),
      });
    }
    const nextRootIds = structureChanged ? [...currentRoots] : undefined;
    return {
      result,
      roots,
      nextRootIds,
      rootChildren: nextRootIds?.map((id) =>
        identity(
          resolveCatalogNode(
            this.runtime.graph,
            id,
            this.state,
            undefined,
            this.breakpoint,
          ),
        ),
      ),
      computeLayout: affectedRoots.size > 0,
      metrics: {
        revision: result.revision,
        changedIds: [...result.changedIds],
        removedIds: [...result.removedIds],
        affectedRootIds: [...affectedRoots],
        layoutInputVisits: visits,
        resolverVisits: visits,
        resolverIncludeChecks: 0,
        affectedInstanceCount: visits,
        traversedWholeInputGraph:
          this.records.size > 0 && visits >= this.records.size,
      },
    };
  }

  /** Apply a computed plan in full (maps and layout tree — no consumer code). Journaled. */
  private apply(plan: ConsumePlan): Notice[] {
    const notices: Notice[] = [];
    for (const { rootId, removed, updates, members } of plan.roots) {
      for (const id of removed) this.applyRemoval(id, rootId, notices);
      for (const update of updates) this.applyRecord(update, notices);
      if (members) {
        this.keep(this.rootMembers, rootId);
        if (members.size) this.rootMembers.set(rootId, new Set(members));
        else this.rootMembers.delete(rootId);
      }
    }
    if (plan.nextRootIds) {
      const previous = [...this.rootIds];
      this.undoLog?.push(() => {
        this.rootIds.clear();
        for (const id of previous) this.rootIds.add(id);
      });
      this.rootIds.clear();
      for (const id of plan.nextRootIds) this.rootIds.add(id);
      this.layoutTouched = true;
      this.layout.updateChildren("catalog:root", [...plan.rootChildren!]);
      // A project/page edit can change the page container (`pageLayout`) itself.
      if (this.pageFrames)
        this.layout.updateNodeStyle("catalog:root", this.rootStyle());
    }
    if (plan.computeLayout) {
      this.layoutTouched = true;
      this.layout.computeLayout(this.viewport.width, this.viewport.height);
      this.rewrap(
        this.rewrapScope(
          plan.roots.flatMap(({ updates }) =>
            updates.map((update) => update.id),
          ),
        ),
      );
    }
    this.currentMetrics = {
      ...plan.metrics,
      canvasInputUpdates: 0,
      domInputUpdates: 0,
    };
    return notices;
  }
  /** Notify after the step is published. Every subscriber is called; errors are returned. */
  private deliver(plan: ConsumePlan, notices: readonly Notice[]): unknown[] {
    const errors: unknown[] = [];
    let canvas = 0;
    let dom = 0;
    for (const { id, record } of notices) {
      for (const callback of [...(this.canvasListeners.get(id) ?? [])]) {
        canvas++;
        try {
          callback(record);
        } catch (error) {
          errors.push(error);
        }
      }
      for (const callback of [...(this.domListeners.get(id) ?? [])]) {
        dom++;
        try {
          callback(record);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    this.currentMetrics = {
      ...plan.metrics,
      canvasInputUpdates: canvas,
      domInputUpdates: dom,
    };
    return errors;
  }
}
