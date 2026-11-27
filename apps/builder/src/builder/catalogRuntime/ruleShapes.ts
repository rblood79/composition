import { COMPONENT_RULES_TABLE } from "../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import {
  catalogResizableGripGlyph,
  catalogResizableGripRect,
  catalogResizablePillRect,
  RESIZABLE_GRIP,
  RESIZABLE_PILL,
} from "../../../../../packages/shared/src/catalog/document/resizableChrome";
import { CATALOG_FIELD_ERROR_ICON } from "../../../../../packages/shared/src/catalog/runtime/fieldPrefix";
import {
  catalogStepChromeColors,
  catalogStepChromeRects,
  catalogStepGlyph,
  catalogStepSize,
  STEP_CHECK_ICON,
  STEP_CHECK_STROKE,
  STEP_GLYPH_SIZE,
  STEP_GLYPH_WEIGHT,
  STEP_TYPE,
  STEP_VISUAL_BORDER,
  type StepState,
} from "../../../../../packages/shared/src/catalog/rule/stepList";
import { catalogStepLineHeight } from "../../../../../packages/shared/src/catalog/runtime/stepList";
import {
  catalogRatingBox,
  catalogRatingScaledStarPaths,
  catalogRatingSize,
  catalogRatingStarColor,
  catalogRatingStarFills,
  RATING_STAR_GAP,
  RATING_TYPE,
} from "../../../../../packages/shared/src/catalog/rule/rating";
import { catalogRatingStart } from "../../../../../packages/shared/src/catalog/runtime/rating";
import {
  PICKER_INVALID_ICON,
  PICKER_INVALID_WIDTH,
  pickerInvalidGlyph,
} from "../../../../../packages/shared/src/catalog/document/pickerTrigger";
import {
  buildCatalogShapes,
  chartFamilyAvailable,
  chartFamilyError,
  chartFamilyOf,
  composeCatalogShapes,
  cssVarToTokenRef,
  getChartFamily,
  getSkiaPrimitive,
  getSkiaPrimitiveMode,
  loadChartFamily,
  resolveToken,
  S2_TOAST_EDGE,
  snapBorderWidth,
  type Shape,
  type SizeSpec,
  type TokenRef,
} from "@composition/rendering";
import { getPrimitiveBinding } from "@composition/shared";
import {
  evaluateConditionTree,
  type ConditionSet,
  type ConditionalValue,
} from "../../../../../packages/shared/src/catalog/rule/conditionTree";
import {
  catalogInvalidBorderColor,
  catalogQuietStyles,
} from "../../../../../packages/shared/src/catalog/runtime/quietStyles";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import { ruleVariantToVisual } from "../workspace/canvas/skia/resolveSkiaVisualRule";
import { normalizeMiddleBaselineTextLineHeight } from "../workspace/canvas/skia/specBuildHelpers";
import { specShapesToSkia } from "../workspace/canvas/skia/specShapeConverter";
import { resolveBorderGeometry } from "../workspace/canvas/styleConversion/borderGeometry";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  catalogItemTrailingIcon,
  catalogLinkOutCardEndInset,
  catalogLinkOutGlyph,
} from "../../../../../packages/shared/src/catalog/document/itemLinks";
import { catalogInlineAlertIcon } from "../../../../../packages/shared/src/catalog/document/inlineAlertIcon";
import {
  CATALOG_TOAST_CLOSE_GLYPH_SIZE,
  CATALOG_TOAST_CLOSE_ICON,
  catalogToastIcon,
} from "../../../../../packages/shared/src/catalog/document/toastChrome";
import {
  CATALOG_DIALOG_CLOSE_GLYPH_SIZE,
  CATALOG_DIALOG_CLOSE_ICON,
  CATALOG_DIALOG_CLOSE_INSET,
} from "../../../../../packages/shared/src/catalog/document/dialogChrome";
import {
  colorIntToFloat32,
  cssColorToAlpha,
  cssColorToHex,
} from "../workspace/canvas/styleConversion/styleConverter";
import {
  catalogBoxModel,
  catalogTextTypography,
} from "../../../../../packages/shared/src/catalog/runtime/boxModel";
import { catalogTreeCellGlyph } from "../../../../../packages/shared/src/catalog/runtime/tableTreeCell";
import {
  SHEET_HANDLE,
  catalogSheetHandleRect,
} from "../../../../../packages/shared/src/catalog/document/sheetChrome";
import { catalogSideNavIndicator } from "../../../../../packages/shared/src/catalog/runtime/sideNav";
import { catalogToggleIndicatorMetrics } from "../../../../../packages/shared/src/catalog/document/rulePartRules";
import {
  CHILD_PROP_MERGE_TYPES,
  catalogRuleTextColor,
  catalogContainerOutline,
  catalogStateOutline,
  catalogToggleContentColor,
  catalogRulePaint,
  cssVarColor,
  type CatalogRuleShapeInput,
} from "./rulePaint";

/**
 * ADR-248 Canvas executor for rule-backed definitions (`LibraryDefinition.ruleId`): the node's
 * D3 rule (variant/state paint, sub-part structure) plus its resolved props and authored visual
 * writes → the catalog shape generators (`@composition/rendering`) → CanvasKit node data.
 *
 * Execution capability tables below are binding-level data (which types own their children,
 * merge child props, or need their box size); they are not visual values.
 */

