import { describe, expect, it } from "vitest";

import {
  resolveGridListSpacingMetric,
  resolveListBoxSpacingMetric,
} from "@composition/specs";
import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentHeight, enrichWithIntrinsicSize } from "../utils";

/**
 * ADR-923 Phase 3 r20m1 — 빈 정적 ListBox/GridList 의 layout 기본 행.
 *
 * DOM 은 빈 source 를 rows [] 로 정규화하고 (`useResolvedCollectionItems` — sourceKind "empty"),
 * scene 도 rows 0 이면 projection 을 만들지 않는다 (`appendListBoxRowProjection` /
 * `appendGridListRowProjection` → null). layout §1.55b/§1.55c 만 collection rows SSOT 전환 전의
 * sample-data fallback (3 행 / 4 카드) 을 남겨 두 표면에 없는 110 / 164 을 컨테이너에 주입했다
 * (Breadcrumbs 192px phantom · TagList `Tag N` 과 같은 형태 — 한 표면만 갖는 빈 집합 기본값).
 * 빈 집합의 높이는 padding + border 뿐이어야 한다.
 */
const listBox = (
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
): CanvasLayoutNode =>
  ({
    id: "lb-empty",
    type: "ListBox",
    props: style ? { ...props, style } : props,
  }) as CanvasLayoutNode;

const gridList = (
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
): CanvasLayoutNode =>
  ({
    id: "gl-empty",
    type: "GridList",
    props: style ? { ...props, style } : props,
  }) as CanvasLayoutNode;

describe("ADR-923 r20m1 — 빈 정적 collection 의 layout 높이는 padding + border 뿐", () => {
  const lb = resolveListBoxSpacingMetric({});
  const lbEmpty = lb.paddingTop + lb.paddingBottom + lb.borderWidth * 2;
  // grid 기본 (catalog layout.default = grid · columns 2)
  const gl = resolveGridListSpacingMetric({ layout: "grid", columns: 2 });
  const glEmpty = gl.paddingTop + gl.paddingBottom + gl.borderWidth * 2;

  it("ListBox: items 부재 · [] · dataBinding 만 (projection 없음) → 행 0 (종전 3 행 110)", () => {
    for (const props of [
      {},
      { items: [] },
      { dataBinding: { type: "collection", source: "dataTable", name: "t" } },
    ]) {
      const h = calculateContentHeight(listBox(props));
      expect(h, JSON.stringify(props)).toBe(lbEmpty);
      expect(h).toBeLessThan(110);
    }
  });

  it("GridList: items 부재 · [] → 카드 0 (종전 4 카드 164)", () => {
    for (const props of [{}, { items: [] }, { layout: "stack", items: [] }]) {
      const h = calculateContentHeight(gridList(props));
      expect(h, JSON.stringify(props)).toBe(glEmpty);
      expect(h).toBeLessThan(164);
    }
  });

  it("items 가 있으면 그대로 (회귀 — 정적 1 행은 sample 3 행보다 낮다)", () => {
    const one = calculateContentHeight(
      listBox({ items: [{ id: "a", label: "A" }] }),
    );
    expect(one).toBe(lbEmpty + lb.itemHeight);
    const oneCard = calculateContentHeight(
      gridList({ items: [{ id: "a", label: "A" }] }),
    );
    expect(oneCard).toBeGreaterThan(glEmpty);
    expect(oneCard).toBeLessThan(164);
  });

  it("enrich 통합: 자식 없는 빈 ListBox/GridList owner → style.height = padding + border", () => {
    // GridList 는 metric 기본 padding/border 가 0 이라 (live 는 catalog containerStyles padding 이
    //   enrich 전에 style 로 공급됨) style padding 을 두어야 주입 경로 (`childResolvedHeight > 0`)
    //   를 탄다 — 0 이면 엔진이 스스로 0 을 낸다.
    const glPad = resolveGridListSpacingMetric({
      layout: "grid",
      columns: 2,
      style: { padding: 10 },
    });
    for (const [owner, expected] of [
      [listBox({ items: [] }), lbEmpty],
      [
        gridList({ items: [] }, { padding: 10 }),
        glPad.paddingTop + glPad.paddingBottom + glPad.borderWidth * 2,
      ],
    ] as const) {
      const out = enrichWithIntrinsicSize(
        owner,
        400,
        0,
        undefined,
        [],
        () => [],
      );
      const h = (out.props?.style as Record<string, unknown> | undefined)
        ?.height as number | undefined;
      expect(h, owner.type).toBe(expected);
    }
  });
});
