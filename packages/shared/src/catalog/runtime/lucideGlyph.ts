import { createElement, type ReactElement } from "react";

import { getIconData } from "@composition/rendering";

/** The reference's `1em` icon size (a glyph that follows its text). */
export const CATALOG_GLYPH_1EM = { width: "1em", height: "1em" } as const;

/**
 * A Lucide glyph as the DOM draws icons here: `getIconData`'s paths · circles in the Lucide 24
 * viewBox and stroke (the Canvas `icon_font` reads the same data). `props` adds the place's own
 * size · class · style.
 */
export function catalogLucideGlyph(
  name: string,
  props: Readonly<Record<string, unknown>> = {},
): ReactElement {
  const data = getIconData(name);
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
      ...props,
    },
    ...(data?.paths ?? []).map((d, i) =>
      createElement("path", { key: `p${i}`, d }),
    ),
    ...(data?.circles ?? []).map((c, i) =>
      createElement("circle", { key: `c${i}`, cx: c.cx, cy: c.cy, r: c.r }),
    ),
  );
}
