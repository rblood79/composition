import { describe, expect, it } from "vitest";
import {
  boxShadowPresentationToEffects,
  haveSameBoxShadowPresentationTopology,
  parseBoxShadowPresentation,
  patchBoxShadowPresentation,
  serializeBoxShadowPresentation,
} from "./boxShadowPresentation";

describe("boxShadowPresentation", () => {
  it("parses all CSS fields and serializes a stable typed value", () => {
    const value = parseBoxShadowPresentation(
      "inset 1px -2px 8px 3px rgba(20, 40, 60, 0.5), 0 4px 12px #112233",
    );

    expect(value).toEqual({
      layers: [
        {
          offsetX: 1,
          offsetY: -2,
          blur: 8,
          spread: 3,
          color: "rgba(20, 40, 60, 0.5)",
          inset: true,
        },
        {
          offsetX: 0,
          offsetY: 4,
          blur: 12,
          spread: 0,
          color: "rgba(17, 34, 51, 1)",
          inset: false,
        },
      ],
    });
    expect(value && serializeBoxShadowPresentation(value)).toBe(
      "inset 1px -2px 8px 3px rgba(20, 40, 60, 0.5), 0px 4px 12px 0px rgba(17, 34, 51, 1)",
    );
  });

  it("patches one layer without changing topology", () => {
    const base = parseBoxShadowPresentation("0 2px 8px 0 #000")!;
    const next = patchBoxShadowPresentation(base, 0, "spread", -4);
    const color = patchBoxShadowPresentation(next!, 0, "color", "#ff000080");

    expect(color?.layers[0]).toMatchObject({
      spread: -4,
      color: "#ff000080",
      inset: false,
    });
    expect(haveSameBoxShadowPresentationTopology(base, color!)).toBe(true);
    expect(boxShadowPresentationToEffects(color!)[0]).toMatchObject({
      dx: 0,
      dy: 2,
      spread: -4,
      inner: false,
    });
  });

  it("rejects none and invalid field patches", () => {
    expect(parseBoxShadowPresentation("none")).toBeNull();
    const base = parseBoxShadowPresentation("0 2px 8px #000")!;
    expect(patchBoxShadowPresentation(base, 2, "blur", 4)).toBeNull();
    expect(patchBoxShadowPresentation(base, 0, "color", "")).toBeNull();
  });
});
