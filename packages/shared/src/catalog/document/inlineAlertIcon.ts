/**
 * S2 1.8.0 InlineAlert's icon (`InlineAlert.tsx:184-191, 208-262`): the alert draws an icon per
 * variant — not one of its children (S2 renders it before them, `float: inline-end`) — named by the
 * variant's string (`inlinealert.{variant}`). Neutral has none. Both consumers read this: the Canvas
 * glyph (`ruleShapes`) and the DOM glyph element (`domBinding` — `InlineAlertIcon`).
 *
 * The float is the box's top end corner here (the engine has no float — `block.rs`): the glyph sits
 * at the padding box's top end, and the title Heading keeps clear of it by the InlineAlert rule's
 * `variant` blocks (`> .react-aria-Heading` placed with an end margin — the glyph's size).
 */

/** S2's icons, as the Lucide glyphs (the set every icon here comes from). */
export const CATALOG_INLINE_ALERT_ICONS: Readonly<Record<string, string>> = {
  // S2 InfoCircle · CheckmarkCircle · AlertDiamond (no Lucide diamond alert — its octagon) ·
  // AlertTriangle.
  informative: "info",
  positive: "circle-check",
  notice: "octagon-alert",
  negative: "triangle-alert",
};

/** S2 Icon size M (the alert sets none — `IconContext` gives only the float and the color). */
export const CATALOG_INLINE_ALERT_ICON_SIZE = 20;

export interface CatalogInlineAlertIcon {
  readonly variant: string;
  readonly iconName: string;
  readonly size: number;
  /** A theme token (`{color.informative}`) or a hex color. */
  readonly color: string;
}

/**
 * The icon of an InlineAlert with these props, or undefined (neutral). Its color is S2's
 * `--iconPrimary`: the variant color on `border`, on `subtleFill` too (notice takes the negative
 * color), white on `boldFill` (black on notice).
 */
export function catalogInlineAlertIcon(
  props: Readonly<Record<string, unknown>>,
): CatalogInlineAlertIcon | undefined {
  const variant = String(props.variant ?? "informative");
  const iconName = CATALOG_INLINE_ALERT_ICONS[variant];
  if (!iconName) return undefined;
  const fillStyle = props.fillStyle ?? "border";
  const color =
    fillStyle === "boldFill"
      ? variant === "notice"
        ? "#000000"
        : "#ffffff"
      : fillStyle === "subtleFill" && variant === "notice"
        ? "{color.negative}"
        : `{color.${variant}}`;
  return {
    variant,
    iconName,
    size: CATALOG_INLINE_ALERT_ICON_SIZE,
    color,
  };
}

/** S2 1.8.0 `inlinealert.{variant}` (`@react-spectrum/s2` intl) in the languages the Builder ships. */
export const CATALOG_INLINE_ALERT_ICON_LABELS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  en: {
    informative: "Information",
    positive: "Success",
    notice: "Warning",
    negative: "Error",
  },
  ko: {
    informative: "정보",
    positive: "성공",
    notice: "경고",
    negative: "오류",
  },
  ja: {
    informative: "情報",
    positive: "成功",
    notice: "警告",
    negative: "エラー",
  },
  zh: {
    informative: "信息",
    positive: "成功",
    notice: "警告",
    negative: "错误",
  },
};
