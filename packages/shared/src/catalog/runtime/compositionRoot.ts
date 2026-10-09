import {
  CATALOG_SIZE_PASS_THROUGH,
  CATALOG_SIZE_PROPAGATION,
  CATALOG_TOGGLE_GROUP_OF,
} from "../document/sizePropagation";
import { isFieldControlGroup } from "../../domain/componentTraits";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/catalog-style.types";
import { tableBinding } from "../bindings/Table.binding";
import { definitionTypeName } from "../commands/context";
import type {
  DefinitionId,
  EntryId,
  NodeId,
  PageLayoutDeclaration,
  PagePlacementDeclaration,
  StateName,
} from "../document/types";
import type {
  CatalogRowSource,
  CatalogResolutionSelection,
  ResolvedCatalogNode,
} from "../resolution/resolver";
import type { CatalogCommand, CatalogCommandPlan } from "../commands/compose";
import { CatalogValidationError } from "../document/validation";
import type {
  CatalogOperation,
  CatalogTransactionResult,
} from "../transactions/transaction";
import { catalogNodeState, resolveCatalogNode } from "../resolution/resolver";
import { catalogAuthoredVisual } from "./libraryVisual";
import { catalogRuleTextColor } from "./rulePaint";
import {
  isComponentsView,
  ORIGIN_VIEW_NODE,
  type CatalogComponentsViewId,
} from "./originViewNode";
type CatalogDefinitionViewId =
  import("../document/types").DefinitionId | CatalogComponentsViewId;
import {
  PersistentLayoutTree,
  type PersistentBatchNode,
} from "./persistentLayoutTree";
import type { LayoutEngineAPI } from "./layoutEngine";
import type { LayoutResult } from "./engineTypes";
import { parseGridTemplate } from "./gridStyleAdapter";
import {
  catalogBreadcrumbSeparatorIcon,
  catalogCurrentTextWeight,
  catalogCalendarGridSize,
  catalogCalendarHeaderParts,
} from "../resolvers/resolveCatalogRuleCanvasBox";
import { resolveTextSourceText } from "@composition/rendering";
import { applyTextTransform } from "./textTransform";
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
} from "./pagePlacement";
import { CANVAS_VIEWPORT } from "./canvasBreakpoints";
import {
  racDateSegmentParts,
  racFieldHourCycle,
  type DateSegmentPart,
} from "../document/dateSegments";
import {
  catalogDateSegmentPaddingX,
  catalogDateSegmentPlaceholderPaint,
  catalogSelectPlaceholderColor,
} from "../document/rulePartRules";
import { catalogDropZoneContent } from "./dropZoneContent";
import {
  catalogValueDependents,
  catalogWithValues,
  type CatalogValueTemplate,
} from "./valueBindings";
import {
  catalogBoxModel,
  catalogTextBreaksWords,
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
  catalogStateDependents,
  catalogToggleGroupItems,
  catalogItemRemoveGlyphItem,
  catalogTreeChevronGlyphItem,
  catalogSelectionIndicatorLayout,
  catalogPresenceScope,
  catalogBreadcrumbItems,
  catalogBreadcrumbSeparator,
  catalogItemLabels,
  catalogItemSlotInset,
  catalogLabelSuffix,
  catalogLabelSuffixDependents,
  catalogSliderThumbLayout,
  catalogProgressFillLayout,
  catalogSliderFillLayout,
  catalogSliderThumbs,
  catalogTreeChevronLayout,
  catalogTreeItemLayout,
  catalogTreeChevrons,
} from "./presence";
import {
  catalogRecordVariables,
  catalogStateEnv,
  catalogStateNames,
  catalogStateProps,
  type CatalogStateSource,
} from "./stateTemplate";
import {
  CatalogRuntime,
  type CatalogExternalEffect,
  type CatalogStepConsumer,
  type CatalogStepContext,
} from "./controller";
import {
  deriveSlotChromeInput,
  slotChromeLayoutNodes,
  type SlotChromeContext,
  type SlotChromeInput,
} from "./slotChrome";

/**
 * Values a Canvas gesture or a Styles drag shows on one record before it commits
 * (`previewRecord`): resolved values at the current breakpoint, merged over the record's own.
 */
export interface CatalogRecordPreview {
  readonly visual?: Readonly<Record<string, string | number | boolean>>;
  readonly sizing?: Readonly<Record<string, number>>;
  readonly layout?: Readonly<Record<string, string>>;
  readonly placement?: CatalogConsumerNode["placement"];
  /** The paint layers shown instead of the record's (a Fill drag). */
  readonly fills?: CatalogConsumerNode["fills"];
  /** Visual keys the commit removes (a Fill replaces fill-derived background CSS). */
  readonly omitVisual?: readonly string[];
}

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
  /**
   * The props as written when they hold `{{ name }}` templates (`props` has the values): the
   * text editor edits these, and a variable change re-resolves them (`refreshState`).
   */
  readonly templateProps?: ResolvedCatalogNode["props"];
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
  /** The author's class names and accessible name (`metadata.className` · `ariaLabel`). */
  readonly className?: string;
  readonly ariaLabel?: string;
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
   * ADR-256 Decision 7 — the value condition of the position (`presentWhen`): the outer layer (the
   * template position that places this part) over the part origin's own.
   */
  readonly presentWhen?: ResolvedCatalogNode["presentWhen"];
  /**
   * ADR-256 Decision 7 — the states in which the position is there (`showWhen`): the outer layer
   * over the part origin's own, as `presentWhen`.
   */
  readonly showWhen?: ResolvedCatalogNode["showWhen"];
  /** The values each state gives the drawn root (`ResolvedCatalogNode.stateVisual`). */
  readonly stateVisual?: ResolvedCatalogNode["stateVisual"];
  /**
   * Values the owning RAC component gives this sub-part (`catalogDerivedProps` — a progress
   * track's fill): the Canvas paints them over the resolved props; the DOM owner renders its own.
   */
  readonly derivedProps?: Readonly<Record<string, string | number | boolean>>;
  /**
   * ADR-256 Decision 12 — the props · visual written with a RAC render props value binding
   * (`{valueText}` · `{percentage}%`, `valueBindings.ts`): `props` / `visual` hold the values the
   * owner's record gives; a changed owner re-resolves them.
   */
  readonly valueTemplate?: CatalogValueTemplate;
  /**
   * Inheritable text values (CSS inheritance) the nearest ancestors declare and this node does
   * not (`CATALOG_INHERITED_TEXT_KEYS`). Resolved here so the Canvas paint, the layout measure
   * and the DOM inline style read one value instead of relying on the browser cascade.
   */
  readonly inheritedText?: Readonly<Record<string, string | number | boolean>>;
  /** Fill intent projected against the parent box (`fillLayout.ts`); Rust and DOM apply it. */
  readonly fillLayout?: Readonly<Record<string, string | number>>;
  /** A data row's index on the row's record (`ResolvedCatalogNode.rowIndex`). */
  readonly rowIndex?: number;
  /** A row owner that grows with its rows: the collection's row count (`ResolvedCatalogNode.rowCount`). */
  readonly rowCount?: number;
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
  "overflowWrap",
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
/**
 * The author's DOM attributes of a collapsed composite instance: the instance node's (the element
 * the author edits), else its template root's.
 */
function domAttributes(
  top: ResolvedCatalogNode,
  target: ResolvedCatalogNode,
): Pick<CatalogConsumerNode, "htmlId" | "className" | "ariaLabel"> {
  const htmlId = top.htmlId ?? target.htmlId;
  const className = top.className ?? target.className;
  const ariaLabel = top.ariaLabel ?? target.ariaLabel;
  return {
    ...(htmlId ? { htmlId } : {}),
    ...(className ? { className } : {}),
    ...(ariaLabel ? { ariaLabel } : {}),
  };
}

/** The optional authored fields a record carries only when the resolved node declares them. */
function authoredFields(
  node: ResolvedCatalogNode,
): Pick<
  CatalogConsumerNode,
  | "fills"
  | "fillSizing"
  | "themeOverride"
  | "authoredLayout"
  | "htmlId"
  | "className"
  | "ariaLabel"
