import { getIconData } from "@composition/rendering";
import type { CSSProperties } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { CATALOG_INLINE_ALERT_ICON_LABELS } from "../catalog/document/inlineAlertIcon";

export interface InlineAlertIconProps {
  variant: string;
  iconName: string;
  size: number;
  /** CSS color (a theme variable or a hex). */
  color: string;
  /** The alert's padding box insets: the glyph sits at its top end. */
  top: number | string;
  end: number | string;
}

/**
 * S2 InlineAlert's variant icon (`InlineAlert.tsx:260` — `<Icon aria-label={iconAlt} />`): an
 * image named by the variant's string, at the alert's padding box top end (S2's `float:
 * inline-end` — the Canvas draws the same box, `ruleShapes`).
 */
export function InlineAlertIcon({
  variant,
  iconName,
  size,
  color,
  top,
  end,
}: InlineAlertIconProps) {
  const { locale } = useLocale();
  const labels =
    CATALOG_INLINE_ALERT_ICON_LABELS[locale.split("-")[0] ?? "en"] ??
    CATALOG_INLINE_ALERT_ICON_LABELS.en!;
  const data = getIconData(iconName);
  const style: CSSProperties = {
    position: "absolute",
    top,
    insetInlineEnd: end,
    width: size,
    height: size,
    color,
    pointerEvents: "none",
  };
  return (
    <svg
      className="inline-alert-icon"
      role="img"
      aria-label={
        labels[variant] ?? CATALOG_INLINE_ALERT_ICON_LABELS.en![variant]
      }
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {data?.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {data?.circles?.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}
