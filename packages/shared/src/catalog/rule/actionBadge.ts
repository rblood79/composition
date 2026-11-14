import { resolveToken, type TokenRef } from "@composition/rendering";

/**
 * (2026-11-14, 사용자 「ActionButton 에 Avatar · Badge — Badge 에 value」) S2 1.8.2 `ActionButton.tsx`
 * `NotificationBadgeContext` + `NotificationBadge.tsx`: the ActionButton's count badge — one table the
 * generated sheet (the ActionButton rule's `sizeSelectors`), the Canvas part rules (compiled from them ·
 * the corner, `manualBoxRules.ts`) and the badge's place (`catalogActionBadgeLayout` — both consumers)
 * read.
 *
 * - Size: the button's (S2 `size: props.size === 'XS' ? undefined : props.size` — XS takes the badge's
 *   default S). Height S 12 · M `1lh` (the `ui-xs` line) · L 16 · XL 18; font `ui-xs` · `ui-xs` · `ui-sm` ·
 *   `ui` (repository `text-2xs` · `text-2xs` · `text-xs` · `text-sm`), weight normal; a pill.
 * - Shape: one digit a square (`aspectRatio: square`, no padding), more (`99+` too) `edge-to-text`
 *   (the badge height × 3/8) on each side — `[data-notification]` (`catalogNotificationBadgeDigits`).
 * - Place: absolute, its centre on the icon's top-right corner — S2 `top: calc(self(height)/2 -
 *   var(--iconWidth)/2)` · `marginTop: -height/2` · `insetStart: --iconWidth` (the icon column) ·
 *   `marginStart: calc(var(--iconMargin) * 2 - height/4)`; a text-only button's on its top-right corner
 *   (`--badgeTop: 0` · `--badgePosition: full`).
 */
export type CatalogActionBadgeContent = "default" | "glyphOnly" | "textOnly";

const BUTTON_TEXT = {
  XS: "text-2xs",
  S: "text-xs",
  M: "text-sm",
  L: "text-base",
  XL: "text-lg",
} as const;
type ButtonSize = keyof typeof BUTTON_TEXT;

/** The badge's height (a px number or the `ui-xs` line ref) and font per button size. */
const BADGE = {
  XS: { height: 12, font: "text-2xs" },
  S: { height: 12, font: "text-2xs" },
  M: { height: "{typography.text-2xs--line-height}", font: "text-2xs" },
  L: { height: 16, font: "text-xs" },
  XL: { height: 18, font: "text-sm" },
} as const;

const px = (ref: string): number => {
  const value = resolveToken(ref as TokenRef, "light");
  if (typeof value !== "number")
    throw new Error(`CATALOG_ACTION_BADGE_TOKEN:${ref}`);
  return value;
};
const sizeOf = (size: unknown): ButtonSize =>
  typeof size === "string" && size in BUTTON_TEXT ? (size as ButtonSize) : "M";

