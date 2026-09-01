/**
 * ADR-157 Phase 4 — data-bound GridList 소유자 배치 진실성 (layout Layer D, ListBox 선례 확산).
 *
 * `calculateContentHeight` §1.55c(GridList 분기)는 `props.items` 만 순회한다 — dataBinding/
 * collections 미접근. 따라서 순수 dataBinding 소유자(props.items 없음)는 items 만으로는 행 0 이다
 * (ADR-923 r20m1 뒤 sample fallback 없음 — 과거엔 4-item 기본값 fallback 을 반환해 scene 의
 * sample(10 카드) + hatch(remainder) visualRows 투영과 어긋났고, enrich 가 owner 를 4-item 으로
 * 고정해 투영된 rowsGroup 이 clip 됐다 — Hard Constraint 2 배치 진실성 위반).
 *
 * Phase 4: scene 이 sample mode owner 에 `_projectedRowsContentHeight`(= ceil(totalRows/columns) ×
 * rowHeight, hatch 와 동일 window resolver stride)를 주입하고, §1.55c 가 items fallback 대신 그
 * 값을 소비해 padding + 전체 높이 + border 를 반환한다. GridList 는 SPEC_SHAPES_INPUT 이 아니라
 * enrich 가 padding 을 재가산하므로(§1.55b ListBox 와 비대칭), 주입 소유자에 한해 spec-shapes 동급
 * 가드(`isInjectedGridListOwner`)로 border-box 반환값을 이중 가산 없이 최종값으로 쓴다.
 */

import { describe, expect, it } from "vitest";

import { resolveGridListSpacingMetric } from "@composition/specs";
import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentHeight, enrichWithIntrinsicSize } from "../utils";

function makeGridList(
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
): CanvasLayoutNode {
  return {
    id: "gl-1",
    type: "GridList",
    props: { layout: "stack", ...props, ...(style ? { style } : {}) },
  } as CanvasLayoutNode;
}

describe("calculateContentHeight — data-bound GridList _projectedRowsContentHeight (ADR-157 P4)", () => {
  const mDefault = resolveGridListSpacingMetric({
    layout: "stack",
    columns: 2,
  });
  const mPad10 = resolveGridListSpacingMetric({
    layout: "stack",
    columns: 2,
    style: { padding: 10 },
  });

  it("_projectedRowsContentHeight 주입 시 padding + 전체 높이 + border 반환 (items fallback 아님)", () => {
    // 500 visual rows × stride 56 = 28000 inner content.
    const h = calculateContentHeight(
      makeGridList({ _projectedRowsContentHeight: 28000 }),
    );
    expect(h).toBe(
      mDefault.paddingTop +
        mDefault.paddingBottom +
        28000 +
        mDefault.borderWidth * 2,
    );
  });

  it("주입값은 items 없는 빈 소유자 (padding + border) 보다 훨씬 큼 (clip 방지)", () => {
    const injected = calculateContentHeight(
      makeGridList({ _projectedRowsContentHeight: 28000 }),
    );
    // ADR-923 r20m1: items 없음 → 카드 0 (종전 4-card sample fallback 은 DOM/scene 에 없는 높이).
    const empty = calculateContentHeight(makeGridList({}));
    expect(empty).toBe(
      mDefault.paddingTop + mDefault.paddingBottom + mDefault.borderWidth * 2,
    );
    expect(injected).toBeGreaterThan(empty);
    expect(injected).toBeGreaterThan(1000);
  });

  it("_projectedRowsContentHeight 없으면 기존 items 경로 유지 (회귀 — 정적 4 카드 340)", () => {
    const h = calculateContentHeight(
      makeGridList({
        items: [
          { id: "i1", label: "Item 1", description: "Description" },
          { id: "i2", label: "Item 2", description: "Description" },
          { id: "i3", label: "Item 3", description: "Description" },
          { id: "i4", label: "Item 4", description: "Description" },
        ],
      }),
    );
    // 4 카드(desc) × 76 + 3 gap × 12 = 340. 카드 = pad24 + border2 + label24 + gap2 + desc24 = 76.
    //   2026-07-23: border2(catalog GridListItem.sizes.md.borderWidth=1×2) 가산 — projected
    //   카드(content50 + pad24 + border2 = 76) 와 정합. 과거 74 는 border 누락(컨테이너 -6 잔차)이었다.
    expect(h).toBe(4 * 76 + 3 * 12);
  });

  it("명시적 style.height 는 여전히 우선 (§1 우선)", () => {
    const h = calculateContentHeight(
      makeGridList({ _projectedRowsContentHeight: 28000 }, { height: 240 }),
    );
    expect(h).toBe(240);
  });

  it("enrich 통합(pad 없음): 주입 owner + rowsGroup child → style.height = 주입 border-box (double-pad 없음)", () => {
    const owner = makeGridList({ _projectedRowsContentHeight: 28000 });
    const rowsGroup = {
      id: "rg-1",
      type: "Rows",
      props: { style: { display: "flex", flexWrap: "wrap" } },
    } as CanvasLayoutNode;
    const out = enrichWithIntrinsicSize(
      owner,
      400,
      0,
      undefined,
      [rowsGroup],
      () => [],
    );
    const h = (out.props?.style as Record<string, unknown> | undefined)
      ?.height as number | undefined;
    expect(h).toBe(28000); // metric padding/border 0
  });

  it("enrich 통합(explicit padding 10): double-pad 회피 — §1.55c border-box(5020) 그대로", () => {
    // 회귀 가드: 주입 소비자 부재/가드 부재 시 enrich 가 box.padding(20)을 재가산 → 5040(=이중).
    const owner = makeGridList(
      { _projectedRowsContentHeight: 5000 },
      { padding: 10 },
    );
    const rowsGroup = {
      id: "rg-1",
      type: "Rows",
      props: { style: { display: "flex" } },
    } as CanvasLayoutNode;
    const out = enrichWithIntrinsicSize(
      owner,
      400,
      0,
      undefined,
      [rowsGroup],
      () => [],
    );
    const h = (out.props?.style as Record<string, unknown> | undefined)
      ?.height as number | undefined;
    // §1.55c = pad(10+10) + 5000 + border 0 = 5020. enrich 재가산 없음.
    expect(h).toBe(
      mPad10.paddingTop + mPad10.paddingBottom + 5000 + mPad10.borderWidth * 2,
    );
    expect(h).toBe(5020);
  });

  it("미주입 GridList(items-based)는 enrich double-pad 가드 미적용 (기존 경로 불변)", () => {
    // _projectedRowsContentHeight 없음 → isInjectedGridListOwner=false → 기존 padding 재가산 경로.
    const owner = makeGridList({ items: [{ id: "a", label: "A" }] });
    const rowsGroup = {
      id: "rg-1",
      type: "Rows",
      props: { style: { display: "flex" } },
    } as CanvasLayoutNode;
    const out = enrichWithIntrinsicSize(
      owner,
      400,
      0,
      undefined,
      [rowsGroup],
      () => [],
    );
    // §1.55c(1-item) 은 이미 border-box 지만 미주입 경로라 enrich 가 box.padding(0, no explicit)
    //   재가산 — explicit padding 없으므로 값 불변(가드 도입이 items-based 를 바꾸지 않음 확인).
    const h = (out.props?.style as Record<string, unknown> | undefined)
      ?.height as number | undefined;
    const direct = calculateContentHeight(owner);
    expect(h).toBe(direct); // box.padding 0 → 재가산 0 → direct 와 동일
  });
});