/** Types whose shape generators lay out against the actual box size. */
const BOX_SIZE_TYPES: ReadonlySet<string> = new Set([
  // The avatar circle is its box (a Tag slot chip sizes it 16; `Avatar.tsx` inlines the same box).
  "Avatar",
  // (The status dot centres on the row — its text line, S2 sets no height: ADR-295 후속 B3.)
  "StatusLight",
  "Tag",
  "Breadcrumbs",
  "Tabs",
  "TabList",
  "Tab",
  "Toast",
  "ProgressBar",
  "ProgressBarTrack",
  "Meter",
  "MeterTrack",
  "TextField",
  "TextArea",
  "Input",
  "TokenInput",
  "Select",
  "Cascader",
  "ComboBox",
  "SearchField",
  "NumberField",
  "GridList",
  "Image",
  "Slider",
  "SliderTrack",
  // (S2 thumb — a circle or the precise bar, drawn at its box: 2026-11-18.)
  "SliderThumb",
  // ADR-258 Phase 2: the Color controls' gradient · ring · handle are drawn at the box.
  "ColorArea",
  "ColorWheelTrack",
  "ColorThumb",
  // (A picker's selected swatch draws S2's selection ring at its box — `color_swatch`.)
  "ColorSwatch",
  "ListBox",
  "ColorField",
  "TagList",
  "CalendarHeader",
  // The calendar's day cells follow its grid's laid-out width (2026-10-13).
  "CalendarGrid",
  "DateInput",
  "Chart",
]);

function resolveSize(
  size: Record<string, unknown>,
  theme: "light" | "dark",
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(size))
    resolved[key] =
      typeof value === "string" && /^\{[\w]+\.[^{}]+\}$/.test(value)
        ? resolveToken(value as TokenRef, theme)
        : value;
  return resolved;
}

/**
 * The primitive context of a rule-backed node at its box (`ctx` — what a primitive draws from): its
 * rule paint (`catalogRulePaint`), the variant's visual meta, the size spec and the resolved size
 * values under the authored style.
 */
function ruleShapeContext(input: CatalogRuleShapeInput) {
  const painted = catalogRulePaint(input, input.rect);
  const { style, variant, size, paint, theme } = painted;
  // Text drawn from a rule inherits the document font like any DOM box: the node's, its ancestors',
  // the locale's or the theme's. A variant's own family (Code · Kbd) stays.
  const family = catalogTextTypography(input.node).fontFamily;
  const authored = painted.props.style as Record<string, unknown> | undefined;
  const props =
    family !== undefined &&
    variant?.fontFamily === undefined &&
    authored?.fontFamily === undefined
      ? { ...painted.props, style: { ...authored, fontFamily: family } }
      : painted.props;
  // ADR-295 Phase 3c-2b: a toggle's indicator carries size-map tokens · the Switch track's font ratio
  //   — the primitive draws the px under the installed maps (`catalogToggleIndicatorMetrics`).
  const indicator =
    input.rule.structure?.archetype === "toggle-indicator"
      ? catalogToggleIndicatorMetrics(size as never)
      : undefined;
  const ctx = {
    props,
    size: (indicator ? { ...size, indicator } : size) as unknown as SizeSpec,
    visual: variant ? ruleVariantToVisual(variant) : undefined,
    paint,
    style: {
      ...resolveSize(size as Record<string, unknown>, theme),
      ...style,
      indicatorColor: catalogToggleContentColor(input),
    } as Record<string, unknown>,
    theme,
  };
  return { ctx, theme };
}

/**
 * An invalid field's box border in the rule's `&[data-invalid]` color (`catalogInvalidBorderColor`
 * — the DOM sheet's same selector over RAC's `data-invalid`). A document's explicit state border
 * still wins.
 */
function invalidBorder(input: CatalogRuleShapeInput, shapes: Shape[]): Shape[] {
  const color = catalogInvalidBorderColor(
    input.rule,
    { ...input.node.props, ...input.node.derivedProps },
    input.state,
  );
  if (!color) return shapes;
  const state = input.state ? input.node.stateVisual?.[input.state] : undefined;
  if (
    state?.borderColor !== undefined ||
    input.authoredVisual.borderColor !== undefined
  )
    return shapes;
  const backgrounds = new Set(
    shapes
      .filter(
        (shape) =>
          "presentationRole" in shape &&
          shape.presentationRole === "background-fill" &&
          "id" in shape,
      )
      .map((shape) => (shape as { id: string }).id),
  );
  const theme = input.theme ?? "light";
  return shapes.map((shape) =>
    shape.type === "border" && shape.target && backgrounds.has(shape.target)
      ? { ...shape, color: cssVarColor(color, theme) as string }
      : shape,
  );
}

