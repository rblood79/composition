import { describe, expect, it } from "vitest";

import { FillType } from "../../../../types/builder/fill.types";
import {
  buildFillSwatchStyle,
  createVirtualColorFill,
  getFillDisplayLabel,
  resolveFillSeedColor,
} from "./fillPresentation";

describe("fillPresentation", () => {
  it("token/빈값 placeholder 는 white seed color 로 정규화한다", () => {
    expect(resolveFillSeedColor()).toBe("#FFFFFFFF");
    expect(resolveFillSeedColor("var(--bg-raised)")).toBe("#FFFFFFFF");
    expect(resolveFillSeedColor("$--surface")).toBe("#FFFFFFFF");
  });

  it("virtual fill 은 stable sentinel id 와 seed color 를 가진다", () => {
    expect(createVirtualColorFill("#112233")).toMatchObject({
      id: "__virtual_fill__",
      type: FillType.Color,
      color: "#112233FF",
    });
  });

  it("gradient/image fill swatch 는 공용 CSS adapter 결과를 재사용한다", () => {
    expect(
      buildFillSwatchStyle({
        id: "lg-1",
        type: FillType.LinearGradient,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        rotation: 90,
        stops: [
          { color: "#FF0000FF", position: 0 },
          { color: "#00FF00FF", position: 1 },
        ],
      }),
    ).toMatchObject({
      backgroundImage: "linear-gradient(90deg, #FF0000 0%, #00FF00 100%)",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    });

    expect(
      buildFillSwatchStyle({
        id: "img-1",
        type: FillType.Image,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        url: "https://example.com/a.png",
        mode: "fit",
      }),
    ).toMatchObject({
      backgroundImage: "url(https://example.com/a.png)",
      backgroundSize: "contain",
    });
  });

  it("display label 은 fill type 별 canonical 값을 사용한다", () => {
    expect(
      getFillDisplayLabel({
        id: "c-1",
        type: FillType.Color,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        color: "#123456FF",
      }),
    ).toBe("123456");
    expect(
      getFillDisplayLabel({
        id: "m-1",
        type: FillType.MeshGradient,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        rows: 2,
        columns: 2,
        points: [],
      }),
    ).toBe("Mesh");
  });
});
