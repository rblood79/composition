import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { applyCommonEngineStyle, enrichWithIntrinsicSize } from "../utils";

// 사용자 보고 (2026-09-19): 같은 frame (padding 20 · width fit-content) 이 자식이 있으면 두 leg 가
// 같고, 자식이 없으면 Canvas 120 / DOM 40. 자식 0 이면 `calculateContentWidth` 가 §6
// `DEFAULT_WIDTH` 80 으로 떨어져 width 120 + minWidth 120 이 주입됐다. 비-측정 컨테이너의
// 키워드는 자식 수와 무관하게 엔진 소유 (content 0 + padding = DOM 과 같은 40).
const frame = (style: Record<string, unknown>): CanvasLayoutNode =>
  ({
    id: "frame-1",
    type: "frame",
    props: { style },
  }) as CanvasLayoutNode;

const enrich = (node: CanvasLayoutNode, isFlexChild = true) =>
  (enrichWithIntrinsicSize(node, 400, 300, undefined, [], () => [], isFlexChild)
    .props?.style ?? {}) as Record<string, unknown>;

describe("빈 컨테이너의 intrinsic width 키워드는 엔진 소유", () => {
  it("자식 0 인 fit-content frame 은 키워드를 통과시키고 width/minWidth 를 주입하지 않는다 (flex 자식)", () => {
    const style = enrich(
      frame({ display: "block", width: "fit-content", padding: "20px" }),
    );
    expect(style.width).toBe("fit-content");
    expect(style.minWidth).toBeUndefined();
  });

  it("block 자식이어도 같다", () => {
    const style = enrich(
      frame({ display: "block", width: "fit-content", padding: "20px" }),
      false,
    );
    expect(style.width).toBe("fit-content");
    expect(style.minWidth).toBeUndefined();
  });

  it("측정 leaf (button) 의 fit-content 는 종전대로 TS 가 폭을 공급한다", () => {
    const style = (enrichWithIntrinsicSize(
      {
        id: "b",
        type: "Button",
        props: { children: "OK", size: "md", style: { width: "fit-content" } },
      } as CanvasLayoutNode,
      400,
      300,
      undefined,
      [],
      () => [],
      false,
    ).props?.style ?? {}) as Record<string, unknown>;
    expect(typeof style.width).toBe("number");
  });
});

// 2026-09-19 — 자식 있는 비-측정 컨테이너의 키워드·`%` 높이도 엔진 소유: 1-pass 가 근사 px
// (`calculateContentHeight` — block 안 block-level Button 2 를 30 으로) 를 넣지 않고, 엔진 경계
// (`applyCommonEngineStyle`) 가 높이 키워드를 폭과 같이 통과시킨다.
describe("자식 있는 컨테이너의 height 키워드·% 는 엔진 소유", () => {
  const button = (id: string, display: string): CanvasLayoutNode =>
    ({
      id,
      type: "Button",
      parent_id: "f",
      props: {
        children: "Button",
        size: "md",
        style: { display, flexDirection: "row", width: "fit-content" },
      },
    }) as CanvasLayoutNode;
  const kids = [button("b1", "flex"), button("b2", "inline-flex")];
  const enrichFrame = (height: string) =>
    (
      enrichWithIntrinsicSize(
        frame({
          display: "block",
          width: "fit-content",
          height,
          paddingTop: "20px",
          paddingBottom: "20px",
        }),
        340,
        794,
        undefined,
        kids,
        (id) => (id === "frame-1" ? kids : []),
        true,
      ).props?.style ?? {}
    ) as Record<string, unknown>;

  it("height: fit-content 는 px 로 선해석되지 않고 남는다", () => {
    expect(enrichFrame("fit-content").height).toBe("fit-content");
  });

  it("height: 100% 도 그대로 남는다 (엔진이 definite 부모에서만 해소, 미결정이면 content)", () => {
    expect(enrichFrame("100%").height).toBe("100%");
  });

  it("엔진 경계가 height 키워드를 통과시킨다", () => {
    const record: Record<string, unknown> = {};
    applyCommonEngineStyle(record, { height: "fit-content", width: "max-content" }, {});
    expect(record.height).toBe("fit-content");
    expect(record.width).toBe("max-content");
  });
});

// 2026-09-26 (ADR-236 후속) — 값 텍스트 leaf 3종 (SliderOutput · MeterValue · ProgressBarValue) 은 글자를
// 그리는 leaf 인데 측정 목록 밖이라, 6f0aedc03 이후 factory 인라인 `width: fit-content` 가 "빈 컨테이너
// 키워드 = 엔진 소유" 로 분류돼 폭 0 이 됐다 (Canvas 값 상자 w 0 · Skia 글자가 트랙 끝에서 넘침, DOM 은
// 글자 폭). 텍스트 leaf 스칼라 계약 (contentMin/MaxWidth) 으로 폭을 공급해야 한다.
describe("값 텍스트 leaf (SliderOutput · MeterValue · ProgressBarValue) 는 글자 폭을 공급한다", () => {
  for (const type of ["SliderOutput", "MeterValue", "ProgressBarValue"]) {
    for (const isFlexChild of [true, false]) {
      it(`${type} (${isFlexChild ? "flex" : "grid/block"} 자식) — contentMaxWidth > 0`, () => {
        const style = (enrichWithIntrinsicSize(
          {
            id: `${type}-1`,
            type,
            props: {
              children: "50",
              style: { width: "fit-content", fontSize: 14, lineHeight: "20px" },
            },
          } as CanvasLayoutNode,
          400,
          300,
          undefined,
          [],
          () => [],
          isFlexChild,
        ).props?.style ?? {}) as Record<string, unknown>;
        expect(Number(style.contentMaxWidth ?? 0), JSON.stringify(style)).toBeGreaterThan(0);
        // line box 신호 — 없으면 인라인 흐름에서 엔진이 아래 가장자리 baseline 으로 폴백해 옆 Label 이
        //   (높이 − 글자 baseline) 만큼 내려간다 (Slider `display: block` 에서 root h34 · Label y6, DOM h28 · y0).
        expect(Number(style.leafBaseline ?? 0), JSON.stringify(style)).toBeGreaterThan(0);
      });
    }
  }
});