/** Shapes for one rule-backed node (before conversion; exposed for shape-level checks). */
export function catalogRuleShapes(input: CatalogRuleShapeInput): Shape[] {
  const base = ruleShapes(input);
  const shapes = [
    ...base,
    ...linkOutShapes(input),
    ...inlineAlertIconShapes(input),
    ...catalogToastChromeShapes(input),
    ...catalogDialogChromeShapes(input),
    ...catalogSheetHandleShapes(input),
    ...catalogResizableHandleShapes(input),
    ...catalogStepChromeShapes(input),
    ...catalogRatingStarShapes(input),
    ...pickerChromeShapes(input, base),
    ...fieldErrorIconShapes(input),
    ...sideNavIndicatorShapes(input),
    ...treeCellChevronShapes(input),
  ];
  const quiet = catalogQuietStyles(
    input.rule,
    { ...input.node.props, ...input.node.derivedProps },
    input.state,
  );
  if (!quiet) return invalidBorder(input, shapes);
  const border = /^(\d+(?:\.\d+)?)px solid (.+)$/.exec(
    quiet["border-bottom"] ?? "",
  );
  if (!border) throw new Error("CATALOG_QUIET_BORDER_UNSUPPORTED");
  const theme = input.theme ?? "light";
  const state = input.state ? input.node.stateVisual?.[input.state] : undefined;
  // Quiet releases rest box paint in both consumers. A document's explicit state write still
  // wins, just as the DOM state sheet wins over the quiet selector.
  const fill = state?.backgroundColor ?? state?.fill ?? quiet.background;
  const radius = Number(state?.radius ?? quiet["border-radius"]);
  const borderColor = state?.borderColor ?? quiet["border-color"];
  // (The underline is the bottom side: a state's bottom longhand, else its shorthand, else the
  // quiet rule's — read through the one border-geometry helper, ADR-219.)
  const width = snapBorderWidth(
    resolveBorderGeometry(state, { borderWidth: Number(border[1]) }).widths[2],
  );
  const color = cssVarColor(
    state?.borderColor ?? quiet["border-bottom-color"] ?? border[2],
    theme,
  ) as string;
  const backgrounds = new Set(
    shapes
      .filter(
        (shape) =>
          "presentationRole" in shape &&
          shape.presentationRole === "background-fill" &&
          "id" in shape,
      )
      .map((shape) => (shape as { id: string }).id),
  );
  const painted = shapes.flatMap((shape): Shape[] => {
    if (
      shape.type === "border" &&
      shape.target &&
      backgrounds.has(shape.target)
    )
      return borderColor === "transparent"
        ? []
        : [
            {
              ...shape,
              color: cssVarColor(borderColor, theme) as string,
              radius,
            },
          ];
    if (
      (shape.type === "roundRect" || shape.type === "rect") &&
      shape.id &&
      backgrounds.has(shape.id)
    )
      return [
        {
          ...shape,
          type: "roundRect",
          fill: cssVarColor(fill, theme) as string,
          radius,
        },
      ];
    return [shape];
  });
  painted.push({
    type: "line",
    x1: 0,
    x2: input.rect.width,
    y1: input.rect.height - width / 2,
    y2: input.rect.height - width / 2,
    stroke: color,
    strokeWidth: width,
  });
  return painted;
}

/**
 * ADR-259 Phase 1 — S2's link-out glyph of an item that opens a new tab (`catalogItemTrailingIcon`): in
 * the end padding the layout added (`catalogLinkOutPaddingRight`), its own right padding (and its
 * border) outside it, centred on the box — a card's in its bottom padding instead
 * (`catalogLinkOutCardEndInset`); the item's text color (S2 `currentColor`). The DOM draws the same glyph
 * box (`domBinding` — `catalogLinkOutGlyph`).
 */
/**
 * ADR-315 Phase 5 증분 5b-3 — a group's tree cell (`catalogTreeCellGlyph`): the DOM's RAC expand
 * button (`CatalogTableCell` — lucide chevron-right `1em`, centred in a `1lh` square at the
 * content's start, turned 90° when open) in the room the box keeps (`catalogBoxModel`), in the
 * cell's text color. The x is in the padding box, as `linkOutShapes`'.
 */
function treeCellChevronShapes(input: CatalogRuleShapeInput): Shape[] {
  const glyph = catalogTreeCellGlyph(input.node);
  if (!glyph) return [];
  const start = Number(catalogBoxModel(input.node).padding?.left ?? 0);
  return [
    {
      type: "icon_font",
      iconName: glyph.expanded ? "chevron-down" : "chevron-right",
      x: start - glyph.reserve + glyph.lineHeight / 2,
      y: input.rect.height / 2,
      fontSize: glyph.fontSize,
      fill:
        catalogRuleTextColor(input) ??
        (resolveToken(
          "{color.neutral}" as TokenRef,
          input.theme ?? "light",
        ) as string),
      strokeWidth: 2,
    } as Shape,
  ];
}

function linkOutShapes(input: CatalogRuleShapeInput): Shape[] {
  // (or a ListView item's chevron while it has child items — S2 `hasChildItems`, same place)
  const icon = catalogItemTrailingIcon(input.type, input.node.props);
  if (!icon) return [];
  const glyph = catalogLinkOutGlyph(input.type, input.node.props.size);
  const box = catalogBoxModel(input.node);
  const px = (value: unknown) =>
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? 0)) || 0;
  // An icon's x is in the padding box (the shape converter shifts it past the border — the DOM
  // glyph is placed from the padding box too): the padding box width less the own right padding.
  const border = snapBorderWidth(px(box.borderWidth));
  const ownRight = px(box.padding?.right) + border * 2;
  const color =
    catalogRuleTextColor(input) ??
    (resolveToken(
      "{color.neutral}" as TokenRef,
      input.theme ?? "light",
    ) as string);
  // A card (`catalogLinkOutCardEndInset`): in its bottom padding, its end at the texts' end.
  const cardEnd = catalogLinkOutCardEndInset(input.type);
  return [
    {
      type: "icon_font",
      iconName: icon,
      x:
        input.rect.width -
        (cardEnd === undefined ? ownRight : border * 2 + cardEnd) -
        glyph.size / 2,
      y:
        cardEnd === undefined
          ? input.rect.height / 2
          : input.rect.height - border * 2 - px(box.padding?.bottom) / 2,
      fontSize: glyph.size,
      fill: color,
      strokeWidth: 2,
    } as Shape,
  ];
}

/**
 * S2 InlineAlert's variant icon (`catalogInlineAlertIcon`): at the padding box's top end (S2 floats
 * it inline-end — its top at the content box's, its end at the content box's end), in S2's
 * `--iconPrimary`. The DOM draws the same glyph box (`domBinding` — `InlineAlertIcon`).
 */
function inlineAlertIconShapes(input: CatalogRuleShapeInput): Shape[] {
  if (input.type !== "InlineAlert") return [];
  const icon = catalogInlineAlertIcon(input.node.props);
  if (!icon) return [];
  const box = catalogBoxModel(input.node);
  const px = (value: unknown) =>
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? 0)) || 0;
  // (An icon's x · y are in the padding box — the shape converter shifts them past the border.)
  const border = snapBorderWidth(px(box.borderWidth));
  const ownRight = px(box.padding?.right) + border * 2;
  const color = icon.color.startsWith("{")
    ? (resolveToken(icon.color as TokenRef, input.theme ?? "light") as string)
    : icon.color;
  return [
    {
      type: "icon_font",
      iconName: icon.iconName,
      x: input.rect.width - ownRight - icon.size / 2,
      y: px(box.padding?.top) + icon.size / 2,
      fontSize: icon.size,
      fill: color,
      strokeWidth: 2,
    } as Shape,
  ];
}

