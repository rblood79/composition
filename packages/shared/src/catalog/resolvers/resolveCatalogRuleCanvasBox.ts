/**
 * Canvas box of a rule-backed type: the layout declarations the Canvas lays out for the rule's
 * root element, from the rule alone. Shared by the legacy Canvas layout
 * (`resolveContainerStylesFallback`) and the ADR-248 typed definition (`ruleDefinition.ts`), so
 * both read one precedence.
 *
 * - Box axis: top-level `rule.containerStyles` **replaces** the base (Menu — the trigger box, not
 *   the popover panel); otherwise the 4-layer merge `resolveCatalogContainerBase`.
 * - Size axis (`sizes[size]` height / padding / gap / borderWidth): mirrors the CSS generator's
 *   emission (`catalogSizeAxisSkip`). A type without `structure` has no generated CSS; with a
 *   top-level box its `sizes` describe sub-parts and do not reach the root.
 */
import {
  cssVarToTokenRef,
  isValidTokenRef,
  resolveBorderWidthPx,
  s2ControlPaddingY,
  resolveToken,
  type TokenRef,
} from "@composition/rendering";
import type {
  ComponentRuleSize,
  ComponentRuleStructure,
} from "../../types/catalog-style.types";
import { resolveCatalogContainerBase } from "./resolveCatalogContainer";
import { resolveComponentRule } from "./resolveComponentRule";

/**
 * Layout keys the Canvas box carries (camelCase). Longhand padding/gap for the size axis (store
 * longhand policy); `padding` shorthand stays for container declarations.
 */
export const CATALOG_CANVAS_BOX_KEYS = [
  "display",
  "flex",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "width",
  "maxWidth",
  "maxHeight",
  "overflow",
  "outline",
  "gap",
  "padding",
  "gridTemplateAreas",
  "gridTemplateColumns",
  "gridTemplateRows",
  "position",
  // Generated `border: 1px solid` the layout must reserve (Calendar/RangeCalendar border-box).
  "borderWidth",
  "height",
  "rowGap",
  "columnGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  // Manual Table.css `min-height: 40px` layout channel.
  "minHeight",
] as const;

/**
 * Catalog layout value normalization: numbers as is, `{token}` / spacing `var(--…)` → px number,
 * other strings (`flex`, `column`, `fit-content`, colors) preserved.
 */
export function resolveCatalogLayoutValue(
  value: string | number,
): string | number {
  if (typeof value === "number") return value;
  if (isValidTokenRef(value)) {
    const resolved = resolveToken(value as TokenRef);
    return typeof resolved === "number" ? resolved : value;
  }
  if (value.startsWith("var(--")) {
    const tokenRef = cssVarToTokenRef(value);
    if (tokenRef) {
      const resolved = resolveToken(tokenRef);
      if (typeof resolved === "number") return resolved;
    }
  }
  return value;
}

/**
 * The CSS generator's `sizes` emission skips (`generateSizeStyles` options): the composition owns
 * the container box, or `structure.containerStyles` already declares the key. Progress/slider grid
 * containers' `sizes.height` is the track row, not the container. `undefined` = no `structure` =
 * no generated CSS for the type.
 */
/**
 * Whether a rule's composition owns its container box — the CSS generator's
 * `compositionOwnsContainerBox` (`CSSGenerator.ts`), read the same way here: a layout token, the
 * composition's own container styles, or container variant blocks that style the root
 * (AvatarGroup's start padding). Blocks that only place children (`nested` — InlineAlert's title
 * clear of its icon, 2026-10-13) leave the box to the variant · size blocks.
 */
export function catalogCompositionOwnsContainerBox(
  composition:
    | {
        layout?: unknown;
        containerStyles?: unknown;
        containerVariants?: unknown;
      }
    | undefined,
): boolean {
  if (!composition) return false;
  if (composition.layout || composition.containerStyles) return true;
  const variants = composition.containerVariants;
  if (!variants || typeof variants !== "object") return false;
  return Object.values(variants as Record<string, unknown>).some(
    (axis) =>
      !!axis &&
      typeof axis === "object" &&
      Object.values(axis as Record<string, { styles?: object }>).some(
        (block) => !!block?.styles && Object.keys(block.styles).length > 0,
      ),
  );
}