/** The badge height (px) at a button size. */
export function catalogActionBadgeHeight(size: unknown): number {
  const height = BADGE[sizeOf(size)].height;
  return typeof height === "number" ? height : px(height);
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The ActionButton rule's `sizeSelectors` badge blocks — the generated sheet, and (compiled) the Canvas
 * part rules: box, font, line and the double-digit padding.
 */
export function catalogActionBadgeSizeSelectors(): Record<
  string,
  Record<string, Record<string, string>>
> {
  return Object.fromEntries(
    (Object.keys(BADGE) as ButtonSize[]).map((size) => {
      const height = catalogActionBadgeHeight(size);
      return [
        size,
        {
          ".react-aria-Badge": {
            height: `${height}px`,
            "min-height": `${height}px`,
            "min-width": `${height}px`,
            padding: "0px",
            "border-width": "0px",
            "border-radius": `${height / 2}px`,
            "font-size": `var(--${BADGE[size].font})`,
            "line-height": `${height}px`,
            "font-weight": "400",
          },
          '.react-aria-Badge[data-notification="double"]': {
            padding: `0px ${round((height * 3) / 8)}px`,
          },
        },
      ];
    }),
  );
}

/** The Canvas side of the badge corner (`border-radius` is paint — the part-rule compiler leaves it). */
export function catalogActionBadgeCornerParts(): Array<{
  childType: string;
  size: string;
  layout: Record<string, string>;
  visual: Record<string, number>;
}> {
  return (Object.keys(BADGE) as ButtonSize[]).map((size) => ({
    childType: "Badge",
    size,
    layout: {},
    visual: { radius: catalogActionBadgeHeight(size) / 2 },
  }));
}

/**
 * The badge's place in its ActionButton (padding-box coordinates — the button is `position: relative`,
 * no border): what the Canvas engine and the DOM inline style both take.
 */
export function catalogActionBadgeLayout(
  size: unknown,
  content: CatalogActionBadgeContent,
): Record<string, string> {
  const name = sizeOf(size);
  const text = BUTTON_TEXT[name];
  const buttonHeight = px(`{size.height.${name}}`);
  const iconWidth = px(`{typography.${text}--line-height}`);
  const fontSize = px(`{typography.${text}}`);
  const paddingX = (buttonHeight * 3) / 8;
  // S2 `fontRelative(-2)` — the icon's start margin beside a label (0 alone).
  const iconMargin = (-2 / 14) * fontSize;
  const badge = catalogActionBadgeHeight(name);
  const iconTop = (buttonHeight - iconWidth) / 2;
  const at = (value: number) => `${round(value)}px`;
  if (content === "textOnly")
    return {
      position: "absolute",
      insetTop: "0px",
      insetLeft: "100%",
      marginTop: at(-badge / 2),
      marginLeft: at(-paddingX + iconMargin * 2 - badge / 4),
    };
  // (Our icon starts at the content edge — S2's own start margin is the one `iconMargin` the badge keeps
  //   past it; a glyph-only button is a square with its glyph centred.)
  return content === "glyphOnly"
    ? {
        position: "absolute",
        insetTop: at(iconTop),
        insetLeft: at((buttonHeight - iconWidth) / 2),
        marginTop: at(-badge / 2),
        marginLeft: at(iconWidth - badge / 4),
      }
    : {
        position: "absolute",
        insetTop: at(iconTop),
        insetLeft: at(paddingX),
        marginTop: at(-badge / 2),
        marginLeft: at(iconWidth + iconMargin - badge / 4),
      };
}

/** A record's badge place (its derived `_actionBadge` · `_actionBadgeSize`, `presence.ts`), or none. */
export function catalogActionBadgeNodeLayout(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string> {
  const content = derived?._actionBadge;
  return content === "default" ||
    content === "glyphOnly" ||
    content === "textOnly"
    ? catalogActionBadgeLayout(derived?._actionBadgeSize, content)
    : {};
}

/**
 * S2 NotificationBadge `isStaticColor` (`NotificationBadge.tsx`): `backgroundColor:
 * 'transparent-overlay-1000'` (the static color, opaque) · `color: 'auto'` (its contrast) — the last
 * branch of every Badge variant's paint, so it wins over the fill style.
 */
export function catalogBadgeStaticVariants<
  T extends Record<
    string,
    { paint: { backgroundColor: object; color: object } & Record<string, unknown> }
  >,
>(variants: T): T {
  return Object.fromEntries(
    Object.entries(variants).map(([name, variant]) => [
      name,
      {
        ...variant,
        paint: {
          ...variant.paint,
          backgroundColor: {
            ...variant.paint.backgroundColor,
            staticColor: { white: "{color.white}", black: "{color.black}" },
          },
          color: {
            ...variant.paint.color,
            staticColor: { white: "{color.black}", black: "{color.white}" },
          },
        },
      },
    ]),
  ) as T;
}