/** RAC 예제의 장식 handle: DOM .sheet-handle과 같은 위치·크기·색. */
export function catalogSheetHandleShapes(
  input: Pick<CatalogRuleShapeInput, "type" | "node" | "rect" | "theme">,
): Shape[] {
  if (input.type !== "Sheet" || input.node.derivedProps?._sheetHandle !== true)
    return [];
  return [
    {
      type: "roundRect",
      ...catalogSheetHandleRect(
        String(input.node.derivedProps._sheetSwipeDirection ?? "bottom"),
        input.rect.width,
        input.rect.height,
      ),
      radius: SHEET_HANDLE.radius,
      fill: cssVarColor(SHEET_HANDLE.color, input.theme ?? "light") as string,
    } as Shape,
  ];
}

/**
 * ADR-318 Phase 4 — a Resizable Handle's pill (`variant: pill`) and grip (`withHandle`) on its line's
 * middle (`resizableChrome.ts` — the DOM's `::before` and `.resizable-grip`, the same values). The
 * Canvas draws a state's resting shape: rest, or the hover · pressed state card (R8).
 */
export function catalogResizableHandleShapes(
  input: Pick<
    CatalogRuleShapeInput,
    "type" | "node" | "rect" | "theme" | "state"
  >,
): Shape[] {
  if (input.type !== "ResizableHandle") return [];
  const theme = input.theme ?? "light";
  const axis =
    input.node.derivedProps?._resizableHandleAxis === "column"
      ? "column"
      : "row";
  const shapes: Shape[] = [];
  if (input.node.props.variant === "pill") {
    const state =
      input.state === "pressed"
        ? "pressed"
        : input.state === "hover"
          ? "hover"
          : "rest";
    const box = catalogResizablePillRect(
      axis,
      state,
      input.rect.width,
      input.rect.height,
    );
    shapes.push({
      type: "roundRect",
      ...box,
      radius: Math.min(box.width, box.height) / 2,
      fill: cssVarColor(RESIZABLE_PILL.states[state].color, theme) as string,
    } as Shape);
  }
  if (input.node.props.withHandle === true) {
    const box = catalogResizableGripRect(
      axis,
      input.rect.width,
      input.rect.height,
    );
    shapes.push(
      {
        type: "roundRect",
        ...box,
        radius: RESIZABLE_GRIP.radius,
        fill: cssVarColor(RESIZABLE_GRIP.color, theme) as string,
      } as Shape,
      {
        type: "icon_font",
        iconName: catalogResizableGripGlyph(axis),
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        fontSize: RESIZABLE_GRIP.glyphSize,
        fill: cssVarColor(RESIZABLE_GRIP.glyphColor, theme) as string,
        strokeWidth: 2,
      } as Shape,
    );
  }
  return shapes;
}

/**
 * ADR-321 — a Step's visual (the circle: filled when completed · current, a border when remaining —
 * its number, or a check once completed; a dot at S) and its track to the next step, in the room the
 * step keeps for them (`rule/stepList.ts` — the DOM's `span.step-visual` · `span.step-track` at the
 * same places and colors). The Canvas draws the start state (Decision 10).
 */
export function catalogStepChromeShapes(
  input: Pick<CatalogRuleShapeInput, "type" | "node" | "rect" | "theme">,
): Shape[] {
  if (input.type !== STEP_TYPE) return [];
  const derived = input.node.derivedProps;
  if (typeof derived?._stepState !== "string") return [];
  const theme = input.theme ?? "light";
  const size = catalogStepSize(derived._stepSize);
  const state = derived._stepState as StepState;
  const { visual, track } = catalogStepChromeRects({
    orientation:
      derived._stepOrientation === "vertical" ? "vertical" : "horizontal",
    size,
    last: derived._stepLast === true,
    lineHeight: catalogStepLineHeight(size),
    width: input.rect.width,
    height: input.rect.height,
  });
  const colors = catalogStepChromeColors({
    state,
    emphasized: derived._stepEmphasized === true,
    disabled: derived._stepDisabled === true,
  });
  const color = (ref: string) => resolveToken(ref as TokenRef, theme) as string;
  const radius = visual.width / 2;
  const shapes: Shape[] = [
    {
      type: "circle",
      x: visual.x + radius,
      y: visual.y + radius,
      radius,
      ...(colors.visualFill ? { fill: color(colors.visualFill) } : {}),
      ...(colors.visualBorder
        ? {
            stroke: color(colors.visualBorder),
            strokeWidth:
              Number(resolveToken(STEP_VISUAL_BORDER as TokenRef, theme)) || 2,
          }
        : {}),
    } as Shape,
  ];
  const glyph = catalogStepGlyph(size, state);
  if (glyph === "check")
    shapes.push({
      type: "icon_font",
      iconName: STEP_CHECK_ICON,
      x: visual.x + radius,
      y: visual.y + radius,
      fontSize: STEP_GLYPH_SIZE[size],
      fill: color(colors.glyph),
      strokeWidth: STEP_CHECK_STROKE,
    } as Shape);
  if (glyph === "number")
    shapes.push({
      type: "text",
      x: visual.x,
      y: visual.y + radius,
      maxWidth: visual.width,
      text: String(derived._stepNumber ?? ""),
      fontSize: STEP_GLYPH_SIZE[size],
      fontWeight: STEP_GLYPH_WEIGHT,
      fill: color(colors.glyph),
      align: "center",
      baseline: "middle",
      lineHeight: 1,
    } as Shape);
  if (track && track.width > 0 && track.height > 0)
    shapes.push({
      type: "rect",
      ...track,
      fill: color(colors.track),
    } as Shape);
  return shapes;
}

