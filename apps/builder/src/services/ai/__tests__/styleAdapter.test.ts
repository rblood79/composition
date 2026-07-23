import { describe, expect, it } from "vitest";

import { FillType } from "../../../types/builder/fill.types";
import {
  adaptPropsForElement,
  adaptStylePatchWithFills,
} from "../styleAdapter";

describe("styleAdapter fill bridge", () => {
  it("create path applies fills and derives background css from fills", () => {
    const props = adaptPropsForElement(
      "Div",
      {},
      { padding: "16px", backgroundColor: "#FFFFFF" },
      [
        {
          id: "fill-1",
          type: FillType.Color,
          color: "#123456FF",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
        },
      ],
    );

    expect(props.fills).toHaveLength(1);
    expect(props.style).toMatchObject({
      padding: 16,
      backgroundColor: "#123456",
    });
  });

  it("update path clears stale direct background fields when fills are supplied", () => {
    const result = adaptStylePatchWithFills(
      {
        backgroundColor: "#FFFFFF",
        backgroundImage: "linear-gradient(red, blue)",
        padding: 12,
      },
      {},
      [
        {
          id: "fill-1",
          type: FillType.Color,
          color: "#ABCDEF88",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
        },
      ],
    );

    // fill color `#ABCDEF88` 의 알파(88 = 0.533)를 보존 → 반투명 색은 rgba 로 방출된다
    //   (17d2f3085 normalizeExternalFillIngress). 불투명(FF) fill 만 hex 로 유지 (위 create path 참조).
    expect(result.style).toMatchObject({
      padding: 12,
      backgroundColor: "rgba(171, 205, 239, 0.533)",
    });
    expect(result.style.backgroundImage).toBeUndefined();
  });
});
