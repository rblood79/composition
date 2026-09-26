import { describe, expect, it } from "vitest";
import { resolveDelegatedChildMaxWidth } from "../resolvers/resolveDelegatedChildFontSize";

describe("resolveDelegatedChildMaxWidth — delegation bridge max-width (ADR-236 후속)", () => {
  it("ColorField Input 은 size 별 ch 값과 입력 글자 크기를 돌려준다", () => {
    expect(
      resolveDelegatedChildMaxWidth("ColorField", ".react-aria-Input", "md"),
    ).toEqual({
      amount: 12,
      unit: "ch",
      fontSize: 14,
    });
    expect(
      resolveDelegatedChildMaxWidth("ColorField", ".react-aria-Input", "xl")
        ?.amount,
    ).toBe(16);
  });

  it("max-width bridge 가 없는 자식은 undefined (TextField Input)", () => {
    expect(
      resolveDelegatedChildMaxWidth("TextField", ".react-aria-Input", "md"),
    ).toBeUndefined();
  });
});