/**
 * ADR-321 Phase 4 — a Rating's five stars at its start value (Decision 10): the S2 star paths in the
 * content box from the start, centred on its height, 4 apart (the DOM's `span.rating-star` flex row —
 * `rule/rating.ts`). A half star (display only) is the filled star clipped to its left half over the
 * outline, as the DOM's `clip-path`.
 */
export function catalogRatingStarShapes(
  input: Pick<CatalogRuleShapeInput, "type" | "node" | "rect" | "theme">,
): Shape[] {
  if (input.type !== RATING_TYPE) return [];
  const props = { ...input.node.props, ...input.node.derivedProps };
  const { star } = catalogRatingBox(catalogRatingSize(props.size));
  const paths = catalogRatingScaledStarPaths(star);
  const fill = resolveToken(
    catalogRatingStarColor({
      emphasized: props.isEmphasized === true,
      disabled: props.isDisabled === true,
    }),
    input.theme ?? "light",
  ) as string;
  const padding = catalogBoxModel(input.node).padding;
  const left = Number(padding?.left ?? 0);
  const top = Number(padding?.top ?? 0);
  const inner = input.rect.height - top - Number(padding?.bottom ?? 0);
  const y = top + (inner - star) / 2;
  return catalogRatingStarFills(catalogRatingStart(props)).flatMap(
    (state, index) => {
      const base = {
        type: "path",
        x: left + index * (star + RATING_STAR_GAP),
        y,
        width: star,
        height: star,
        fill,
        fillRule: "evenodd",
      };
      if (state === "full") return [{ ...base, d: paths.filled } as Shape];
      const shapes = [{ ...base, d: paths.outline } as Shape];
      if (state === "half")
        shapes.push({
          ...base,
          d: paths.filled,
          clip: { x: 0, y: 0, width: star / 2, height: star },
        } as Shape);
      return shapes;
    },
  );
}

/**
 * ADR-300 — S2 SideNav's current-route bar on a current Canvas row (its SideNavItemContent): the
 * SideNavItem rule's `::before` (`catalogSideNavIndicator`), centred on the row, fully rounded.
 */
function sideNavIndicatorShapes(
  input: Pick<CatalogRuleShapeInput, "type" | "node" | "rect" | "theme">,
): Shape[] {
  if (input.type !== "SideNavItemContent") return [];
  const bar = catalogSideNavIndicator(input.node);
  if (!bar) return [];
  return [
    {
      type: "roundRect",
      x: bar.x,
      y: (input.rect.height - bar.height) / 2,
      width: bar.width,
      height: bar.height,
      radius: bar.width / 2,
      fill: cssVarColor(bar.color, input.theme ?? "light") as string,
    } as Shape,
  ];
}

/**
 * 295 후속 C9 — a placed S2 Toast's own glyphs (`toastChrome.ts`): its variant icon (Icon M) in the
 * start padding (16 from the edge) and its CloseButton's cross (12, centred in a control-M box 8 from
 * the end), both centred vertically, white (S2 `color: 'white'` · `staticColor="white"`). The DOM
 * draws the same boxes (`toast-variant-icon` · `toast-close-button` — the Toast rule's `rootSelectors`).
 */
export function catalogToastChromeShapes(
  input: Pick<CatalogRuleShapeInput, "type" | "node" | "rect" | "theme">,
): Shape[] {
  if (input.type !== "Toast") return [];
  const theme = input.theme ?? "light";
  const tokenPx = (ref: string) => {
    const value = resolveToken(ref as TokenRef, theme);
    return typeof value === "number"
      ? value
      : Number.parseFloat(String(value)) || 0;
  };
  const fill = resolveToken("{color.white}" as TokenRef, theme) as string;
  const y = input.rect.height / 2;
  const shapes: Shape[] = [];
  const icon = catalogToastIcon(input.node.props);
  if (icon) {
    const size = tokenPx("{size.icon.M}");
    shapes.push({
      type: "icon_font",
      iconName: icon,
      x: S2_TOAST_EDGE.start + size / 2,
      y,
      fontSize: size,
      fill,
      strokeWidth: 2,
    } as Shape);
  }
  shapes.push({
    type: "icon_font",
    iconName: CATALOG_TOAST_CLOSE_ICON,
    x: input.rect.width - S2_TOAST_EDGE.end - tokenPx("{size.height.M}") / 2,
    y,
    fontSize: CATALOG_TOAST_CLOSE_GLYPH_SIZE,
    fill,
    strokeWidth: 2,
  } as Shape);
  return shapes;
}

/**
 * S2 Dialog `isDismissible` (`dialogChrome.ts`): the CloseButton's cross — 12, centred in a control-M
 * box 12 from the top and end edges, in the Dialog's text color (`{color.neutral}`). The DOM draws
 * the same box (`dialog-close-button` — the Dialog rule's `rootSelectors`).
 */
export function catalogDialogChromeShapes(
  input: Pick<CatalogRuleShapeInput, "type" | "node" | "rect" | "theme">,
): Shape[] {
  if (input.type !== "Dialog" || input.node.props.isDismissible !== true)
    return [];
  const theme = input.theme ?? "light";
  const control = resolveToken("{size.height.M}" as TokenRef, theme);
  const box =
    typeof control === "number"
      ? control
      : Number.parseFloat(String(control)) || 32;
  return [
    {
      type: "icon_font",
      iconName: CATALOG_DIALOG_CLOSE_ICON,
      x: input.rect.width - CATALOG_DIALOG_CLOSE_INSET - box / 2,
      y: CATALOG_DIALOG_CLOSE_INSET + box / 2,
      fontSize: CATALOG_DIALOG_CLOSE_GLYPH_SIZE,
      fill: resolveToken("{color.neutral}" as TokenRef, theme) as string,
      strokeWidth: 2,
    } as Shape,
  ];
}

