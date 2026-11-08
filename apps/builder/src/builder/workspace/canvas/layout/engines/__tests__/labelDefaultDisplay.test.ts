/**
 * ADR-236 후속 (2026-09-26) — Label 의 display 정본은 catalog 다. catalog 에 display 가 없어 Canvas 는
 * block 이었고, block 부모 (인라인 display block 인 Slider 등) 에서 Canvas Label 이 한 줄을 차지해
 * DOM (값과 한 줄) 과 갈렸다.
 *
 * 2026-11-07 (db5351e4c, S2 Label inline 배치): S2 Field Label 은 실제 inline Text/NBSP/Icon 자식으로
 * 조립되므로 catalog 와 수동 `Label.css` 가 함께 inline-flex → inline 으로 바뀌었다. 두 consumer 가
 * 같은 값을 읽는지가 이 테스트의 계약이다.
 */
import { describe, expect, it } from "vitest";
import { resolveDefaultDisplay } from "../defaultDisplay";
import { resolveContainerStylesFallback } from "../implicitStyles";

describe("Label 기본 display — catalog 정본 (DOM Label.css 와 같은 값)", () => {
  it("catalog 가 inline 을 주고 Canvas 기본 display 가 그것을 읽는다", () => {
    expect(resolveContainerStylesFallback("label", {}).display).toBe("inline");
    expect(resolveDefaultDisplay("Label")).toBe("inline");
  });
});
