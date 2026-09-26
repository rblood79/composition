/**
 * ADR-236 후속 (2026-09-26) — Label 의 display 정본은 catalog 다. DOM 은 수동 `Label.css` 의 inline-flex
 * 를 쓰는데 catalog 에 display 가 없어 Canvas 는 block 이었고, block 부모 (인라인 display block 인
 * Slider 등) 에서 Canvas Label 이 한 줄을 차지해 DOM (값과 한 줄) 과 갈렸다.
 */
import { describe, expect, it } from "vitest";
import { resolveDefaultDisplay } from "../defaultDisplay";
import { resolveContainerStylesFallback } from "../implicitStyles";

describe("Label 기본 display — catalog 정본 (DOM Label.css 와 같은 값)", () => {
  it("catalog 가 inline-flex 를 주고 Canvas 기본 display 가 그것을 읽는다", () => {
    expect(resolveContainerStylesFallback("label", {}).display).toBe(
      "inline-flex",
    );
    expect(resolveDefaultDisplay("Label")).toBe("inline-flex");
  });
});