/**
 * S2 `FieldErrorIcon` — an invalid field's alert glyph in the room its input keeps at its end
 * (`fieldPrefix.ts` `catalogFieldErrorIcon`): `1lh` square, `_fieldErrorIconEnd` before the input's
 * end edge, centred on the line (a TextArea's first line), in the negative color. The DOM puts the
 * same glyph after the input in the box (`domBinding`).
 */
function fieldErrorIconShapes(input: CatalogRuleShapeInput): Shape[] {
  const size = input.node.derivedProps?._fieldErrorIcon;
  if (typeof size !== "number") return [];
  const end = Number(input.node.derivedProps?._fieldErrorIconEnd ?? 0);
  const multiline = input.node.derivedProps?._fieldErrorIconTop === true;
  return [
    {
      type: "icon_font",
      iconName: CATALOG_FIELD_ERROR_ICON,
      x: input.rect.width - end - size / 2,
      y: multiline ? size / 2 : input.rect.height / 2,
      fontSize: size,
      fill: resolveToken(
        "{color.negative}" as TokenRef,
        input.theme ?? "light",
      ) as string,
      strokeWidth: 2,
    } as Shape,
  ];
}

function pickerChromeShapes(
  input: CatalogRuleShapeInput,
  base: Shape[],
): Shape[] {
  const props = { ...input.node.props, ...input.node.derivedProps };
  const theme = input.theme ?? "light";
  const invalid = props._pickerInvalid === true;
  const disabled = props.isDisabled === true;
  const color = resolveToken(
    disabled ? "{color.picker-content-disabled}" : "{color.negative}",
    theme,
  ) as string;
  if (props._pickerValue === true && invalid) {
    const glyph = pickerInvalidGlyph(props.size);
    return [
      {
        type: "icon_font",
        iconName: PICKER_INVALID_ICON,
        x: input.rect.width - glyph.size / 2,
        y: input.rect.height / 2,
        fontSize: glyph.size,
        fill: color,
        strokeWidth: 2,
      } as Shape,
    ];
  }
  if (props._pickerTrigger !== true || disabled) return [];
  if (props.isQuiet === true)
    return input.state === "focusVisible"
      ? [
          {
            type: "line",
            x1: 0,
            x2: input.rect.width,
            y1: input.rect.height - PICKER_INVALID_WIDTH / 2,
            y2: input.rect.height - PICKER_INVALID_WIDTH / 2,
            stroke: resolveToken("{color.accent}", theme) as string,
            strokeWidth: PICKER_INVALID_WIDTH,
          },
        ]
      : [];
  if (!invalid) return [];
  const background = base.find(
    (shape) =>
      shape.type === "roundRect" &&
      shape.presentationRole === "background-fill",
  );
  if (!background || background.type !== "roundRect") return [];
  return [
    {
      type: "border",
      target: background.id,
      radius: background.radius,
      color,
      borderWidth: PICKER_INVALID_WIDTH,
    },
  ];
}

/**
 * An Image's picture (`src`) over its placeholder fill, under its border — covering the box with the
 * box's corners (the DOM `img` — `object-fit: cover`, `domBinding.runtime.ts` `imageElementProps`).
 * No source: the placeholder fill alone.
 */
function imageShape(
  shapes: Shape[],
  props: Readonly<Record<string, unknown>>,
  rect: { width: number; height: number },
): void {
  if (typeof props.src !== "string" || props.src === "") return;
  const bg = shapes.findIndex((shape) => "id" in shape && shape.id === "bg");
  shapes.splice(bg + 1, 0, {
    type: "image",
    x: 0,
    y: 0,
    width: rect.width,
    height: rect.height,
    src: props.src,
    fit: "cover",
    ...(bg >= 0 ? { radius: (shapes[bg] as { radius?: never }).radius } : {}),
  });
}

/**
 * ADR-306 (R1) — a Chart of a family type loads its family here, in the Builder scene-node layer:
 * `chart_scene` computes synchronously (a pending box until loaded) and the resolver is the shared
 * pure function Preview · Publish run too. The load's end seeds the bound Charts (`CatalogCanvas`
 * → `chartFamilyLoaded`). A failed load is tried again when that Chart is drawn again, once
 * `CHART_FAMILY_RETRY_MS` has passed since the failure (a failure seeds the Charts too, so an
 * immediate retry would draw and load in a loop while offline) — a palette insert loads at once.
 * The Preview iframe's Retry is another realm's registry and does not reach this one.
 */
export const CHART_FAMILY_RETRY_MS = 15_000;
const chartFamilyFailedAt = new Map<string, number>();

export function ensureChartFamily(
  chartType: unknown,
  now: number = Date.now(),
): void {
  const family = chartFamilyOf(chartType);
  if (!family || getChartFamily(family) || !chartFamilyAvailable(family))
    return;
  if (chartFamilyError(family) !== undefined) {
    const failedAt = chartFamilyFailedAt.get(family) ?? now;
    chartFamilyFailedAt.set(family, failedAt);
    if (now - failedAt < CHART_FAMILY_RETRY_MS) return;
  }
  chartFamilyFailedAt.delete(family);
  void loadChartFamily(family).catch(() => {
    chartFamilyFailedAt.set(family, Date.now());
  });
}