export function catalogSizeAxisSkip(
  structure: ComponentRuleStructure | undefined,
): { height: boolean; padding: boolean; gap: boolean } | undefined {
  if (!structure) return undefined;
  const ownsContainerBox = catalogCompositionOwnsContainerBox(
    structure.composition,
  );
  const containerStyles = structure.containerStyles;
  const trackOwningGrid =
    structure.archetype === "progress" ||
    (structure.archetype === "slider" &&
      containerStyles?.gridTemplateAreas != null);
  return {
    height:
      ownsContainerBox || trackOwningGrid || containerStyles?.height != null,
    padding: ownsContainerBox || containerStyles?.padding != null,
    gap: containerStyles?.gap != null,
  };
}

/**
 * Canvas box declarations of rule `type` (PascalCase rule key) at `sizeName` (default size when
 * absent or unknown). `supplied(key)` reports a value the caller already has for the key (authored
 * style, spec fallback): such keys are neither emitted nor treated as absent by the size axis.
 */
export function resolveCatalogRuleCanvasBox(
  type: string,
  sizeName: string | undefined,
  supplied: (key: string) => boolean = () => false,
): Record<string, string | number> {
  const rule = resolveComponentRule(type);
  const out: Record<string, string | number> = {};
  if (!rule) return out;
  const assign = (rawKey: string, rawValue: string | number): void => {
    const key = rawKey.replace(/-([a-z])/g, (_m, ch: string) =>
      ch.toUpperCase(),
    );
    if (!CATALOG_CANVAS_BOX_KEYS.includes(key as never)) return;
    if (supplied(key) || out[key] !== undefined) return;
    out[key] = resolveCatalogLayoutValue(rawValue);
  };
  const topLevelBox = rule.containerStyles as
    Record<string, string | number> | undefined;
  const sizeAxisSkip = catalogSizeAxisSkip(rule.structure);
  const sizes = rule.sizes as Record<string, ComponentRuleSize> | undefined;
  const sizeRecord: ComponentRuleSize | false | undefined =
    (sizeAxisSkip ? true : !topLevelBox) &&
    (sizes?.[sizeName ?? ""] ??
      (rule.defaultSize ? sizes?.[rule.defaultSize] : undefined));
  for (const [rawKey, rawValue] of Object.entries(
    topLevelBox ?? resolveCatalogContainerBase(type),
  )) {
    // The generated size block comes after the composition base gap.
    const value =
      rawKey === "gap" &&
      !topLevelBox &&
      !sizeAxisSkip?.gap &&
      sizeRecord &&
      typeof sizeRecord.gap === "number"
        ? sizeRecord.gap
        : rawValue;
    assign(rawKey, value as string | number);
    // (The size block's `column-gap` follows its `gap` — SearchField's grid columns, G5 example 5.)
    if (
      value !== rawValue &&
      sizeRecord &&
      typeof sizeRecord.columnGap === "number"
    )
      assign("columnGap", sizeRecord.columnGap);
  }
  if (!sizeRecord) return out;
  const has = (key: string): boolean => supplied(key) || out[key] !== undefined;
  // height 0 = content-fit (generated `height: auto`).
  if (
    !sizeAxisSkip?.height &&
    typeof sizeRecord.height === "number" &&
    sizeRecord.height > 0
  )
    assign("height", sizeRecord.height);
  // A top-level box is the Canvas box itself (Menu's trigger): `structure.containerStyles`
  // describes another element (the popover list), so its padding does not stand in for the size
  // axis here — the generated CSS skips it for that other element only.
  if ((topLevelBox || !sizeAxisSkip?.padding) && !has("padding")) {
    // ADR-295 Phase 3: an S2 control box centres its line in the installed control height.
    const paddingY = s2ControlPaddingY(sizeRecord) ?? sizeRecord.paddingY;
    if (typeof paddingY === "number") {
      assign("paddingTop", paddingY);
      assign("paddingBottom", paddingY);
    }
    if (typeof sizeRecord.paddingX === "number") {
      assign("paddingLeft", sizeRecord.paddingX);
      assign("paddingRight", sizeRecord.paddingX);
    }
  }
  // The generator emits `size.borderWidth` per size block unless a `border` shorthand is declared.
  if (
    !has("borderWidth") &&
    !has("border") &&
    topLevelBox?.border == null &&
    rule.structure?.containerStyles?.border == null &&
    sizeRecord.borderWidth != null
  )
    assign("borderWidth", resolveBorderWidthPx(sizeRecord.borderWidth));
  // `gap` is the row axis and `columnGap` the column override (generated `gap` + `column-gap`).
  if (!sizeAxisSkip?.gap && !has("gap")) {
    const columnGap = sizeRecord.columnGap ?? sizeRecord.gap;
    if (typeof sizeRecord.gap === "number") assign("rowGap", sizeRecord.gap);
    if (typeof columnGap === "number") assign("columnGap", columnGap);
  }
  return out;
}

