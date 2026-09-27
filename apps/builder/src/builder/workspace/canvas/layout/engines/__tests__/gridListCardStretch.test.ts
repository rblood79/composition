/**
 * ADR-150 후속 F1 — slot-only GridList 카드 (자식 없는 GridListItem) 가 grid 행 높이로 늘어난다.
 *
 * DOM 은 `display: grid` (align-items 기본 stretch) 라 한 시각 행에 description 카드 (76) 와 label 만
 * 있는 카드 (50) 가 섞이면 둘 다 76 이다. Canvas enrich 는 자식 없는 카드에 명시 `height` 를 넣어 엔진이
 * stretch 를 건너뛰었다 (tree.rs `explicit` → `place_grid_axis` stretch off). auto 높이 카드는 명시
 * height 대신 content-box 스칼라 (`contentHeight`) 를 실어 엔진이 auto 로 보고 늘리게 한다.
 */
import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { enrichWithIntrinsicSize } from "../utils";

function card(style?: Record<string, unknown>): CanvasLayoutNode {
  return {
    id: "projection:gridlist-row:grid:r1",
    type: "GridListItem",
    props: {
      children: "Row One",
      ...(style ? { style } : {}),
    },
  } as CanvasLayoutNode;
}

function styleOf(node: CanvasLayoutNode): Record<string, unknown> {
  return (node.props?.style ?? {}) as Record<string, unknown>;
}

describe("slot-only GridList 카드 — grid stretch (ADR-150 후속 F1)", () => {
  it("grid 자식 · auto 높이 → 명시 height 없이 contentHeight 스칼라", () => {
    const out = styleOf(
      enrichWithIntrinsicSize(
        card(),
        200,
        800,
        undefined,
        [],
        undefined,
        false,
        true,
      ),
    );
    expect(out.height).toBeUndefined();
    expect(out.contentHeight).toBe(24);
  });

  it("Step 4.5 재측정 호출 (contentHeight 있음 → isFlexChild true · isGridChild 미전달) 도 같은 판정", () => {
    const out = styleOf(
      enrichWithIntrinsicSize(
        card({ contentHeight: 24 }),
        200,
        800,
        undefined,
        [],
        undefined,
        true,
      ),
    );
    expect(out.height).toBeUndefined();
    expect(out.contentHeight).toBe(24);
  });

  it("저작 height 가 있으면 그대로 둔다 (stretch 대상 아님)", () => {
    const out = styleOf(
      enrichWithIntrinsicSize(
        card({ height: 90 }),
        200,
        800,
        undefined,
        [],
        undefined,
        false,
        true,
      ),
    );
    expect(out.height).toBe(90);
  });
});
