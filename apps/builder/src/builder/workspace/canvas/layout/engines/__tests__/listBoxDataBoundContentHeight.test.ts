/**
 * ADR-157 Phase 3 — data-bound ListBox 소유자 배치 진실성 (layout Layer D).
 *
 * `calculateContentHeight` §1.55b(ListBox 분기)는 `props.items` 만 순회한다 — dataBinding/
 * collections 미접근. 따라서 순수 dataBinding 소유자(props.items 없음)는 3-item 기본값 fallback 을
 * 반환하고, scene 은 sample(10행) + hatch(remainder) 를 totalRows 전체 높이로 투영한다 →
 * layout(3-item) ≠ scene(totalRows) → enrich 가 owner 를 3-item 으로 고정 → 투영된 rowsGroup 이
 * clip 된다(Hard Constraint 2 배치 진실성 위반).
 *
 * Phase 3: scene 이 sample mode owner 에 `_projectedRowsContentHeight`(= totalRows × rowHeight,
 * hatch 와 동일 rowHeight resolver 출력)를 주입하고, §1.55b 가 items fallback 대신 그 값을 소비해
 * padding + totalRows 전체 높이 + border 를 반환한다. rowHeight 는 scene(window resolver) 이
 * 산출한 값 — samples + hatch 와 동일 → 배치 진실성.
 */

import { describe, expect, it } from "vitest";

import { resolveListBoxSpacingMetric } from "@composition/specs";
import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentHeight, enrichWithIntrinsicSize } from "../utils";

function makeListBox(
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
): CanvasLayoutNode {
  return {
    id: "lb-1",
    type: "ListBox",
    props: style ? { ...props, style } : props,
  } as CanvasLayoutNode;
}

describe("calculateContentHeight — data-bound ListBox _projectedRowsContentHeight (ADR-157 P3)", () => {
  const m = resolveListBoxSpacingMetric({});

  it("_projectedRowsContentHeight 주입 시 padding + 전체 높이 + border 반환 (items fallback 아님)", () => {
    // 100행 × rowHeight 50 = 5000 inner content (samples 10×50 + hatch 90×50).
    const h = calculateContentHeight(
      makeListBox({ _projectedRowsContentHeight: 5000 }),
    );
    expect(h).toBe(m.paddingTop + m.paddingBottom + 5000 + m.borderWidth * 2);
  });

  it("주입값은 items 없는 빈 소유자 (padding + border) 보다 훨씬 큼 (clip 방지)", () => {
    const injected = calculateContentHeight(
      makeListBox({ _projectedRowsContentHeight: 5000 }),
    );
    // ADR-923 r20m1: items 없음 → 행 0 (종전 3-item sample fallback 은 DOM/scene 에 없는 높이).
    const empty = calculateContentHeight(makeListBox({}));
    expect(empty).toBe(m.paddingTop + m.paddingBottom + m.borderWidth * 2);
    expect(injected).toBeGreaterThan(empty);
    expect(injected).toBeGreaterThan(1000);
  });

  it("_projectedRowsContentHeight 없으면 기존 items 경로 유지 (회귀 — 정적 3 items)", () => {
    const h = calculateContentHeight(
      makeListBox({
        items: [
          { id: "item-1", label: "Item 1" },
          { id: "item-2", label: "Item 2" },
          { id: "item-3", label: "Item 3" },
        ],
      }),
    );
    // 3 items(label-only) → padding + 3×itemHeight + 2×rowGap + border.
    const expected =
      m.paddingTop +
      m.paddingBottom +
      3 * m.itemHeight +
      2 * m.rowGap +
      m.borderWidth * 2;
    expect(h).toBe(expected);
  });

  it("명시적 style.height 는 여전히 우선 (bounded/explicit 소유자 — §1 우선)", () => {
    const h = calculateContentHeight(
      makeListBox({ _projectedRowsContentHeight: 5000 }, { height: 240 }),
    );
    expect(h).toBe(240);
  });

  it("enrich 통합: sample-mode owner(_projectedRowsContentHeight + rowsGroup child) → style.height = 전체 border-box", () => {
    // 런타임 경로: enrich childful 분기 → calculateContentHeight §1.55b → 주입값 소비.
    //   listbox 는 SPEC_SHAPES_INPUT 이라 enrich 가 padding/border 재가산 안 함(§1.55b 가 이미 border-box).
    const owner = makeListBox({ _projectedRowsContentHeight: 5000 });
    const rowsGroup = {
      id: "rg-1",
      type: "Rows",
      props: { style: { display: "flex", flexDirection: "column" } },
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
    expect(h).toBe(m.paddingTop + m.paddingBottom + 5000 + m.borderWidth * 2);
  });
});

/**
 * ADR-157 owner-height fix (b) — ref-instance(Pencil instance→master) 소유자.
 *
 * clean live 검증(2026-07-21)에서 실제 clip 확인: page collection 소유자는 `type: "ref"`
 * (ref→component-listbox) 라 `calculateContentHeight` 의 `tag1 = element.type.toLowerCase()`
 * 가 "ref" → §1.55b(`tag1==="listbox"`) 게이트를 못 타 `_projectedRowsContentHeight` 를
 * 소비하지 못하고 generic 경로로 sample 행만 계산 → 투영된 rowsGroup(samples+hatch) clip.
 * (owner=300 < rowsGroup=336 실측). 이전 세션의 "artifact" 반증이 틀렸음이 live 로 확정.
 *
 * fix: tag1 분기 이전 family-agnostic early-check — injection 이 있으면 tag1 무관하게
 * generic border-box(padding + injection + border)를 반환. direct-type(listbox/gridlist)은
 * 기존 family 분기가 처리하므로 early-check 는 그 두 tag 를 제외 (family metric padding 보존).
 */
describe("calculateContentHeight — ref-instance owner _projectedRowsContentHeight (ADR-157 fix b)", () => {
  function makeRefOwner(
    props: Record<string, unknown>,
    style?: Record<string, unknown>,
  ): CanvasLayoutNode {
    return {
      id: "ref-1",
      type: "ref",
      ref: "component-listbox",
      componentName: "ListBox",
      props: style ? { ...props, style } : props,
    } as CanvasLayoutNode;
  }

  it("ref 소유자(type='ref')도 injection 을 소비 — padding/border 없으면 injection 그대로", () => {
    const h = calculateContentHeight(
      makeRefOwner({ _projectedRowsContentHeight: 336 }),
    );
    expect(h).toBe(336);
  });

  it("ref 소유자 style padding 반영 (border-box = padding + injection + border)", () => {
    const h = calculateContentHeight(
      makeRefOwner(
        { _projectedRowsContentHeight: 336 },
        { paddingTop: "10px", paddingBottom: "10px" },
      ),
    );
    expect(h).toBe(10 + 336 + 10);
  });

  it("injection 없는 ref 소유자는 early-check 미발동 (BC — generic 경로 유지)", () => {
    const h = calculateContentHeight(makeRefOwner({}));
    expect(h).not.toBe(336);
  });

  it("direct-type ListBox 는 early-check 아닌 §1.55b 경로 유지 (family metric padding 보존)", () => {
    const m = resolveListBoxSpacingMetric({});
    const h = calculateContentHeight(
      makeListBox({ _projectedRowsContentHeight: 5000 }),
    );
    expect(h).toBe(m.paddingTop + m.paddingBottom + 5000 + m.borderWidth * 2);
  });
});
