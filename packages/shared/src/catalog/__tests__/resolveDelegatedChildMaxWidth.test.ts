import { describe, expect, it } from "vitest";
import { resolveDelegatedChildMaxWidth } from "../resolvers/resolveDelegatedChildFontSize";

describe("resolveDelegatedChildMaxWidth — delegation bridge max-width (ADR-236 후속)", () => {
  it("ColorField Input 도 최대 폭이 없다 (2026-10-25 사용자 요청 — size 별 ch delegation 제거)", () => {
    for (const size of ["XS", "S", "M", "L", "XL"])
      expect(
        resolveDelegatedChildMaxWidth("ColorField", ".react-aria-Input", size),
      ).toBeUndefined();
  });

  it("max-width bridge 가 없는 자식은 undefined (TextField Input)", () => {
    expect(
      resolveDelegatedChildMaxWidth("TextField", ".react-aria-Input", "M"),
    ).toBeUndefined();
  });
});
