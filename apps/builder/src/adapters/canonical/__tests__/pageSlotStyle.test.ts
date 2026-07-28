import { describe, expect, it } from "vitest";

import { resolvePageSlotStyle } from "../pageFrameProjection";

/**
 * 슬롯 style 보완 정책 — **크기 주입은 축을 가린다** (2026-07-28)
 *
 * 인라인 축은 부모 폭이 확정이라 `100%` 가 풀리지만, 블록 축은 page body 가
 * `min-height` 로 서는 순간 미결정이라 `height:100%` 가 **해소되지 않는다**. 그런데
 * 크기를 *명시* 한 것은 맞아서 `align-items:stretch` 까지 꺼진다 — 결과가 0 이다
 * (Chrome 실측 동일: `row + minHeight:400` 안의 `height:100%` 슬롯 0x0,
 * 크기 미지정 슬롯 80x400).
 *
 * grid 분기는 같은 결론에 먼저 와 있었다(2026-07-27, "배치만 보완하고 크기는 주입하지
 * 않는다"). 본 테스트는 flex 분기의 블록 축이 거기 합류했음을 고정한다.
 */
describe("resolvePageSlotStyle — 축별 크기 주입", () => {
  const call = (
    frameBodyStyle: Record<string, unknown>,
    slotName = "content",
    slotStyle?: Record<string, unknown>,
  ) =>
    resolvePageSlotStyle({
      slotStyle: slotStyle as never,
      slotName,
      frameBodyStyle: frameBodyStyle as never,
    });

  it("flex row: 블록 축(height)에 100% 를 주입하지 않는다", () => {
    const style = call({ display: "flex", flexDirection: "row" });
    expect(style.height).toBeUndefined();
    // 주축 여유는 그대로 content 슬롯이 먹는다.
    expect(style.flex).toBe("1 1 auto");
  });

  it("flex row: content 아닌 슬롯도 height 주입 없음 + shrink 금지 유지", () => {
    const style = call({ display: "flex", flexDirection: "row" }, "header");
    expect(style.height).toBeUndefined();
    expect(style.flexShrink).toBe(0);
  });

  it("flex column: 인라인 축(width)은 100% 를 유지한다", () => {
    // 폭은 부모가 확정이라 `100%` 가 풀린다 — stretch 와 같은 값이고 회귀 위험이 없다.
    const style = call({ display: "flex", flexDirection: "column" });
    expect(style.width).toBe("100%");
    expect(style.flex).toBe("1 1 auto");
  });

  it("사용자가 명시한 값은 덮지 않는다", () => {
    const style = call(
      { display: "flex", flexDirection: "column" },
      "content",
      {
        width: "240px",
      },
    );
    expect(style.width).toBe("240px");
  });

  it("grid: 크기 주입 없이 배치만 보완 (기존 계약)", () => {
    const style = call({ display: "grid" }, "header");
    expect(style.gridArea).toBe("header");
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
  });
});
