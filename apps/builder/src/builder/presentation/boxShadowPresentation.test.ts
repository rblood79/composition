import { describe, expect, it } from "vitest";
import {
  addBoxShadowPresentationLayer,
  removeBoxShadowPresentationLayer,
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

  it("adds a layer after the given index (topology change) and serializes both", () => {
    const base = parseBoxShadowPresentation("0 2px 8px 0 #000")!;
    const added = addBoxShadowPresentationLayer(base, 0);
    expect(added.index).toBe(1);
    expect(added.value.layers).toHaveLength(2);
    expect(added.value.layers[1]).toMatchObject({ inset: false, blur: 4 });
    expect(haveSameBoxShadowPresentationTopology(base, added.value)).toBe(
      false,
    );
    // rgba() 안의 쉼표와 구분 — 파서가 두 레이어로 되읽는지로 검사한다.
    expect(
      parseBoxShadowPresentation(serializeBoxShadowPresentation(added.value))
        ?.layers,
    ).toHaveLength(2);
  });

  it("removes a layer and keeps the last one (null when only one remains)", () => {
    const base = parseBoxShadowPresentation(
      "0 2px 8px 0 #000, inset 0 1px 2px 0 #fff",
    )!;
    const removed = removeBoxShadowPresentationLayer(base, 0);
    expect(removed?.layers).toHaveLength(1);
    expect(removed?.layers[0]?.inset).toBe(true);
    expect(removeBoxShadowPresentationLayer(removed!, 0)).toBeNull();
    expect(removeBoxShadowPresentationLayer(base, 5)).toBeNull();
  });

  it("patches inset per layer (topology change for the presentation owner)", () => {
    const base = parseBoxShadowPresentation("0 2px 8px 0 #000")!;
    const next = patchBoxShadowPresentation(base, 0, "inset", true);
    expect(next?.layers[0]?.inset).toBe(true);
    expect(serializeBoxShadowPresentation(next!)).toMatch(/^inset /);
    expect(haveSameBoxShadowPresentationTopology(base, next!)).toBe(false);
    expect(patchBoxShadowPresentation(base, 0, "inset", 1)).toBeNull();
  });

  it("rejects none and invalid field patches", () => {
    expect(parseBoxShadowPresentation("none")).toBeNull();
    const base = parseBoxShadowPresentation("0 2px 8px #000")!;
    expect(patchBoxShadowPresentation(base, 2, "blur", 4)).toBeNull();
    expect(patchBoxShadowPresentation(base, 0, "color", "")).toBeNull();
  });
});
