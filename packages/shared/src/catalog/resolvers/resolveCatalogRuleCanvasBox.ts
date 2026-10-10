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
  fontWeight,
  isValidTokenRef,
  resolveBorderWidthPx,
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
export function catalogSizeAxisSkip(
  structure: ComponentRuleStructure | undefined,
): { height: boolean; padding: boolean; gap: boolean } | undefined {
  if (!structure) return undefined;
  const composition = structure.composition;
  const ownsContainerBox =
    !!composition &&
    (!!composition.layout ||
      !!composition.containerStyles ||
      !!composition.containerVariants);
  const containerStyles = structure.containerStyles;
  const trackOwningGrid =
    structure.archetype === "progress" ||
    (structure.archetype === "slider" &&
      containerStyles?.gridTemplateAreas != null);
  return {
    height: ownsContainerBox || trackOwningGrid,
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
    if (typeof sizeRecord.paddingY === "number") {
      assign("paddingTop", sizeRecord.paddingY);
      assign("paddingBottom", sizeRecord.paddingY);
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
  const padY = typeof size?.paddingY === "number" ? size.paddingY : 0;
  const border = resolveBorderWidthPx(size?.borderWidth);
  const rows =
    typeof rawRows === "number" && Number.isFinite(rawRows)
      ? Math.max(1, Math.floor(rawRows))
      : 3;
  return rows * lineHeight + padY * 2 + border * 2;
}

/**
 * CalendarGrid's DOM table box (`CalendarCommon.css`): `columns` columns of `cell + 4` (td padding
 * 2px each side) and a weekday header row of `cell` over one `cell + 4` row per week row, `cell` =
 * `sizes[size].iconSize + 4`. Columns · rows are the calendar model's (`calendarModel.ts`); a week
 * row with no day shown (all outside the month — `[data-outside-month] { display: none }` — or past
 * the calendar's first · last day) is its tds' padding only (`emptyRows`, the 6th row of a 5-week
 * month at `weeksInMonth` 6).
 */
export function catalogCalendarGridSize(
  sizeName: string | undefined,
  columns: number,
  rows: number,
  emptyRows = 0,
): { width: number; height: number } | undefined {
  const rule = resolveComponentRule("CalendarGrid");
  const sizes = rule?.sizes as Record<string, ComponentRuleSize> | undefined;
  const size =
    sizes?.[sizeName ?? ""] ??
    (rule?.defaultSize ? sizes?.[rule.defaultSize] : undefined);
  if (typeof size?.iconSize !== "number") return undefined;
  const cell = size.iconSize + 4;
  return {
    width: (cell + 4) * columns,
    height: cell + (rows - emptyRows) * (cell + 4) + emptyRows * 4,
  };
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
 * floor (`Math.max(size, 175)`, ColorWheel.tsx); our default is the ColorWheel rule's M height
 * (180 — the Canvas box before). Both consumers read this one value: the Canvas square
 * (`compositionRoot.ts` `styleOf`) and the DOM's RAC radii (`domBinding.tsx` — outer = half,
 * inner = outer − track).
 */
export const CATALOG_COLOR_WHEEL_TRACK = 26;

export function catalogColorWheelDiameter(size: unknown): number {
  const value = Number(size);
  if (Number.isFinite(value) && value > 0) return Math.max(value, 175);
  // The default keeps the box the ColorWheel rule's M height gave before (its size blocks are
  // content-fit now — the diameter is this one prop's).
  return 180;
}