function ruleShapes(input: CatalogRuleShapeInput): Shape[] {
  const { rect, rule, type } = input;
  const { ctx } = ruleShapeContext(input);
  const { props, visual, paint, size: sizeSpec } = ctx;
  if (BOX_SIZE_TYPES.has(type)) {
    props._containerWidth = rect.width;
    props._containerHeight = rect.height;
  }
  if (type === "Chart" && rule.chart) props._chartRule = rule.chart;
  if (type === "Chart") ensureChartFamily(props.chartType);
  const binding = getPrimitiveBinding(type)?.skiaPrimitive;
  const keys = binding ? (Array.isArray(binding) ? binding : [binding]) : [];
  for (const key of keys) {
    if (getSkiaPrimitiveMode(key) !== "replace") continue;
    if (key === input.childPrimitive) return [];
    const replaced = getSkiaPrimitive(key)?.(ctx);
    if (replaced) return replaced;
  }
  const shellProps = CHILD_PROP_MERGE_TYPES.has(type)
    ? {
        ...props,
        children: undefined,
        text: undefined,
        label: undefined,
        placeholder: undefined,
      }
    : props;
  const base = buildCatalogShapes(
    visual,
    paint,
    shellProps,
    sizeSpec,
    // The node's own decoration (authored) over the rule's; a crumb's Link rests without it.
    catalogTextDecoration(props, visual, rule.textDecoration),
    type,
  );
  if (type === "Image") imageShape(base, props, rect);
  const prepend: Shape[] = [];
  const append: Shape[] = [];
  for (const key of keys) {
    const mode = getSkiaPrimitiveMode(key);
    if (mode === "replace" || key === input.childPrimitive) continue;
    const shapes = getSkiaPrimitive(key)?.(ctx);
    if (!shapes) continue;
    if (mode === "prepend") prepend.push(...shapes);
    else append.push(...shapes);
  }
  return composeCatalogShapes(base, prepend, append);
}

/** Every text of `data` paints an ellipsis at its box and clips there. */
function ellipsize(data: SkiaNodeData): void {
  if (data.text) {
    data.text.textOverflow = "ellipsis";
    data.text.clipText = true;
  }
  for (const child of data.children ?? []) ellipsize(child);
}

/** CanvasKit node data for one rule-backed node. */
export function catalogRuleNodeData(
  input: CatalogRuleShapeInput,
): SkiaNodeData {
  const shapes = catalogRuleShapes(input);
  const size = input.rule.sizes[
    (input.node.props.size as string | undefined) ??
      input.rule.defaultSize ??
      ""
  ] as Record<string, unknown> | undefined;
  normalizeMiddleBaselineTextLineHeight(shapes, size ?? {});
  // Table cells and columns follow their Table's S2 `overflowMode` (ADR-257 Phase 3 — the rule's
  // block in the record: truncate = one line cut at the box with an ellipsis, wrap = `normal`); a
  // Badge its own (ADR-257 후속 — S2 default wrap). A leaf the layout kept on one line is one line
  // at its fractional max-content box.
  const tableText = input.type === "Cell" || input.type === "Column";
  const tableWraps = tableText && input.node.visual.whiteSpace === "normal";
  const badgeTruncates =
    input.type === "Badge" && input.node.visual.whiteSpace === "nowrap";
  // Rule text leaves use the resolved wrapping contract too (including progress values
  // and TextArea's Input). Preserve it before the layout's single-line fallback.
  if (input.node.visual.whiteSpace !== undefined)
    for (const shape of shapes)
      if (shape.type === "text")
        shape.whiteSpace = input.node.visual.whiteSpace as
          "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";
  if (
    input.singleLine ||
    input.type === "Tag" ||
    badgeTruncates ||
    (tableText && !tableWraps)
  )
    for (const shape of shapes)
      if (shape.type === "text" && shape.whiteSpace == null)
        shape.whiteSpace = "nowrap";
  const data = specShapesToSkia(
    shapes,
    input.theme ?? "light",
    input.rect.width,
    input.rect.height,
    input.node.id,
  );
  // Catalog의 기본 outline도 CSS처럼 상자 밖에 그린다 (레이아웃 border와 분리).
  const stateOutline =
    input.type === "ActionButton" ||
    input.type === "ToggleButton" ||
    input.node.derivedProps?._searchFieldPart === true ||
    input.rule.structure?.archetype === "input-base" ||
    (input.rule.structure?.archetype === "toggle-indicator" &&
      !input.childPrimitive)
      ? catalogStateOutline(input)
      : undefined;
  const outline = stateOutline ?? catalogContainerOutline(input.rule);
  if (data.box && outline) {
    const color = String(
      outline.color.startsWith("{")
        ? resolveToken(outline.color as TokenRef, input.theme ?? "light")
        : cssVarColor(outline.color, input.theme ?? "light"),
    );
    data.box.outlineWidth = outline.width;
    data.box.outlineOffset = stateOutline?.offset ?? 0;
    data.box.outlineColor = colorIntToFloat32(
      cssColorToHex(color),
      cssColorToAlpha(color),
    );
  }
  if ((tableText && !tableWraps) || badgeTruncates) ellipsize(data);
  if (tableText) alignTableText(data, input.node.visual.textAlign);
  sliderValueText(data, input.node);
  return data;
}

/**
 * S2 1.8.2 Slider value text (the presence's `_valueChars` · `_valueAlign` — `Slider.tsx` `output`):
 * tabular digits in its `${n}ch` box, at its row's side (the label container's end, the start after
 * the track) — the DOM's `justify-content` on the flex box (`sliderValueStyle`).
 */
function sliderValueText(
  data: SkiaNodeData,
  node: CatalogRuleShapeInput["node"],
): void {
  if (typeof node.derivedProps?._valueChars !== "number") return;
  const align = node.derivedProps._valueAlign === "end" ? "right" : "left";
  const paint = (item: SkiaNodeData) => {
    if (item.text) {
      item.text.fontVariant = "tabular-nums";
      item.text.align = align;
    }
    for (const child of item.children ?? []) paint(child);
  };
  paint(data);
}