> {
  return {
    ...(node.fills ? { fills: node.fills } : {}),
    ...(node.fillSizing ? { fillSizing: node.fillSizing } : {}),
    ...(node.themeOverride ? { themeOverride: node.themeOverride } : {}),
    ...(node.authoredLayout ? { authoredLayout: node.authoredLayout } : {}),
    ...(node.htmlId ? { htmlId: node.htmlId } : {}),
    ...(node.className ? { className: node.className } : {}),
    ...(node.ariaLabel ? { ariaLabel: node.ariaLabel } : {}),
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
  orderOf?: (id: string) => number,
): string[] {
  const out = parts.filter((part) => !part.wraps).map((part) => part.id);
  // CSS `order` places a flex / grid item by its order, then source order (a stable sort).
  const ordered = orderOf
    ? children
        .map((child, index) => ({ child, index, order: orderOf(child) }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map((entry) => entry.child)
    : children;
  for (const child of ordered) {
    const wrapper = parts.find((part) => part.wraps?.includes(child));
    if (!wrapper) out.push(child);
    else if (!out.includes(wrapper.id)) out.push(wrapper.id);
  }
  if (chromeId) out.push(chromeId);
  return out;
}

function identity(node: ResolvedCatalogNode): string {
  const base = `${node.instancePath.join("/")}::${node.sourceId}`;
  return node.rowKey === undefined
    ? base
    : `${base}${CATALOG_ROW_SEPARATOR}${encodeURIComponent(node.rowKey)}`;
}
/** A data row record's identity: the row template position's, then this and the row key. */
export const CATALOG_ROW_SEPARATOR = "#row:";
/** The row template position's identity of a (data row) record identity. */
export function catalogRowTemplateIdentity(recordId: string): string {
  const at = recordId.indexOf(CATALOG_ROW_SEPARATOR);
  return at < 0 ? recordId : recordId.slice(0, at);
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
  /**
   * A page root's frame on the page grid (size and placement): it reads the page entry, which the
   * record does not carry — compared with the frame applied last, not with `styleFor(old)`.
   */
  readonly frame: Record<string, unknown> | undefined;
  readonly chrome: SlotChromeInput | undefined;
  readonly parts: readonly CatalogComposedPart[];
}
interface ConsumePlan {
  /** Absent for a data-row refresh (no document step). */
  readonly result?: CatalogTransactionResult;
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
const noWrapTextBindings: ReadonlySet<string> = new Set([
  "button",
  "label",
  // Table.css `.react-aria-Cell, .react-aria-Column`: one line cut with an ellipsis.
  "cell",
  "column",
]);
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
  /** Data rows of bound collections (the data store); absent = template items only. */
  rows?: CatalogRowSource;
  /**
   * The Builder's sample policy (ADR-157): a row owner that grows with its rows shows its first
   * `rowSample` rows; the later rows keep their layout box (the owner's height stays the DOM's)
   * but the Canvas does not draw or pick them and marks their area "+N more". Absent = every row.
   */
  rowSample?: number;
  /**
   * `{{ name }}` values: project variables and runtime values (the Preview). Absent = the
   * document's variables at their defaults (the Canvas's designed asymmetry, ADR-214 R2).
   */
  state?: CatalogStateSource;
  /**
   * The definition edit view (ADR-248 4e): the Canvas draws one project definition's template
   * instead of the pages — its template nodes are ordinary owned nodes, so every edit is the same
   * command as on a page. A layout keeps the breakpoint's page size; a component its own size.
   */
  definitionView?: CatalogDefinitionViewId;
}
/** The graph's page container declaration in the old placement derivation's input shape. */
export function catalogPageLayoutSettings(
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
export function catalogPagePlacement(
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
  overflowWrap?: string;
  /** CSS `white-space`: whether line breaks in the text collapse (normal · nowrap) or hold. */
  whiteSpace?: string;
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
    (typeName === "Breadcrumb" || typeName === "Text" || typeName === "Link") &&
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
      ...(typography.overflowWrap !== undefined
        ? { overflowWrap: typography.overflowWrap }
        : {}),
      ...(typography.whiteSpace !== undefined
        ? { whiteSpace: typography.whiteSpace }
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
  /** The date field whose RAC DateInput this is (past the field's control Group). */
  ownerType?: string;
  /** The owner's empty-segment font style (`[data-placeholder]` — DateField italic). */
  placeholderFontStyle?: string;
  parts: readonly DateSegmentPart[];
  paddingX: number;
  lineHeight?: number;
}

/** One RAC date segment's text in its DateInput's content box. */
export interface CatalogDateSegmentRun {
  readonly text: string;
  /** Text start (an editable segment's span is inset by its inline padding). */
  readonly x: number;
  readonly editable: boolean;
}

/** The font a DateInput's segments inherit (its own size and weight, the nearest line height). */
function segmentFont(
  node: CatalogConsumerNode,
  segmentText: CatalogDateSegments,
) {
  return {
    fontSize: Number(node.visual.fontSize),
    fontWeight: Number(node.visual.fontWeight ?? 400),
    lineHeight: segmentText.lineHeight ?? 0,
  };
}

/**
 * The RAC segment row: each part is its own inline span (editable parts padded), a range repeats
 * the row around its separator with the trigger gap. `width` is the row's extent.
 */
function segmentRuns(
  segmentText: CatalogDateSegments,
  measure: CatalogTextMeasure,
  font: CatalogTextFont,
): { runs: CatalogDateSegmentRun[]; width: number; height: number } {
  // The empty editable segments take the owner's placeholder font style (DateField italic).
  const placeholderFont = segmentText.placeholderFontStyle
    ? { ...font, fontStyle: segmentText.placeholderFontStyle }
    : font;
  let height = 0;
  const widthOf = (text: string, editable: boolean) => {
    const size = measure(text, editable ? placeholderFont : font);
    height = Math.max(height, size.height);
    return size.exactWidth ?? size.width;
  };
  const runs: CatalogDateSegmentRun[] = [];
  let x = 0;
  const row = () => {
    for (const part of segmentText.parts) {
      const pad = part.editable ? segmentText.paddingX : 0;
      // Each RAC segment is its own flex item: CSS drops the collapsible spaces at its start and
      // end (ko-KR `". "` is 3.6px in the DOM, not the 7.1px of `". "` — no-break spaces stay).
      const text = part.text.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, "");
      runs.push({ text, x: x + pad, editable: part.editable });
      x += widthOf(text, part.editable) + 2 * pad;
    }
  };
  row();
  return { runs, width: x, height };
}

/** Rust `NodeStyle` input. It has no `padding`/`gap` shorthand (serde drops unknown keys). */
/**
 * A Table's own height when the author set none (the old layout's Table rule): `heightMode`
 * "fixed" (the binding default) is the DOM virtualizer's `height` (default 400) inside the outer
 * box's border; the other modes follow the content.
 */
function catalogTableHeight(
  node: CatalogConsumerNode,
  borderWidth: CatalogLength | undefined,
): { height?: string } {
  const accepts = tableBinding.props.accepts;
  const mode = node.props.heightMode ?? accepts.heightMode?.default;
  if (mode !== "fixed") return {};
  const height =
    typeof node.props.height === "number"
      ? node.props.height
      : accepts.height?.default;
  if (typeof height !== "number") return {};
  // Table.css `border: 1px solid` when the rule writes none.
  const border = typeof borderWidth === "number" ? borderWidth : 1;
  return { height: `${height + border * 2}px` };
}

/** The width before a StatusLight's label: its dot (rule `indicator.dotSize`) and the row gap. */
function catalogStatusLightLead(node: CatalogConsumerNode): number {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .StatusLight;
  const size =
    rule?.sizes[String(node.props.size ?? rule.defaultSize)] ??
    (rule?.defaultSize ? rule.sizes[rule.defaultSize] : undefined);
  const gap = Number(node.visual.gap ?? size?.gap ?? 8);
  return (size?.indicator?.dotSize ?? 10) + (Number.isFinite(gap) ? gap : 8);
}

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
          const { width, height } = segmentRuns(
            segmentText,
            measure,
            segmentFont(node, segmentText),
          );
          return {
            contentMinWidth: width,
            contentMaxWidth: width,
            contentHeight: height,
          };
        })()
      : undefined;
  // A DropZone's content box is its composed icon · label · description column.
  const dropZone = measure ? catalogDropZoneContent(node, measure) : undefined;
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
          // A StatusLight's label follows its dot (the DOM flex row: dot · gap · label).
          const lead =
            node.bindingId === "statuslight" ? catalogStatusLightLead(node) : 0;
          const width = (size.exactWidth ?? size.width) + lead;
          if (lead > 0)
            return {
              contentMinWidth: width,
              contentMaxWidth: width,
              contentHeight: wrappedHeight ?? size.height,
            };
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
  // An Input without text (no value, no placeholder) keeps its line box, as the DOM `<input>`
  // does: its height is one line + padding + border either way (ADR-253 — the Input rule's
  // content height).
  const emptyLine =
    !leaf &&
    typeName === "Input" &&
    node.children.length === 0 &&
    Number(node.visual.fontSize) > 0 &&
    Number(node.visual.lineHeight) > 0
      ? {
          contentHeight:
            Number(node.visual.fontSize) * Number(node.visual.lineHeight),
        }
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
    ...(box.height !== undefined
      ? { height: px(box.height) }
      : node.bindingId === "table"
        ? catalogTableHeight(node, box.borderWidth)
        : {}),
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
    ...(contentText ?? emptyLine ?? {}),
    ...(glyph !== undefined
      ? { contentMinWidth: glyph, contentMaxWidth: glyph, contentHeight: glyph }
      : {}),
    ...(segments ?? {}),
    ...(dropZone
      ? {
          contentMinWidth: dropZone.minWidth,
          contentMaxWidth: dropZone.width,
          contentHeight: wrappedHeight ?? dropZone.height,
        }
      : {}),
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
/** The record with its `hidden` judged again (`catalogHiddenAtRest`) against `get`. */
function withHidden(
  record: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): CatalogConsumerNode {
  const { hidden: _hidden, ...shown } = record;
  return catalogHiddenAtRest(shown, get, typeOf)
    ? { ...shown, hidden: true }
    : shown;
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
    sameFields(left.templateProps ?? {}, right.templateProps ?? {}) &&
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
    // ADR-256 Decision 7: the DOM judges a node's presence itself (RAC state) — a changed
    // condition is a changed record even where the Canvas's resting judgment stays the same.
    left.presentWhen === right.presentWhen &&
    JSON.stringify(left.showWhen) === JSON.stringify(right.showWhen) &&
    left.rowIndex === right.rowIndex &&
    left.rowCount === right.rowCount &&
    sameFields(left.derivedProps ?? {}, right.derivedProps ?? {}) &&
    JSON.stringify(left.valueTemplate ?? null) ===
      JSON.stringify(right.valueTemplate ?? null) &&
    sameFields(left.inheritedText ?? {}, right.inheritedText ?? {}) &&
    sameFields(left.fillLayout ?? {}, right.fillLayout ?? {}) &&
    sameFields(left.authoredLayout ?? {}, right.authoredLayout ?? {}) &&
    left.htmlId === right.htmlId &&
    left.className === right.className &&
    left.ariaLabel === right.ariaLabel &&
    JSON.stringify(left.fills ?? null) ===
      JSON.stringify(right.fills ?? null) &&
    JSON.stringify(left.fillSizing ?? null) ===
      JSON.stringify(right.fillSizing ?? null) &&
    JSON.stringify(left.themeOverride ?? null) ===
      JSON.stringify(right.themeOverride ?? null) &&
    (left.stateVisual === right.stateVisual ||
      JSON.stringify(left.stateVisual ?? null) ===
        JSON.stringify(right.stateVisual ?? null)) &&
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
  private readonly rows?: CatalogRowSource;
  /** `CatalogRootOptions.rowSample`. */
  readonly rowSample?: number;
  private readonly stateSource?: CatalogStateSource;
  /** The definition drawn instead of the pages (`CatalogRootOptions.definitionView`). */
  readonly definitionView?: CatalogDefinitionViewId;
  /** Page of each page root node (`pageRoots`). */
  private readonly rootPage = new Map<NodeId, EntryId<"page">>();
  private readonly records = new Map<string, CatalogConsumerNode>();
  private readonly rootMembers = new Map<NodeId, Set<string>>();
  private readonly sourceRoots = new Map<string, Set<NodeId>>();
  private readonly sourceInstances = new Map<string, Set<string>>();
  /** The page frame style applied last per page root record (see `RecordPlan.frame`). */
  private readonly appliedFrames = new Map<string, Record<string, unknown>>();
  private readonly recordRoots = new Map<string, NodeId>();
  private readonly rootIds = new Set<NodeId>();
  private readonly slotChrome = new Map<string, SlotChromeInput>();
  /** Owner-composed layout leaves per record (`catalogComposedParts`), before its children. */
  /** Records whose engine children need CSS `order` sorting after an apply (`applyOrders`). */
  private readonly orderDirty = new Set<string>();
  /**
   * A flex / grid record's child order (`layout.order`, 0 by default) when any child sets one;
   * undefined for any other record (source order).
   */
  private childOrder(
    record: CatalogConsumerNode | undefined,
  ): ((id: string) => number) | undefined {
    if (!record || !/^(inline-)?(flex|grid)$/.test(record.layout.display ?? ""))
      return undefined;
    const orderOf = (id: string) =>
      Number(this.records.get(id)?.layout.order ?? 0) || 0;
    return record.children.some((id) => orderOf(id) !== 0)
      ? orderOf
      : undefined;
  }
  /** The engine children of every record an apply left out of CSS `order` (both maps final). */
  private applyOrders(): void {
    for (const id of this.orderDirty) {
      const record = this.records.get(id);
      if (!record) continue;
      this.layout.updateChildren(id, [
        ...layoutChildrenOf(
          record.children,
          this.composedParts.get(id) ?? [],
          this.slotChrome.get(id)?.id,
          this.childOrder(record),
        ),
      ]);
    }
    this.orderDirty.clear();
  }
  private readonly composedParts = new Map<
    string,
    readonly CatalogComposedPart[]
  >();
  /** Wrapped text-leaf content heights from the last `rewrap` (absent = one line). */
  private readonly wrapHeights = new Map<string, number>();
  /** Hears every `previewRecord` (the Canvas re-lays its scene out: siblings may move). */
  private readonly previewListeners = new Set<() => void>();
  /** Records a gesture previews (`previewRecord`): the record it replaced and the one shown. */
  private readonly previews = new Map<
    string,
    { base: CatalogConsumerNode; shown: CatalogConsumerNode }
  >();
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
    this.rows = options.rows;
    this.rowSample = options.rowSample;
    this.stateSource = options.state;
    this.definitionView = options.definitionView;
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
  /** The records (drawn positions) of one node or template: one source can be drawn many times. */
  recordsOfSource(sourceId: string): readonly string[] {
    return [...(this.sourceInstances.get(sourceId) ?? [])];
  }
  /** The top record of every page root, in page-grid order (the Canvas scene roots). */
  pageRootRecords(): string[] {
    return [...this.rootIds].flatMap((rootId) =>
      this.recordsOfSource(rootId).filter(
        (id) => this.records.get(id)?.parentId === "catalog:root",
      ),
    );
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
  /** A Preview replica takes the editor's delta: the same consumer, no history, no save. */
  sync(ops: readonly CatalogOperation[]): CatalogTransactionResult {
    return this.runtime.sync("Sync", ops, this.consume);
  }
  /**
   * One user action (ADR-248 Phase 4b): the command plans on the graph as it is and commits at
   * that revision. If the graph moved in between (REVISION_CONFLICT — a plan made before an await,
   * or an edit a consumer caused), the command plans once more on the new graph.
   */
  execute(command: CatalogCommand): {
    plan: CatalogCommandPlan;
    result: CatalogTransactionResult;
  } {
    for (let attempt = 0; ; attempt++) {
      const revision = this.runtime.graph.revision;
      const plan = command(this.runtime.graph);
      try {
        return {
          plan,
          result: this.runtime.dispatch(
            plan.label,
            plan.ops,
            revision,
            this.consume,
          ),
        };
      } catch (error) {
        if (
          attempt === 0 &&
          error instanceof CatalogValidationError &&
          error.code === "REVISION_CONFLICT"
        )
          continue;
        throw error;
      }
    }
  }
  /**
   * A change outside the document as one history entry (ADR-248 4e-4e, one stack): `command`
   * (optional) is its document part, planned and committed now like `execute`. The entry is named
   * `label` (the outside change names it — e.g. "Add collection — Users", not its "Bind data" part).
   */
  recordExternal(
    label: string,
    effect: CatalogExternalEffect,
    command?: CatalogCommand,
  ): { plan?: CatalogCommandPlan; result?: CatalogTransactionResult } {
    const plan = command?.(this.runtime.graph);
    const result = this.runtime.recordExternal(
      label,
      effect,
      plan?.ops ?? [],
      this.consume,
    );
    return { ...(plan ? { plan } : {}), ...(result ? { result } : {}) };
  }
  undo(): CatalogTransactionResult | undefined {
    return this.runtime.undo(this.consume);
  }
  redo(): CatalogTransactionResult | undefined {
    return this.runtime.redo(this.consume);
  }

  /**
   * Data rows changed outside the document (the data store): re-resolve the page roots that show
   * a binding to one of these collections (catalog `data:collection:` ids; absent = every bound
   * root). Journaled and delivered like a step; the document revision does not move. Returns the
   * subscriber errors.
   */
  refreshRows(collectionIds?: ReadonlySet<string>): unknown[] {
    const affected = new Set<NodeId>();
    for (const [sourceId, recordIds] of this.sourceInstances) {
      const entry = this.runtime.graph.getEntry(sourceId);
      if (entry?.kind !== "node" || !entry.binding) continue;
      if (collectionIds && !collectionIds.has(entry.binding.collectionId))
        continue;
      for (const recordId of recordIds) {
        const rootId = this.recordRoots.get(recordId);
        if (rootId) affected.add(rootId);
      }
    }
    if (!affected.size) return [];
    let visits = 0;
    const roots = [...affected].map((rootId) => {
      const previous = this.rootMembers.get(rootId) ?? new Set<string>();
      const next = this.flatten(rootId);
      visits += next.size;
      return {
        rootId,
        removed: [...previous].filter((id) => !next.has(id)),
        updates: [...next].map(([id, record]) =>
          this.planRecord(id, record, rootId, (key) => next.get(key)),
        ),
        members: new Set(next.keys()),
      };
    });
    const plan: ConsumePlan = {
      roots,
      computeLayout: true,
      metrics: {
        ...this.emptyMetrics(this.currentMetrics.revision),
        affectedRootIds: [...affected],
        layoutInputVisits: visits,
        resolverVisits: visits,
        affectedInstanceCount: visits,
      },
    };
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
    return this.deliver(plan, notices);
  }

  /**
   * A record with its `{{ name }}` templates resolved against the variables it sees (its record
   * chain, its page, the project): `props` = values, `templateProps` = as written. The same
   * record when it has no template.
   */
  private withState(
    record: CatalogConsumerNode,
    get: (id: string) => CatalogConsumerNode | undefined,
    pageId: EntryId<"page"> | undefined,
  ): CatalogConsumerNode {
    const { templateProps, ...rest } = record;
    const authored = templateProps ?? record.props;
    const props = catalogStateProps(authored, () =>
      catalogStateEnv(
        catalogRecordVariables(
          this.runtime.graph,
          record,
          get,
          pageId,
          this.stateSource?.projectVariables() ?? [],
        ),
        this.stateSource?.read?.bind(this.stateSource),
      ),
    );
    if (!props) return templateProps ? { ...rest, props: authored } : record;
    return { ...rest, props, templateProps: authored };
  }
  /** Records whose written props hold a template (`names`: only those reading one of them). */
  private stateReaders(names?: ReadonlySet<string>): string[] {
    const ids: string[] = [];
    for (const [id, record] of this.records)
      if (
        record.templateProps &&
        (!names ||
          catalogStateNames(record.templateProps).some((name) =>
            names.has(name),
          ))
      )
        ids.push(id);
    return ids;
  }

  /**
   * Variable values changed outside the document (a runtime write, the data store's project
   * variables): re-resolve the records whose templates read them (`names`; absent = every
   * template). Journaled and delivered like a step; the document revision does not move. Returns
   * the subscriber errors.
   */
  refreshState(names?: ReadonlySet<string>): unknown[] {
    const byRoot = new Map<NodeId, RecordPlan[]>();
    const get = (key: string) => this.records.get(key);
    for (const id of this.stateReaders(names)) {
      const record = this.records.get(id)!;
      const rootId = this.recordRoots.get(id)!;
      // (ADR-256 Decision 12 — the value bindings are read again from the new written values.)
      const { valueTemplate, ...unbound } = this.withState(
        record,
        get,
        this.rootPage.get(rootId),
      );
      const valued = catalogWithValues(
        valueTemplate?.visual
          ? {
              ...unbound,
              visual: { ...unbound.visual, ...valueTemplate.visual },
            }
          : unbound,
        get,
        this.typeOf,
        this.locale,
      );
      if (sameFields(valued.props, record.props)) continue;
      // A value-conditioned part (ADR-256 Decision 7) follows its new final text.
      const next =
        valued.presentWhen === undefined
          ? valued
          : withHidden(valued, get, this.typeOf);
      let list = byRoot.get(rootId);
      if (!list) byRoot.set(rootId, (list = []));
      list.push(this.planRecord(id, next, rootId));
    }
    // ADR-256 Decision 7: a state owner's new values re-judge the conditioned nodes below it.
    const refreshed = new Map(
      [...byRoot.values()].flat().map((plan) => [plan.id, plan.record]),
    );
    const read = (key: string) => refreshed.get(key) ?? this.records.get(key);
    // ADR-256 Decision 12: an owner's new values reach the parts bound to them (`{valueText}`).
    for (const record of [...refreshed.values()])
      for (const dependent of catalogValueDependents(
        record,
        read,
        this.typeOf,
      )) {
        const current = read(dependent.id)!;
        const valued = catalogWithValues(
          current,
          read,
          this.typeOf,
          this.locale,
        );
        const next =
          valued.presentWhen === undefined
            ? valued
            : withHidden(valued, read, this.typeOf);
        if (
          sameFields(next.props, current.props) &&
          sameFields(next.visual, current.visual) &&
          next.hidden === current.hidden
        )
          continue;
        const rootId = this.recordRoots.get(dependent.id)!;
        let list = byRoot.get(rootId);
        if (!list) byRoot.set(rootId, (list = []));
        refreshed.set(dependent.id, next);
        const at = list.findIndex((plan) => plan.id === dependent.id);
        const plan = this.planRecord(dependent.id, next, rootId);
        if (at >= 0) list[at] = plan;
        else list.push(plan);
      }
    // (Judged against the final lookup — a node refreshed with its owner is judged again too.)
    const dependents = new Map<string, CatalogConsumerNode>();
    for (const record of [...refreshed.values()]) {
      if (record.showWhen) dependents.set(record.id, record);
      for (const dependent of catalogStateDependents(record, read, this.typeOf))
        dependents.set(dependent.id, read(dependent.id)!);
    }
    for (const dependent of dependents.values()) {
      const { hidden: _hidden, ...shown } = dependent;
      const hidden = catalogHiddenAtRest(shown, read, this.typeOf);
      if (hidden === (dependent.hidden === true)) continue;
      const rootId = this.recordRoots.get(dependent.id)!;
      let list = byRoot.get(rootId);
      if (!list) byRoot.set(rootId, (list = []));
      const next = hidden ? { ...shown, hidden: true as const } : shown;
      refreshed.set(dependent.id, next);
      const at = list.findIndex((plan) => plan.id === dependent.id);
      const plan = this.planRecord(dependent.id, next, rootId);
      if (at >= 0) list[at] = plan;
      else list.push(plan);
    }
    if (!byRoot.size) return [];
    const count = [...byRoot.values()].reduce(
      (sum, list) => sum + list.length,
      0,
    );
    const plan: ConsumePlan = {
      roots: [...byRoot].map(([rootId, updates]) => ({
        rootId,
        removed: [],
        updates,
      })),
      computeLayout: true,
      metrics: {
        ...this.emptyMetrics(this.currentMetrics.revision),
        affectedRootIds: [...byRoot.keys()],
        layoutInputVisits: count,
        resolverVisits: 0,
        affectedInstanceCount: count,
      },
    };
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
    return this.deliver(plan, notices);
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
    if (this.definitionView) {
      // The Components page: the derived root frame the workspace put in the graph's view.
      if (isComponentsView(this.definitionView))
        return this.runtime.graph.isViewEntry(ORIGIN_VIEW_NODE)
          ? [ORIGIN_VIEW_NODE]
          : [];
      const definition = this.runtime.graph.getEntry(this.definitionView);
      return definition?.kind === "definition" && definition.templateRootId
        ? [definition.templateRootId]
        : [];
    }
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
  private flatten(
    rootId: NodeId,
    regionId?: string,
    onVisit?: () => void,
  ): Map<string, CatalogConsumerNode> {
    const output = new Map<string, CatalogConsumerNode>();
    const region = regionId ? this.records.get(regionId) : undefined;
    let selection: CatalogResolutionSelection | undefined;
    if (region) {
      const allowed = new Set<string>();
      const ownedNext = new Map<string, NodeId>();
      const scanAll = new Set<string>();
      for (
        let cursor: CatalogConsumerNode | undefined = region;
        cursor;
        cursor = this.records.get(cursor.parentId)
      ) {
        allowed.add(cursor.id);
        for (const id of cursor.collapsedIds ?? []) allowed.add(id);
        const parent = this.records.get(cursor.parentId);
        if (parent) {
          const hop = this.ownedHop(parent, cursor);
          if (hop === "scan") scanAll.add(parent.id);
          else if (hop) ownedNext.set(parent.id, hop);
        }
      }
      const inside = (path: readonly string[]) =>
        path.length >= region.instancePath.length &&
        region.instancePath.every((id, index) => path[index] === id);
      selection = {
        include: (id, path) =>
          inside(path) || allowed.has(`${path.join("/")}::${id}`),
        ownedChildren: (id, path) => {
          const key = `${path.join("/")}::${id}`;
          if (inside(path) || scanAll.has(key)) return undefined;
          const next = ownedNext.get(key);
          return next ? [next] : [];
        },
        onVisit,
      };
    }
    const visit = (node: ResolvedCatalogNode, parentId: string): string => {
      const id = identity(node);
      const layers = this.collapseLayers(node);
      const children = collapsedChildren(layers).map((child) =>
        visit(child, id),
      );
      output.set(id, this.consumerRecord(id, parentId, children, node, layers));
      return id;
    };
    const resolved = resolveCatalogNode(
      this.runtime.graph,
      rootId,
      this.state,
      selection,
      this.breakpoint,
      this.colorMode,
      this.rows,
    );
    const find = (
      node: ResolvedCatalogNode,
    ): ResolvedCatalogNode | undefined => {
      if (identity(node) === regionId) return node;
      for (const child of node.children) {
        const found = find(child);
        if (found) return found;
      }
      return undefined;
    };
    const top = region ? find(resolved) : resolved;
    if (!top) throw new Error(`RESOLVED_REGION_MISSING:${regionId}`);
    visit(top, region?.parentId ?? "catalog:root");
    const get = (key: string) =>
      output.get(key) ?? (region ? this.records.get(key) : undefined);
    const pageId = this.rootPage.get(rootId);
    for (const [id, record] of output) {
      const templated = this.withState(record, get, pageId);
      if (templated !== record) output.set(id, templated);
    }
    // ADR-256 Decision 12: value bindings read their owners' records (a part's final text decides
    // its `presentWhen` below).
    for (const [id, record] of output) {
      const valued = catalogWithValues(record, get, this.typeOf, this.locale);
      if (valued !== record) output.set(id, valued);
    }
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
      const fillLayout =
        catalogFillLayout(record, get, this.typeOf) ??
        catalogSelectionIndicatorLayout(record);
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
    // A Select's value shows its placeholder (the Canvas draws no selection): the Select sheet's
    // `[data-placeholder]` paint, unless the value authors its own color. The DOM leaves its color
    // to that sheet (`domBinding.tsx`), so the derived color is the Canvas's.
    if (
      record.bindingId === "selectvalue" &&
      catalogAuthoredVisual(this, record).color === undefined
    ) {
      const color = catalogSelectPlaceholderColor(this.colorMode);
      if (color) return { ...derived, color };
    }
    // (A Tag's remove glyph takes the item color too — ADR-256 Phase 5d; so does a TreeItem's
    // chevron glyph — `Tree.css` `all: unset` on its button, the row's color — Phase 5h.)
    const glyphItem =
      catalogItemRemoveGlyphItem(record, get, this.typeOf) ??
      catalogTreeChevronGlyphItem(record, get, this.typeOf);
    const item = glyphItem ?? get(record.parentId);
    if (
      !item?.ruleId ||
      // (The glyph's own resolved color is its button's paint, not an authored one: the sheet's
      // `color: inherit` wins over it.)
      (!glyphItem &&
        (!catalogItemLabels(item, get, this.typeOf).some(
          (label) => label.id === record.id,
        ) ||
          catalogAuthoredVisual(this, record).color !== undefined))
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
      // The item color in this root's color mode (its tokens differ in dark).
      theme: this.colorMode,
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
      this.segmentText(record, get),
      catalogLabelSuffix(record, get, this.typeOf),
      inheritedLineHeight(record, get),
      calendarPartSize(record, get),
      this.calendarHeaderBox(record, get),
    );
    const thumb = record.hidden
      ? undefined
      : (catalogSliderThumbLayout(record, get, this.typeOf) ??
        catalogSliderFillLayout(record, get, this.typeOf) ??
        catalogProgressFillLayout(record, get, this.typeOf));
    const chevron = record.hidden
      ? undefined
      : (catalogTreeChevronLayout(record, get, this.typeOf) ??
        catalogTreeItemLayout(record, get, this.typeOf));
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
      ...chevron,
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
   * Whether the layout sized this text leaf to its one-line max-content (measured, width-driven,
   * not re-wrapped): its box is the exact fractional advance, so a paint that wraps at the box
   * width would break a line CSS keeps. A rule-backed leaf's painter reads this.
   */
  /**
   * A DropZone's composed content at its laid-out content box (`dropZoneContent.ts`), for the
   * Canvas paint; undefined without a text measure or for any other record.
   */
  dropZoneContent(id: string, borderBoxWidth: number) {
    const record = this.records.get(id);
    if (!record || !this.textMeasure) return undefined;
    return catalogDropZoneContent(
      record,
      this.textMeasure,
      this.dropZoneContentWidth(record, borderBoxWidth),
    );
  }
  /**
   * A DateInput's RAC segments for the Canvas paint — the runs the layout measured, from the node's
   * content-box left — and the owner's empty-segment paint (`[data-placeholder]`, CSS values as
   * written). Undefined without a text measure or for any other record.
   */
  dateSegmentPaint(id: string):
    | {
        runs: readonly CatalogDateSegmentRun[];
        placeholder: { color?: string; opacity?: number; fontStyle?: string };
      }
    | undefined {
    const record = this.records.get(id);
    if (!record || !this.textMeasure) return undefined;
    const segmentText = this.segmentText(record);
    if (!segmentText || !(Number(record.visual.fontSize) > 0)) return undefined;
    const { runs } = segmentRuns(
      segmentText,
      this.textMeasure,
      segmentFont(record, segmentText),
    );
    const box = catalogBoxModel(record);
    const num = (value: CatalogLength | undefined) =>
      typeof value === "number" ? value : 0;
    const left = num(box.padding?.left) + num(box.borderWidth);
    return {
      runs: runs.map((run) => ({ ...run, x: run.x + left })),
      placeholder: segmentText.ownerType
        ? catalogDateSegmentPlaceholderPaint()
        : {},
    };
  }
  private dropZoneContentWidth(
    record: CatalogConsumerNode,
    borderBoxWidth: number,
  ): number {
    const box = catalogBoxModel(record);
    const num = (value: CatalogLength | undefined) =>
      typeof value === "number" ? value : 0;
    return (
      borderBoxWidth -
      num(box.padding?.left) -
      num(box.padding?.right) -
      2 * num(box.borderWidth)
    );
  }
  textKeptOnOneLine(id: string): boolean {
    const record = this.records.get(id);
    if (!this.textMeasure || !record || this.wrapHeights.has(id)) return false;
    if (heightOnlyTextTypes.has(this.typeOf(record))) return false;
    return (
      textLeaf(
        record,
        this.typeOf(record),
        "",
        inheritedLineHeight(record, (key) => this.records.get(key)),
      ) !== undefined
    );
  }
  /**
   * A DateInput's DOM content is its RAC date segments (`racDateSegmentParts` in the rendering
   * locale, padded by the owning field's `.react-aria-DateSegment` delegation, past the field's
   * control Group): the typed node has no text of its own. A DateRangePicker's one typed
   * DateInput is the product's start/end pair around its `–` span, spaced by the trigger gap.
   */
  private segmentText(
    record: CatalogConsumerNode,
    // The records being assembled (an insert's new owner is not committed yet).
    get: (id: string) => CatalogConsumerNode | undefined = (id) =>
      this.records.get(id),
  ): CatalogDateSegments | undefined {
    if (record.bindingId !== "dateinput") return undefined;
    const wrapper = get(record.parentId);
    let owner = wrapper;
    while (owner && this.typeOf(owner) === "Group") {
      const parent = get(owner.parentId);
      if (
        !isFieldControlGroup("Group", parent ? this.typeOf(parent) : undefined)
      )
        break;
      owner = parent;
    }
    const ownerType = owner ? this.typeOf(owner) : undefined;
    // RAC-owned segments inherit the line height of their nearest declaring ancestor (CSS
    // inheritance of the unitless ratio).
    let lineHeight: number | undefined;
    for (
      let cursor: CatalogConsumerNode | undefined = record;
      cursor && lineHeight === undefined;
      cursor = get(cursor.parentId)
    )
      if (Number(cursor.visual.lineHeight) > 0)
        lineHeight = Number(cursor.visual.lineHeight);
    const prop = (key: string) => record.props[key] ?? owner?.props[key];
    const granularity = prop("granularity");
    const hourCycle = racFieldHourCycle(ownerType, prop("hourCycle"));
    const parts = racDateSegmentParts({
      // The field's locale and calendar system (`-u-ca-`), else the environment's locale.
      locale: ((own, system) => (system ? `${own}-u-ca-${system}` : own))(
        typeof prop("locale") === "string" && prop("locale")
          ? String(prop("locale"))
          : (this.locale ?? globalThis.navigator?.language ?? "en-US"),
        typeof prop("calendarSystem") === "string"
          ? String(prop("calendarSystem"))
          : "",
      ),
      granularity:
        typeof granularity === "string"
          ? granularity
          : ownerType === "TimeField"
            ? "minute"
            : undefined,
      hourCycle,
      // A TimeField formats the time fields only (RAC `useTimeFieldState`).
      ...(ownerType === "TimeField" ? { maxGranularity: "hour" as const } : {}),
    });
    const placeholderFontStyle = ownerType
      ? catalogDateSegmentPlaceholderPaint().fontStyle
      : undefined;
    return {
      ...(ownerType ? { ownerType } : {}),
      ...(placeholderFontStyle ? { placeholderFontStyle } : {}),
      parts,
      paddingX: ownerType ? catalogDateSegmentPaddingX() : 0,
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
      // A DropZone's composed texts break at its content box (the column's stacked height).
      if (record.bindingId === "dropzone") {
        const content = catalogDropZoneContent(record, this.textMeasure);
        let next: number | undefined;
        if (content) {
          const rect = this.layout.getLayoutsForIds([id]).get(id);
          if (!rect) continue;
          const width = this.dropZoneContentWidth(record, rect.width);
          next =
            width > 0 && width + 0.5 < content.width
              ? catalogDropZoneContent(record, this.textMeasure, width)!.height
              : undefined;
        }
        if (next === this.wrapHeights.get(id)) continue;
        this.keep(this.wrapHeights, id);
        if (next === undefined) this.wrapHeights.delete(id);
        else this.wrapHeights.set(id, next);
        this.layout.updateNodeStyle(id, this.styleFor(record));
        changed = true;
        continue;
      }
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
      // A leaf that no longer wraps (now single-line, emptied …) drops its old wrapped height.
      let next: number | undefined;
      if (
        leaf?.text &&
        (heading ||
          !(
            noWrapTextBindings.has(record.bindingId ?? "") ||
            ("singleLine" in leaf && leaf.singleLine) ||
            heightOnlyTextTypes.has(this.typeOf(record))
          ))
      ) {
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
        // min-content width (the longest word), so a lone overflowing word stays one line — unless
        // the text may break inside a word (`catalogTextBreaksWords`).
        const breakWidth =
          !heading && catalogTextBreaksWords(leaf.font as CatalogTextFont)
            ? contentWidth
            : Math.max(contentWidth, single.minWidth ?? 0);
        next =
          (heading ? rect.width > 0 : contentWidth > 0) &&
          breakWidth + 0.5 < (single.exactWidth ?? single.width)
            ? this.textMeasure(leaf.text, leaf.font, breakWidth).height
            : undefined;
      }
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
  /**
   * Text leaves whose width an edit of `ids` can change: each record's subtree, and its parent's
   * subtree when siblings can change their width. With `parentRects` (the parents' rects before
   * this layout pass) a parent keeps its siblings out when its rect is unchanged and the edited
   * box cannot move them: an absolutely placed box is out of flow, and in block flow a block-level
   * box's width comes from the container's content width alone (the Canvas geometry region's
   * rule, `canvasBinding`). Otherwise — a flex/grid parent, an inline-level box, a parent that
   * resized or was not laid out before — the whole parent subtree is re-checked.
   */
  private rewrapScope(
    ids: Iterable<string>,
    parentRects?: ReadonlyMap<string, LayoutResult>,
  ): Set<string> {
    const scope = new Set<string>();
    const visit = (id: string) => {
      if (scope.has(id)) return;
      scope.add(id);
      for (const child of this.records.get(id)?.children ?? []) visit(child);
    };
    const list = [...ids];
    const parentsAfter = parentRects
      ? this.layout.getLayoutsForIds(
          list.flatMap((id) => {
            const parentId = this.records.get(id)?.parentId;
            return parentId && parentRects.has(parentId) ? [parentId] : [];
          }),
        )
      : undefined;
    for (const id of list) {
      const record = this.records.get(id);
      const parentId = record?.parentId;
      const parent = parentId ? this.records.get(parentId) : undefined;
      if (!record || !parent) {
        visit(id);
        continue;
      }
      const before = parentRects?.get(parentId!);
      const after = parentsAfter?.get(parentId!);
      const parentFixed =
        !!before &&
        !!after &&
        before.width === after.width &&
        before.height === after.height;
      const box = catalogBoxModel(record);
      const siblingsFixed =
        parentFixed &&
        (!!box.position ||
          (catalogBoxModel(parent).display === "block" &&
            !box.display.startsWith("inline")));
      visit(siblingsFixed ? id : parentId!);
    }
    return scope;
  }
  /** Rects of the parents of `ids` from the last layout pass (before the next one runs). */
  private parentRectsOf(ids: readonly string[]): Map<string, LayoutResult> {
    return this.layout.getLayoutsForIds(
      new Set(
        ids.flatMap((id) => {
          const parentId = this.records.get(id)?.parentId;
          return parentId && this.records.has(parentId) ? [parentId] : [];
        }),
      ),
    );
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
      ...domAttributes(top, target),
      slot: top.slot ?? target.slot,
      name: top.name ?? target.name,
      regions: top.regions ?? target.regions,
      placeholder: top.placeholder ?? target.placeholder,
      ...(target.displayState ? { displayState: target.displayState } : {}),
      ...((top.presentWhen ?? target.presentWhen)
        ? { presentWhen: top.presentWhen ?? target.presentWhen }
        : {}),
      ...((top.showWhen ?? target.showWhen)
        ? { showWhen: top.showWhen ?? target.showWhen }
        : {}),
      ...(target.stateVisual ? { stateVisual: target.stateVisual } : {}),
      ...(top.rowIndex !== undefined ? { rowIndex: top.rowIndex } : {}),
      ...((target.rowCount ?? top.rowCount) !== undefined
        ? { rowCount: target.rowCount ?? top.rowCount }
        : {}),
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
        this.childOrder(record),
      );
      indexes.set(id, batch.length);
      const frame = this.pageFrameStyle(record);
      if (frame) this.appliedFrames.set(id, frame);
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
    // The definition view: its one frame at its own size (no page grid track stretches it).
    if (this.definitionView)
      return { display: "flex", alignItems: "flex-start" };
    if (!this.pageFrames)
      return {
        display: "flex",
        width: `${this.viewport.width}px`,
        height: `${this.viewport.height}px`,
      };
    return buildContainerStyle(this.pageLayout());
  }
  /** The page container grid at this breakpoint (its tracks, gap and columns: the page drag's cells). */
  pageLayout(): ReturnType<typeof resolvePageLayout> {
    const project = this.runtime.graph.getEntry(this.runtime.graph.projectId);
    const layout = project?.kind === "project" ? project.pageLayout : undefined;
    return resolvePageLayout(
      catalogPageLayoutSettings(layout),
      this.breakpoint,
      this.autoColumns,
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
    if (this.definitionView) {
      // A layout is drawn at the page size it frames; a component at its own size.
      const definition = this.runtime.graph.getEntry(this.definitionView);
      if (definition?.kind !== "definition" || definition.usage !== "layout")
        return undefined;
      const tier = CANVAS_VIEWPORT[this.breakpoint];
      return {
        ...(record.sizing.width == null && record.visual.width == null
          ? { width: `${tier.width}px` }
          : {}),
        ...(record.sizing.height == null && record.visual.height == null
          ? { height: `${tier.height}px` }
          : {}),
      };
    }
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
  /**
   * Live reflow (ADR-248 Phase 4e — the old resize / spacing presentation sessions): show `patch`
   * on one record and lay out (re-wrap included) as if it were committed, while the document,
   * history, save and DOM consumers do not change — only the record's Canvas listeners hear it
   * and patch like an edit. No `patch` puts the record's own values back; the gesture then
   * commits the same values as one command. A step that replaced the record meanwhile wins (its
   * record is kept). Returns the subscriber errors.
   */
  previewRecord(id: string, patch?: CatalogRecordPreview): unknown[] {
    const held = this.previews.get(id);
    const current = this.records.get(id);
    const ours = !!held && current === held.shown;
    if (held && !ours) this.previews.delete(id);
    if (!current || (!patch && !ours)) return [];
    const base = ours ? held!.base : current;
    const shown: CatalogConsumerNode = patch
      ? {
          ...base,
          visual:
            patch.visual || patch.omitVisual
              ? Object.fromEntries(
                  Object.entries({ ...base.visual, ...patch.visual }).filter(
                    ([key]) => !patch.omitVisual?.includes(key),
                  ),
                )
              : base.visual,
          sizing: patch.sizing
            ? { ...base.sizing, ...patch.sizing }
            : base.sizing,
          layout: patch.layout
            ? { ...base.layout, ...patch.layout }
            : base.layout,
          placement: patch.placement ?? base.placement,
          ...(patch.fills ? { fills: patch.fills } : {}),
        }
      : base;
    if (patch) this.previews.set(id, { base, shown });
    else this.previews.delete(id);
    this.records.set(id, shown);
    this.layout.updateNodeStyle(id, this.styleFor(shown));
    this.layout.computeLayout(this.viewport.width, this.viewport.height);
    this.rewrap(this.rewrapScope([id]));
    const errors: unknown[] = [];
    for (const callback of [...(this.canvasListeners.get(id) ?? [])]) {
      try {
        callback(shown);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const listener of [...this.previewListeners]) {
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }
  /** Hear every `previewRecord` (a preview from any surface: a Canvas gesture, a Styles drag). */
  subscribePreviews(listener: () => void): () => void {
    this.previewListeners.add(listener);
    return () => this.previewListeners.delete(listener);
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
      // The definition view's one frame is keyed by the definition.
      const frameId = pageId ?? this.definitionView;
      if (frameId && rect) rects.set(frameId, rect);
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
    const frame = this.pageFrameStyle(record);
    const frameChanged =
      !!frame && !sameFields(this.appliedFrames.get(id) ?? {}, frame);
    return {
      id,
      record,
      rootId,
      style,
      frame,
      styleChanged:
        !old || frameChanged || !sameFields(this.styleFor(old), style),
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
        this.removeSourceInstance(sourceId, id);
        if (
          ![...(this.sourceInstances.get(sourceId) ?? [])].some(
            (recordId) => this.recordRoots.get(recordId) === rootId,
          )
        )
          roots?.delete(rootId);
        if (roots?.size === 0) this.sourceRoots.delete(sourceId);
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
    const frameMoved =
      !!old &&
      !!plan.frame &&
      !sameFields(this.appliedFrames.get(id) ?? {}, plan.frame);
    this.keep(this.appliedFrames, id);
    if (plan.frame) this.appliedFrames.set(id, plan.frame);
    else this.appliedFrames.delete(id);
    if (chrome) {
      this.slotChrome.set(id, chrome);
      const entries = slotChromeLayoutNodes(chrome);
      const previous = oldChrome ? slotChromeLayoutNodes(oldChrome) : [];
      for (const entry of entries) {
        const before = previous.find((node) => node.id === entry.id);
        if (!before) this.layout.addNode(entry.id, entry.style);
        else if (!sameFields(before.style, entry.style))
          this.layout.updateNodeStyle(entry.id, entry.style);
        if (!before || !sameList(before.children, entry.children))
          this.layout.updateChildren(entry.id, [...entry.children]);
      }
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
    // CSS `order`: sorted once every record of the apply is in place (a child's order can change
    // before or after its parent's record).
    if (this.childOrder(record) || (old && this.childOrder(old)))
      this.orderDirty.add(id);
    if ((old?.layout.order ?? "") !== (record.layout.order ?? ""))
      this.orderDirty.add(record.parentId);
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
    // (A box whose engine style changed with an unchanged record — a Slider fill · thumb, a
    // ProgressBar fill whose width is its owner's value — is noticed too: the Canvas compares its
    // rect, which a parent of the same size would not reach — ADR-256 후속 12 live.)
    if (!old || frameMoved || plan.styleChanged || !sameRecord(old, record))
      notices.push({ id, record });
  }

  private applyRemoval(id: string, rootId: NodeId, notices: Notice[]): void {
    const old = this.records.get(id);
    this.keep(this.records, id);
    this.keep(this.recordRoots, id);
    this.keep(this.slotChrome, id);
    this.keep(this.composedParts, id);
    this.keep(this.appliedFrames, id);
    this.appliedFrames.delete(id);
    this.layoutTouched = true;
    if (old) {
      for (const sourceId of recordSources(old)) {
        this.keep(this.sourceRoots, sourceId);
        const roots = this.sourceRoots.get(sourceId);
        this.removeSourceInstance(sourceId, id);
        if (
          ![...(this.sourceInstances.get(sourceId) ?? [])].some(
            (recordId) => this.recordRoots.get(recordId) === rootId,
          )
        )
          roots?.delete(rootId);
        if (roots?.size === 0) this.sourceRoots.delete(sourceId);
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

  /**
   * Template records that read a changed instance prop through a template binding: an instance
   * whose composite definition accepts the changed key binds it into its template (`{label}`), so
   * its template descendants re-resolve with it. Other prop changes keep the fast path.
   */
  /**
   * Records that draw a definition whose project override changed (ADR-253). The step's
   * invalidated ids name the nodes placed as its instances; an instance inside another
   * definition's template is a template position, which no graph index lists — so every record
   * whose own definition, or the definition of a layer it collapses, is the override's target.
   */
  private overrideDependents(result: CatalogTransactionResult): string[] {
    const graph = this.runtime.graph;
    const targets = new Set<string>();
    for (const op of result.forward) {
      const entry =
        op.kind === "patchDefinitionOverride"
          ? graph.getEntry(op.id)
          : op.kind === "put"
            ? op.entry
            : undefined;
      if (entry?.kind === "definitionOverride") targets.add(entry.targetId);
    }
    if (!targets.size) return [];
    const definitionOf = (sourceId: string): string | undefined => {
      if (sourceId.startsWith("lib:"))
        return graph.library.templates.get(sourceId as `lib:template:${string}`)
          ?.definitionId;
      const entry = graph.getEntry(sourceId);
      return entry?.kind === "node" ? entry.definitionId : undefined;
    };
    const dependents: string[] = [];
    for (const record of this.records.values())
      if (
        targets.has(record.definitionId) ||
        recordSources(record).some((sourceId) => {
          const definitionId = definitionOf(sourceId);
          return definitionId !== undefined && targets.has(definitionId);
        })
      )
        dependents.push(record.id);
    return dependents;
  }
  private bindingDependents(result: CatalogTransactionResult): string[] {
    const changedKeys = new Map<string, Set<string>>();
    for (const op of result.forward)
      if (op.kind === "patchNodeProp") {
        let keys = changedKeys.get(op.id);
        if (!keys) changedKeys.set(op.id, (keys = new Set()));
        keys.add(op.key);
      }
    const dependents: string[] = [];
    for (const [nodeId, keys] of changedKeys) {
      const node = this.runtime.graph.getEntry(nodeId);
      if (node?.kind !== "node") continue;
      const definition = this.runtime.graph.getDefinition(node.definitionId);
      if (definition?.mode !== "composite") continue;
      if (![...keys].some((key) => Object.hasOwn(definition.accepts, key)))
        continue;
      for (const recordId of this.sourceInstances.get(nodeId) ?? []) {
        const stack = [...(this.records.get(recordId)?.children ?? [])];
        while (stack.length) {
          const record = this.records.get(stack.pop()!);
          if (
            !record ||
            !(record.instancePath as readonly string[]).includes(nodeId)
          )
            continue;
          dependents.push(record.id);
          stack.push(...record.children);
        }
      }
    }
    return dependents;
  }

  private planInstances(
    sourceIds: ReadonlySet<string>,
    extraRecords: readonly string[] = [],
    ownedStructure = false,
  ): {
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
    for (const id of extraRecords) if (!queue.includes(id)) queue.push(id);
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
        this.colorMode,
        this.rows,
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
        className: _className,
        ariaLabel: _ariaLabel,
        templateProps: _templateProps,
        stateVisual: _stateVisual,
        // (ADR-256 Decision 12 — the bindings are read again from the new written values below.)
        valueTemplate: _valueTemplate,
        // (An authored prop can end the display state — `resolveCatalogNode`, 2026-10-09.)
        displayState: _displayState,
        ...kept
      } = before;
      const resolvedRecord: CatalogConsumerNode = {
        ...kept,
        ...(ownedStructure
          ? {
              children: (() => {
                const entry = this.runtime.graph.getEntry(before.sourceId);
                if (entry?.kind !== "node") return before.children;
                return entry.children.map(
                  (child) =>
                    `${[...before.instancePath, child].join("/")}::${child}`,
                );
              })(),
            }
          : {}),
        props: resolved.props,
        visual: resolved.visual,
        layout: resolved.layout,
        sizing: resolved.sizing,
        placement: top.placement ?? resolved.placement,
        ...(resolved.stateVisual ? { stateVisual: resolved.stateVisual } : {}),
        ...authoredFields(resolved),
        ...domAttributes(top, resolved),
        slot: top.slot ?? resolved.slot,
        name: top.name ?? resolved.name,
        regions: top.regions ?? resolved.regions,
        placeholder: top.placeholder ?? resolved.placeholder,
        ...(resolved.displayState
          ? { displayState: resolved.displayState }
          : {}),
      };
      const record = catalogWithValues(
        this.withState(
          resolvedRecord,
          (key) => this.records.get(key),
          this.rootPage.get(rootId),
        ),
        (key) => this.records.get(key),
        this.typeOf,
        this.locale,
      );
      // A parent prop change reaches the direct children its partRules target.
      for (const childId of this.partRuleChildren(before, record))
        if (!queued.has(childId)) {
          queued.add(childId);
          queue.push(childId);
        }
      // An owner's size reaches the children it propagates to (`CATALOG_SIZE_PROPAGATION`): they
      // resolve again with it (and their own children after them).
      if (before.props.size !== record.props.size) {
        const sized = CATALOG_SIZE_PROPAGATION[this.typeOf(record)];
        // (Through the Group · frame between, which take no size — `CATALOG_SIZE_PASS_THROUGH`:
        // a field's control Group, a Group around a group's item.)
        const through = (ids: readonly string[]): string[] =>
          ids.flatMap((childId) => {
            const child = this.records.get(childId);
            return child && CATALOG_SIZE_PASS_THROUGH.has(this.typeOf(child))
              ? through(child.children)
              : [childId];
          });
        const reached = sized ? through(record.children) : [];
        // (A toggle group's size reaches every toggle of its own — inside another item too.)
        const itemType = Object.keys(CATALOG_TOGGLE_GROUP_OF).find(
          (item) => CATALOG_TOGGLE_GROUP_OF[item] === this.typeOf(record),
        );
        if (itemType)
          for (const item of catalogToggleGroupItems(
            record,
            itemType,
            (key) => this.records.get(key),
            this.typeOf,
          ).items)
            if (!reached.includes(item.id)) reached.push(item.id);
        for (const childId of reached) {
          const child = this.records.get(childId);
          if (
            child &&
            (sized?.includes(this.typeOf(child)) ||
              CATALOG_TOGGLE_GROUP_OF[this.typeOf(child)] ===
                this.typeOf(record)) &&
            !queued.has(childId)
          ) {
            queued.add(childId);
            queue.push(childId);
          }
        }
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
    const presence = new Map<string, CatalogConsumerNode>();
    for (const ownerId of owners)
      for (const panel of catalogPresenceDependents(
        get(ownerId)!,
        get,
        this.typeOf,
      ))
        presence.set(panel.id, panel);
    // A value-conditioned part (ADR-256 Decision 7) follows its own final text; a state-conditioned
    // one (`showWhen`) its own condition and its state owners' values.
    for (const update of updates) {
      if (update.record.presentWhen || update.record.showWhen)
        presence.set(update.id, update.record);
      for (const dependent of catalogStateDependents(
        update.record,
        get,
        this.typeOf,
      ))
        presence.set(dependent.id, dependent);
    }
    for (const panel of presence.values()) {
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
      // (The re-plans below read the shown record.)
      planned.set(panel.id, next);
      roots.add(rootId);
    }
    // Slider thumbs follow the Slider's value, field Labels the necessity inputs (their layout
    // reads them): re-plan them against the planned records.
    for (const update of [...updates])
      for (const thumb of [
        ...catalogSliderThumbs(update.record, get, this.typeOf),
        // A TreeItem's chevron button is indented by the item's level.
        ...catalogTreeChevrons(update.record, get, this.typeOf),
        ...catalogLabelSuffixDependents(update.record, get, this.typeOf),
        ...catalogBreadcrumbItems(update.record, get, this.typeOf),
        // An icon slot child's presence decides its ListBox item's inset.
        ...(update.record.props.slot === "icon" && get(update.record.parentId)
          ? [get(update.record.parentId)!]
          : []),
        ...catalogDerivedPropsDependents(update.record, get, this.typeOf),
        // ADR-256 Decision 12: a part bound to the owner's value (`{valueText}` · `{percentage}%`).
        ...catalogValueDependents(update.record, get, this.typeOf),
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
        const valued = catalogWithValues(
          get(thumb.id)!,
          get,
          this.typeOf,
          this.locale,
        );
        // (A value-conditioned part follows the final text its owner's value gives it — Decision 7.)
        const current =
          valued.presentWhen === undefined
            ? valued
            : withHidden(valued, get, this.typeOf);
        const derivedProps = this.derivedOf(current, get);
        const inheritedText = inheritedTextOf(current, get);
        const fillLayout =
          catalogFillLayout(current, get, this.typeOf) ??
          catalogSelectionIndicatorLayout({ ...current, derivedProps });
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
  /**
   * A value edit a bound Table's projected rows read (`projectTableRows`): the Table's own props
   * (height mode · height decide how many rows show) or a node it owns (a header Column's key
   * decides each cell). Those take the structure path — the row records come and go. So does a
   * bound node's own height (a bound list samples its rows only while it grows with them).
   */
  private touchesTableRows(result: CatalogTransactionResult): boolean {
    const graph = this.runtime.graph;
    const boundTable = (id: string | undefined): boolean => {
      const entry = id ? graph.getEntry(id) : undefined;
      if (entry?.kind !== "node" || !entry.binding) return false;
      try {
        return definitionTypeName(graph, entry.definitionId) === "Table";
      } catch {
        return false;
      }
    };
    for (const id of result.changedIds)
      if (boundTable(id) || boundTable(graph.ownerOf(id))) return true;
    // A bound list's own height decides whether it samples its rows (`rowCount`).
    const HEIGHT_KEYS = new Set(["height", "maxHeight"]);
    for (const op of result.forward)
      if (
        (op.kind === "patchNodeVisual" || op.kind === "patchNodeSizing") &&
        HEIGHT_KEYS.has(op.key)
      ) {
        const entry = graph.getEntry(op.id);
        if (entry?.kind === "node" && entry.binding) return true;
      }
    return false;
  }

  /** Physical layout inputs, including synthetic parts: a paint flag never hides a box change. */
  private layoutPlanChanged(plan: RecordPlan): boolean {
    const beforeParts = this.composedParts.get(plan.id) ?? [];
    const beforeChrome = this.slotChrome.get(plan.id);
    const oldChromeNodes = beforeChrome
      ? slotChromeLayoutNodes(beforeChrome)
      : [];
    const newChromeNodes = plan.chrome
      ? slotChromeLayoutNodes(plan.chrome)
      : [];
    return (
      plan.styleChanged ||
      oldChromeNodes.length !== newChromeNodes.length ||
      oldChromeNodes.some((node, index) => {
        const next = newChromeNodes[index];
        return (
          node.id !== next.id ||
          !sameFields(node.style, next.style) ||
          !sameList(node.children, next.children)
        );
      }) ||
      beforeParts.length !== plan.parts.length ||
      beforeParts.some((part, index) => {
        const next = plan.parts[index];
        return (
          part.id !== next.id ||
          !sameFields(part.style, next.style) ||
          !sameList(part.wraps ?? [], next.wraps ?? [])
        );
      })
    );
  }

  /**
   * Reorder/deletion of ordinary owned children changes the parent's list, not the surviving
   * siblings' resolution. Composite/template/row projections and reparenting need the general
   * structural resolver, since their identities or inherited context can change.
   */
  private planOwnedRemovalOrOrder(
    result: CatalogTransactionResult,
  ): ConsumePlan | undefined {
    if (!result.impact.structural || this.definitionView) return undefined;
    const sources = new Set<string>();
    for (const op of result.forward) {
      if (op.kind === "remove") {
        if (
          !result.inverse.some(
            (inverse) =>
              inverse.kind === "put" &&
              inverse.entry.id === op.id &&
              inverse.entry.kind === "node",
          )
        )
          return undefined;
        continue;
      }
      if (op.kind !== "put" || op.entry.kind !== "node") return undefined;
      const previous = result.inverse.find(
        (inverse) => inverse.kind === "put" && inverse.entry.id === op.entry.id,
      );
      if (previous?.kind !== "put" || previous.entry.kind !== "node")
        return undefined;
      const { children: _beforeChildren, ...before } = previous.entry;
      const { children: _afterChildren, ...after } = op.entry;
      if (JSON.stringify(before) !== JSON.stringify(after)) return undefined;
      for (const id of this.sourceInstances.get(op.entry.id) ?? []) {
        const record = this.records.get(id)!;
        if (
          record.definitionMode === "composite" ||
          !["box", "frame", "body", "group", "container"].includes(
            record.bindingId ?? "",
          ) ||
          record.collapsedIds?.length ||
          record.id.includes(CATALOG_ROW_SEPARATOR) ||
          previous.entry.binding ||
          previous.entry.descendantOverrides.length
        )
          return undefined;
        for (const child of op.entry.children) {
          const childId = `${[...record.instancePath, child].join("/")}::${child}`;
          if (this.records.get(childId)?.parentId !== id) return undefined;
        }
      }
      sources.add(op.entry.id);
    }
    if (!sources.size) return undefined;
    const planned = this.planInstances(sources, [], true);
    const byRoot = new Map<
      NodeId,
      { rootId: NodeId; updates: RecordPlan[]; removed: string[] }
    >();
    const rootPlan = (rootId: NodeId) => {
      let value = byRoot.get(rootId);
      if (!value)
        byRoot.set(rootId, (value = { rootId, updates: [], removed: [] }));
      return value;
    };
    for (const update of planned.updates)
      rootPlan(update.rootId).updates.push(update);
    // A removed record goes with the records under it — an instance's include its origin template's,
    // which are not document entries in `removedIds` (left behind, they stayed in the Canvas and DOM
    // inputs, and an item an author had put a node into pointed at the removed node).
    const removed = new Set<string>();
    const remove = (id: string) => {
      const record = this.records.get(id);
      if (!record || removed.has(id)) return;
      removed.add(id);
      rootPlan(this.recordRoots.get(id)!).removed.push(id);
      for (const child of record.children) remove(child);
    };
    for (const sourceId of result.removedIds)
      for (const id of this.sourceInstances.get(sourceId) ?? []) remove(id);
    return {
      result,
      roots: [...byRoot.values()],
      computeLayout: true,
      metrics: {
        revision: result.revision,
        changedIds: [...result.changedIds],
        removedIds: [...result.removedIds],
        affectedRootIds: [...byRoot.keys()],
        layoutInputVisits: planned.updates.length,
        resolverVisits: planned.resolverVisits,
        resolverIncludeChecks: planned.includeChecks,
        affectedInstanceCount: planned.updates.length,
        traversedWholeInputGraph: false,
      },
    };
  }

  private plan({ result, invalidatedIds }: CatalogStepContext): ConsumePlan {
    const ownedStructure = this.planOwnedRemovalOrOrder(result);
    if (ownedStructure) return ownedStructure;
    const valueOnly = result.forward.every(
      (op) =>
        // Per-breakpoint display decides which records exist (a presence change).
        (op.kind === "setNodeField" && op.field !== "visibility") ||
        [
          "patchNodeProp",
          "patchNodeVisual",
          "patchNodeSizing",
          "patchNodeLayout",
          "setNodePlacement",
          "patchDefinitionOverride",
        ].includes(op.kind) ||
        (op.kind === "put" &&
          (op.entry.kind === "token" ||
            op.entry.kind === "definitionOverride")),
    );
    // The Components page redraws its root on every step (below).
    if (
      valueOnly &&
      !isComponentsView(this.definitionView) &&
      !this.touchesTableRows(result)
    ) {
      const indirect = result.forward.some(
        (op) =>
          op.kind === "patchDefinitionOverride" ||
          (op.kind === "put" &&
            (op.entry.kind === "token" ||
              op.entry.kind === "definitionOverride")),
      );
      const sources = new Set(indirect ? invalidatedIds : result.changedIds);
      const planned = this.planInstances(sources, [
        ...this.bindingDependents(result),
        ...this.overrideDependents(result),
      ]);
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
        // A transaction's paint-only flag can skip compute, but actual derived box changes
        // still win (presence, owner-composed parts and catalog rules can affect layout).
        computeLayout:
          planned.roots.size > 0 &&
          (result.impact.layout ||
            planned.updates.some((update) => this.layoutPlanChanged(update))),
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
    const structureChanged =
      [...result.changedIds, ...result.removedIds].some(
        (id) => {
          const entry = this.runtime.graph.getEntry(id);
          return (
            entry?.kind === "page" ||
            entry?.kind === "project" ||
            id === this.definitionView
          );
        },
        // The Components page's samples follow the project overrides: redraw its root.
      ) || isComponentsView(this.definitionView);
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
    // A variable added, renamed, retyped or removed: every `{{ }}` reads by name.
    if (
      [...result.changedIds, ...result.removedIds].some((id) =>
        id.startsWith("project:stateVariable:"),
      )
    )
      for (const id of this.stateReaders()) {
        const root = this.recordRoots.get(id);
        if (root && currentRoots.has(root)) affectedRoots.add(root);
      }
    let visits = 0;
    let resolverVisits = 0;
    const roots: ConsumePlan["roots"][number][] = [];
    for (const rootId of affectedRoots) {
      const previous = this.rootMembers.get(rootId) ?? new Set<string>();
      // A node structure edit stays within its affected parents' subtrees. Definitions,
      // variables, row projections and page/root changes keep their wider resolver scope.
      const nodeStructure =
        !structureChanged &&
        result.impact.structural &&
        [...result.changedIds].every(
          (id) => this.runtime.graph.getEntry(id)?.kind === "node",
        ) &&
        result.forward.every(
          (op) => op.kind === "put" || op.kind === "remove",
        ) &&
        [...result.removedIds].every((id) =>
          result.inverse.some(
            (op) =>
              op.kind === "put" &&
              op.entry.id === id &&
              op.entry.kind === "node",
          ),
        );
      const candidates = new Set<string>();
      if (nodeStructure)
        for (const sourceId of result.impact.affectedParents)
          for (const id of this.sourceInstances.get(sourceId) ?? [])
            if (this.recordRoots.get(id) === rootId) candidates.add(id);
      const regions = [...candidates].filter((id) => {
        for (
          let parent = this.records.get(id)?.parentId;
          parent;
          parent = this.records.get(parent)?.parentId
        )
          if (candidates.has(parent)) return false;
        return true;
      });
      if (regions.length) {
        const before = new Set<string>();
        const next = new Map<string, CatalogConsumerNode>();
        const collect = (id: string) => {
          before.add(id);
          for (const child of this.records.get(id)?.children ?? [])
            collect(child);
        };
        for (const id of regions) {
          collect(id);
          for (const [key, record] of this.flatten(
            rootId,
            id,
            () => resolverVisits++,
          ))
            next.set(key, record);
        }
        const updates = [...next]
          .filter(([id, record]) => {
            const old = this.records.get(id);
            return !old || !sameRecord(old, record);
          })
          .map(([id, record]) =>
            this.planRecord(
              id,
              record,
              rootId,
              (key) => next.get(key) ?? this.records.get(key),
            ),
          );
        visits += updates.length;
        roots.push({
          rootId,
          removed: [...before].filter((id) => !next.has(id)),
          updates,
        });
        continue;
      }
      const next = currentRoots.has(rootId)
        ? this.flatten(rootId)
        : new Map<string, CatalogConsumerNode>();
      visits += next.size;
      resolverVisits += next.size;
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
            this.colorMode,
            this.rows,
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
        resolverVisits,
        resolverIncludeChecks: 0,
        affectedInstanceCount: visits,
        traversedWholeInputGraph:
          this.records.size > 0 &&
          (visits >= this.records.size || resolverVisits >= this.records.size),
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
      } else {
        const current = this.rootMembers.get(rootId);
        if (current) {
          for (const id of removed) {
            const had = current.delete(id);
            if (had) this.undoLog?.push(() => current.add(id));
          }
          for (const { id } of updates) {
            if (current.has(id)) continue;
            current.add(id);
            this.undoLog?.push(() => current.delete(id));
          }
        }
      }
    }
    this.applyOrders();
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
      const updated = plan.roots.flatMap(({ updates }) =>
        updates.map((update) => update.id),
      );
      const parentRects = this.parentRectsOf(updated);
      this.layoutTouched = true;
      this.layout.computeLayout(this.viewport.width, this.viewport.height);
      this.rewrap(this.rewrapScope(updated, parentRects));
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