/**
 * TextArea value box height: the DOM `<textarea rows>` = rows × line-height + paddingY×2 +
 * border×2, the line being the catalog `Input` rule's own (`sizes[size].lineHeight` — md 20; the
 * one-row box is 20 + 8 + 2 = 30). `rows` below 1 or fractional floors to 1 (DOM `rows` rule);
 * absent = 3 (shared default). `TextArea.sizes[size].height` is read by neither the DOM nor the
 * Canvas.
 */
export function catalogTextAreaInputHeight(
  sizeName: string,
  rawRows: unknown,
): number | undefined {
  const rule = resolveComponentRule("Input");
  const sizes = rule?.sizes as Record<string, ComponentRuleSize> | undefined;
  const size =
    sizes?.[sizeName] ??
    (rule?.defaultSize ? sizes?.[rule.defaultSize] : undefined);
  const lineHeight =
    size?.lineHeight === undefined
      ? undefined
      : resolveCatalogLayoutValue(size.lineHeight);
  if (typeof lineHeight !== "number") return undefined;
  // (ADR-295 Phase 3: the S2 centring padding in the installed control height.)
  const padY =
    (size && s2ControlPaddingY(size)) ??
    (typeof size?.paddingY === "number" ? size.paddingY : 0);
  const border = resolveBorderWidthPx(size?.borderWidth);
  const rows =
    typeof rawRows === "number" && Number.isFinite(rawRows)
      ? Math.max(1, Math.floor(rawRows))
      : 3;
  return rows * lineHeight + padY * 2 + border * 2;
}

/**
 * CalendarGrid's DOM table box (`CalendarCommon.css`): `columns` columns of `cell + 4` (td padding
 * 2px each side) and a weekday header row of 30 over one `cell + 4` row per week row. The calendar
 * has no size (사용자 2026-10-13 — RAC · S2 take none): `cell` is the CalendarGrid rule's
 * `iconSize + 4` (30) at the month's own width, or — laid out at another width (`width`, its
 * month's: a calendar given a width) — a `columns`th of it less the td padding (the RAC starter's
 * `calc(100cqw / 7 - gap)`; the DOM: `100cqw / 7 - 4px`). Columns · rows are the calendar model's
 * (`calendarModel.ts`); a week row with no day shown (all outside the month — `[data-outside-month]
 * { display: none }` — or past the calendar's first · last day) is its tds' padding only
 * (`emptyRows`, the 6th row of a 5-week month at `weeksInMonth` 6).
 */
export function catalogCalendarGridSize(
  columns: number,
  rows: number,
  emptyRows = 0,
  width?: number,
): { width: number; height: number; cell: number } | undefined {
  const cell = catalogCalendarCellSize(columns, width);
  if (cell === undefined) return undefined;
  const header = catalogCalendarCellSize(columns)!;
  return {
    width: (cell + 4) * columns,
    height: header + (rows - emptyRows) * (cell + 4) + emptyRows * 4,
    cell,
  };
}

/**
 * A calendar day cell's side (`catalogCalendarGridSize`): the CalendarGrid rule's `iconSize + 4`,
 * or a `columns`th of `width` less the td padding. The Canvas grid primitive draws at the same side.
 */