/** ADR-257 Phase 3 — a cell's own S2 `align` (the rule's `align` block: center · right). */
function alignTableText(data: SkiaNodeData, align: unknown): void {
  if (align !== "center" && align !== "right") return;
  if (data.text) data.text.align = align;
  for (const child of data.children ?? []) alignTableText(child, align);
}

/**
 * A DateInput's paint inputs beyond its props: its RAC segment runs (`dateSegmentPaint` — the row
 * the layout measured), the empty segments' paint (the owner's `[data-placeholder]` color at its
 * opacity in the canvas theme, its italic) and the node's resolved corner and border width (a
 * standalone field draws its own box — DateField `var(--border-radius)` at every size).
 */
export function catalogDateInputPaintProps(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, unknown> | undefined {
  const { radius, borderWidth } = node.visual;
  // (The node's corner · border width reach the box whether or not the segment row is measured —
  // without them the primitive falls back to its own size table, 2026-10-30.)
  const box = {
    ...(typeof radius === "number" ? { _boxRadius: radius } : {}),
    ...(typeof borderWidth === "number"
      ? { _boxBorderWidth: snapBorderWidth(borderWidth) }
      : {}),
  };
  const paint = root.dateSegmentPaint(node.id);
  if (!paint) return Object.keys(box).length > 0 ? box : undefined;
  const { color, opacity, fontStyle } = paint.placeholder;
  const token = color ? cssVarToTokenRef(color) : null;
  const resolved = token ? resolveToken(token, root.colorMode) : color;
  const fill =
    typeof resolved === "string" && /^#[0-9a-f]{6}$/i.test(resolved)
      ? opacity !== undefined && opacity < 1
        ? `${resolved}${Math.round(Math.max(0, opacity) * 255)
            .toString(16)
            .padStart(2, "0")}`
        : resolved
      : undefined;
  return {
    ...box,
    _segmentRuns: paint.runs,
    ...(fill ? { _segmentPlaceholderFill: fill } : {}),
    ...(fontStyle === "italic" ? { _segmentPlaceholderItalic: true } : {}),
  };
}

/**
 * ADR-309 Decision 4 — a calendar grid's selected-cell paint, from the calendar rule's day-cell
 * state tree (`partStateStyles` — the generated sheet's `[data-selected]` blocks read the same):
 * a Calendar's selected cell (its background · text · today dot), a RangeCalendar's band (`td`
 * `::before` — background · border). A range's start · end take the Calendar's selected paint (the
 * shared `RangeCalendar.css` start · end circle — the same `--accent` · `--fg-on-accent`).
 */
export function catalogCalendarGridPaintProps(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, unknown> | undefined {
  const states = (type: string) =>
    ((COMPONENT_RULES_TABLE as Record<string, { partStateStyles?: unknown }>)[
      type
    ]?.partStateStyles ?? {}) as Record<string, Record<string, unknown>>;
  // (The rule's state tree at those conditions — the generated sheet's cascade, `rulePaint`'s read.)
  const at = (tree: unknown, conditions: ConditionSet) =>
    evaluateConditionTree(tree as ConditionalValue<unknown>, conditions);
  const hex = (value: unknown) => {
    if (typeof value !== "string" || !value.startsWith("var("))
      return undefined;
    try {
      const resolved = cssVarColor(value, root.colorMode);
      return typeof resolved === "string" ? resolved : undefined;
    } catch {
      return undefined;
    }
  };
  const selected = { isSelected: true };
  const cell = states("Calendar")["& .react-aria-CalendarCell%"] ?? {};
  const after = states("Calendar")["& .react-aria-CalendarCell%::after"] ?? {};
  const band = Object.entries(states("RangeCalendar")).find(
    ([selector, decl]) =>
      selector.endsWith("::before") &&
      at(decl.background, selected) !== undefined &&
      at(decl.border, selected) !== undefined,
  )?.[1];
  const out = {
    _selectedFill: hex(at(cell.background, selected)),
    _selectedText: hex(at(cell.color, selected)),
    _disabledText: hex(at(cell.color, { isDisabled: true })),
    // (RAC's invalid value — its selected cells: the rule's invalid fill · the band's.)
    _invalidFill: hex(
      at(cell.background, { isSelected: true, isInvalid: true }),
    ),
    _selectedTodayDot: hex(
      at(after.background, { isToday: true, isSelected: true }),
    ),
    _bandFill: hex(at(band?.background, selected)),
    _bandBorder: hex(
      String(at(band?.border, selected) ?? "").replace(/^\S+\s+\S+\s+/, ""),
    ),
    _bandInvalidFill: hex(
      at(band?.background, { isSelected: true, isInvalid: true }),
    ),
    _bandInvalidBorder: hex(
      at(band?.borderColor, { isSelected: true, isInvalid: true }),
    ),
  };
  void node;
  return Object.fromEntries(
    Object.entries(out).filter(([, value]) => value !== undefined),
  );
}

/** A rule node's text decoration: off for a crumb's Link, the node's own, else the rule's. */
export function catalogTextDecoration(
  props: Readonly<Record<string, unknown>>,
  visual: unknown,
  ruleDecoration: string | undefined,
): string | undefined {
  if (props._noUnderline === true) return undefined;
  // S2 Link: a standalone quiet Link rests without its underline (the Link rule's state tree — the
  // DOM's generated sheet; its hover · focus underline is the Preview's). An inline one keeps it.
  if (props.isQuiet === true && props.isStandalone === true) return undefined;
  const own = (visual as Record<string, unknown> | undefined)?.textDecoration;
  if (own === undefined) return ruleDecoration;
  return String(own) === "none" ? undefined : String(own);
}
