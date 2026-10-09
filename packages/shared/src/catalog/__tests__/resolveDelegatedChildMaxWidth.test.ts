import { describe, expect, it } from "vitest";
import { resolveDelegatedChildMaxWidth } from "../resolvers/resolveDelegatedChildFontSize";

describe("resolveDelegatedChildMaxWidth — delegation bridge max-width (ADR-236 후속)", () => {
  it("ColorField Input 은 size 별 ch 값을 돌려준다", () => {
    // ADR-253: 입력 글자 크기는 ColorField 의 delegation 이 아니라 Input rule 이 정한다 — 이 배치
    //   선언에는 최대 폭만 남았다.
    expect(
      resolveDelegatedChildMaxWidth("ColorField", ".react-aria-Input", "M"),
    ).toEqual({
      amount: 12,
      unit: "ch",
    });
    expect(
      resolveDelegatedChildMaxWidth("ColorField", ".react-aria-Input", "XL")
        ?.amount,
    ).toBe(16);
  });

  it("max-width bridge 가 없는 자식은 undefined (TextField Input)", () => {
    expect(
      resolveDelegatedChildMaxWidth("TextField", ".react-aria-Input", "M"),
    ).toBeUndefined();
  });
});