export function catalogCalendarCellSize(
  columns: number,
  width?: number,
): number | undefined {
  const rule = resolveComponentRule("CalendarGrid");
  const sizes = rule?.sizes as Record<string, ComponentRuleSize> | undefined;
  const size = rule?.defaultSize ? sizes?.[rule.defaultSize] : undefined;
  if (typeof size?.iconSize !== "number") return undefined;
  return width !== undefined && columns > 0
    ? Math.max(0, width / columns - 4)
    : size.iconSize + 4;
}

/**
 * Text weight of a rule type's RAC `data-current` item (the current Breadcrumb crumb): the
 * default variant's `currentTextWeight`, else its `textWeight`. Read by the legacy Canvas
 * measurement and the ADR-248 composition root, like the crumb primitive reads it from `visual`.
 */
export function catalogCurrentTextWeight(type: string): number | undefined {
  const rule = resolveComponentRule(type);
  const variant =
    rule?.defaultVariant !== undefined
      ? rule.variants[rule.defaultVariant]
      : undefined;
  return variant?.currentTextWeight ?? variant?.textWeight;
}

/**
 * Breadcrumb 조각 뒤 구분자 Icon (사용자 결정 2026-09-29 — 편집 가능한 Icon 자식, 종전 `::after` "›"):
 * 기본 이름 · 색 = `Breadcrumb.variants.default.trailingIcon`, 크기 · 간격 = `Breadcrumb.sizes[size]`
 * (`iconSize` · `gap` — label ↔ 구분자, 조각 사이는 `Breadcrumbs.sizes[size].gap` 같은 값). Canvas 두 경로
 * (구 scene · ADR-248 runtime) 와 seed 가 읽고, DOM 은 손 `Breadcrumbs.css` 가 같은 값을 적는다.
 */
export function catalogBreadcrumbSeparatorIcon(size: string | undefined): {
  name: string;
  color: string;
  iconSize: number;
  gap: number;
} {
  const rule = resolveComponentRule("Breadcrumb");
  const variant =
    rule?.defaultVariant !== undefined
      ? rule.variants[rule.defaultVariant]
      : undefined;
  const sizes = (rule?.sizes ?? {}) as Record<string, ComponentRuleSize>;
  const entry =
    (size !== undefined ? sizes[size] : undefined) ??
    (rule?.defaultSize !== undefined ? sizes[rule.defaultSize] : undefined);
  const iconSize = Number(entry?.iconSize);
  const gap = Number(entry?.gap);
  return {
    name: variant?.trailingIcon?.name ?? "chevron-right",
    color: variant?.trailingIcon?.color ?? "{color.neutral-subdued}",
    iconSize: iconSize > 0 ? iconSize : 16,
    gap: gap >= 0 ? gap : 0,
  };
}

/**
 * S2 1.8.0 ColorWheel `size` (2026-10-10): the wheel's outer diameter px — S2 clamps to a 175
 * floor (`Math.max(size, 175)`, ColorWheel.tsx) and defaults to 192; the ring is 24 thick
 * (`thickness`). Both are plain px there (inline style — no `--s2-scale`), so they stay on touch.
 * Both consumers read these values: the Canvas square (`compositionRoot.ts` `styleOf`) and the
 * DOM's RAC radii (`domBinding.tsx` — outer = half, inner = outer − track).
 */
export const CATALOG_COLOR_WHEEL_TRACK = 24;

export function catalogColorWheelDiameter(size: unknown): number {
  const value = Number(size);
  if (Number.isFinite(value) && value > 0) return Math.max(value, 175);
  return 192;
}

/**
 * A resize of a ColorWheel's box (Styles width / height · a Canvas handle) as its S2 `size`: the
 * wheel is its diameter square (S2 sets width/height from `size` over any style), so the box
 * edit is the diameter — the larger side when both change. Undefined without a positive length.
 */
export function catalogColorWheelSizeOfBox(
  width: number | undefined,
  height: number | undefined,
): number | undefined {
  const side = Math.max(width ?? 0, height ?? 0);
  return Number.isFinite(side) && side > 0 ? Math.round(side) : undefined;
}
