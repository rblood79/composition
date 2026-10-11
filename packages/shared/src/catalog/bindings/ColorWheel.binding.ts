/**
 * ColorWheel — RAC `<ColorWheel outerRadius innerRadius>` + `<ColorWheelTrack>` + `<ColorThumb>`.
 *
 * D2: S2 `size` · `defaultValue` (ADR-258 — RAC color syntax `racColor`, RAC's default
 * `hsl(0, 100%, 50%)`). D3: the track's conic gradient · thumb are the document value's function
 * (`runtime/colorControlGradient.ts`).
 */

import type { PrimitiveBinding } from "../types";

export const colorWheelBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorWheel",
  },
  rac: {
    primitive: "ColorWheel",
    parts: ["colorWheelTrack", "colorThumb"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      // S2 1.8.0 ColorWheel `size` (2026-10-10): the wheel's outer diameter px — S2 default 192 ·
      //   floor 175 (ColorWheel.tsx `Math.max(size, 175)`); ours defaults to the rule's M height
      //   (180, the Canvas box before). DOM: `domBinding` turns it into RAC outerRadius /
      //   innerRadius (the catalog path passed none, so RAC drew a 0-size track); Canvas:
      //   `styleOf` supplies the same square (`catalogColorWheelDiameter`).
      size: { kind: "number", label: "Size", section: "appearance", min: 0 },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      defaultValue: {
        kind: "rac-color",
        label: "Default Value",
        section: "content",
        default: "hsl(0, 100%, 50%)",
      },
    },
    toRacProps: "default",
  },
};
