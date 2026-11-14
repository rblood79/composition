import { describe, expect, it } from "vitest";
import { getSkiaPrimitive } from "../skiaPrimitives";

const draw = getSkiaPrimitive("divider")!;

describe("S2 Divider primitive", () => {
  it.each([1, 2, 4])("draws a rounded %spx line", (thickness) => {
    for (const orientation of ["horizontal", "vertical"]) {
      const vertical = orientation === "vertical";
      const shapes = draw({
        props: { orientation },
        size: { height: thickness },
        visual: {},
        paint: {
          backgroundColor: "rgba(255, 255, 255, 0.14)",
          backgroundAlpha: 1,
          staticTrackWash: false,
          hasVisibleBoxPaint: true,
          hasOpaqueCatalogBackground: false,
        },
      });
      expect(shapes).toEqual([
        {
          type: "roundRect",
          x: 0,
          y: 0,
          width: vertical ? thickness : "auto",
          height: vertical ? "auto" : thickness,
          radius: thickness / 2,
          fill: "rgba(255, 255, 255, 0.14)",
        },
      ]);
    }
  });
});
