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
  if (!sizeAxisSkip?.padding && !has("padding")) {
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
 * border×2, the line being the catalog one-row `Input` box minus its padding and border (md 30 −
 * 8 − 2 = 20). `rows` below 1 or fractional floors to 1 (DOM `rows` rule); absent = 3 (shared
 * default). `TextArea.sizes[size].height` is read by neither the DOM nor the Canvas.
 */
export function catalogTextAreaInputHeight(
  sizeName: string,
  rawRows: unknown,
): number | undefined {
  const sizes = resolveComponentRule("Input")?.sizes as
    Record<string, ComponentRuleSize> | undefined;
  const rule = resolveComponentRule("Input");
  const size =
    sizes?.[sizeName] ??
    (rule?.defaultSize ? sizes?.[rule.defaultSize] : undefined);
  const oneRow = size?.height;
  if (typeof oneRow !== "number") return undefined;
  const padY = typeof size?.paddingY === "number" ? size.paddingY : 0;
  const border = resolveBorderWidthPx(size?.borderWidth);
  const lineHeight = oneRow - padY * 2 - border * 2;
  const rows =
    typeof rawRows === "number" && Number.isFinite(rawRows)
      ? Math.max(1, Math.floor(rawRows))
      : 3;
  return oneRow + (rows - 1) * lineHeight;
}

/**
 * CalendarGrid's DOM table box (`CalendarCommon.css`): 7 columns of `cell + 4` (td padding 2px
 * each side) and a weekday header row of `cell` over one `cell + 4` row per week of the shown
 * month, `cell` = `sizes[size].iconSize + 4`. The month is `month` (default: the current one), as
 * RAC shows it without a value.
 */
export function catalogCalendarGridSize(
  sizeName: string | undefined,
  month: Date = new Date(),
): { width: number; height: number } | undefined {
  const rule = resolveComponentRule("CalendarGrid");
  const sizes = rule?.sizes as Record<string, ComponentRuleSize> | undefined;
  const size =
    sizes?.[sizeName ?? ""] ??
    (rule?.defaultSize ? sizes?.[rule.defaultSize] : undefined);
  if (typeof size?.iconSize !== "number") return undefined;
  const cell = size.iconSize + 4;
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((days + offset) / 7);
  return { width: (cell + 4) * 7, height: cell + rows * (cell + 4) };
}

/**
 * The calendar header's heading text (RAC `useVisibleRangeDescription`): the shown month — a
 * month range for `maxVisibleMonths` > 1 — as `{ month: "long", year: "numeric" }` in the
 * Calendar's locale (`Calendar.tsx`: `locale` + `calendarSystem` → the `-u-ca-` extension;
 * without a locale, the rendering environment's — `fallbackLocale`, RAC's default being
 * `navigator.language`). The DOM reads these root props and not the CalendarHeader child's own
 * `children`/`locale`.
 */
export function catalogCalendarTitle(
  props: Readonly<Record<string, unknown>>,
  fallbackLocale: string = globalThis.navigator?.language || "en-US",
  month: Date = new Date(),
): string {
  const locale =
    typeof props.locale === "string" && props.locale
      ? props.locale
      : fallbackLocale;
  const system =
    typeof props.calendarSystem === "string" ? props.calendarSystem : "";
  const format = new Intl.DateTimeFormat(
    system ? `${locale}-u-ca-${system}` : locale,
    { month: "long", year: "numeric" },
  );
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const months = Math.max(1, Math.floor(Number(props.maxVisibleMonths) || 1));
  if (months === 1) return format.format(start);
  return format.formatRange(
    start,
    new Date(month.getFullYear(), month.getMonth() + months - 1, 1),
  );
}

/**
 * The calendar header row's DOM composition (`Calendar.tsx` `<header>`: previous Button ·
 * Heading · next Button) at the owner's size. Each nav button is `Calendar.css` `height` ×
 * (`height` + `--spacing-xs`) wide (`CalendarCommon.css` resets the general `.react-aria-Button`
 * default `min-width` — the nav buttons carry no `data-size`). The heading is the size's `font-size` (`Calendar.css`) at
 * `--font-weight-bold`, `line-height` `--text-base--line-height` (`Heading.css`, a unitless ratio —
 * the text measure's `lineHeight` unit).
 */
export function catalogCalendarHeaderParts(sizeName: string | undefined):
  | {
      navWidth: number;
      navHeight: number;
      heading: { fontSize: number; fontWeight: number; lineHeight: number };
    }
  | undefined {
  const rule = resolveComponentRule("CalendarHeader");
  const sizes = rule?.sizes as Record<string, ComponentRuleSize> | undefined;
  const size =
    sizes?.[sizeName ?? ""] ??
    (rule?.defaultSize ? sizes?.[rule.defaultSize] : undefined);
  const navHeight = size?.height;
  const rawFont = size?.fontSize;
  const fontSize =
    typeof rawFont === "string" && isValidTokenRef(rawFont)
      ? Number(resolveToken(rawFont))
      : Number(rawFont);
  if (typeof navHeight !== "number" || !(fontSize > 0)) return undefined;
  const ratio =
    Number(resolveToken("{typography.text-base--line-height}")) /
    Number(resolveToken("{typography.text-base}"));
  return {
    navWidth: navHeight + Number(resolveToken("{spacing.xs}")),
    navHeight,
    heading: {
      fontSize,
      fontWeight: fontWeight.bold,
      lineHeight: ratio,
    },
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
