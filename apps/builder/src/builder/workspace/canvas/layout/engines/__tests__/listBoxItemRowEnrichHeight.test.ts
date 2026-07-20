/**
 * ADR-157 R1 — ListBoxItem 행 padding-box 이중 가산 방지 (enrichWithIntrinsicSize).
 *
 * 근본 원인: `calculateContentHeight` §1.55b-2(childless ListBoxItem 분기)는 행을
 *   **padding-box**(padding 포함, border 제외)로 반환한다 — `resolveListBoxItemRowHeightFromStyle`
 *   가 window resolver / render.shapes / 컨테이너 calc 와 동일한 border 규약을 공유하기 때문
 *   (GridListItem 형제 분기는 반대로 content-box 반환). §1.55b-2 는 `style.paddingTop ?? metric`
 *   순으로 **항상** padding 을 포함한다. 그런데 `enrichWithIntrinsicSize` 는 반환값을 content-box 로
 *   간주하고 `box.padding`(=parseBoxModel, **explicit** padding 만)을 재가산한다.
 *
 * 결과:
 *  - explicit padding 없는 기본 origin 행 → box.padding=0 → 재가산 0 → 이미 정합(50/28).
 *  - explicit padding 있는 행(커스텀/편집된 origin) → §1.55b-2 가 이미 그 padding 을 포함하는데
 *    enrich 가 다시 더함 → 이중 계산(desc 50→58 / plain 28→36). auto-height data-bound ListBox 는
 *    이 행 높이에 auto-size 되므로 hatch/컨테이너가 아래 형제 배치를 밀어낸다(Gate G1 ±1px 위반).
 *
 * 계약: childless ListBoxItem 행의 enrich 결과 height == §1.55b-2 padding-box (explicit padding
 *   유무 무관). GridListItem(content-box)은 padding 재가산 유지 — 두 분기의 box-model 비대칭을
 *   enrich 가 존중.
 */

import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentHeight, enrichWithIntrinsicSize } from "../utils";

function makeItem(
  type: "ListBoxItem" | "GridListItem",
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
): CanvasLayoutNode {
  return {
    id: `${type}-1`,
    type,
    props: style ? { ...props, style } : props,
  } as CanvasLayoutNode;
}

function enrichedHeight(node: CanvasLayoutNode): number | undefined {
  const out = enrichWithIntrinsicSize(node, 400, 0);
  return (out.props?.style as Record<string, unknown> | undefined)?.height as
    | number
    | undefined;
}

describe("enrichWithIntrinsicSize — ListBoxItem 행 padding-box 이중 가산 방지 (ADR-157 R1)", () => {
  it("기본 행(explicit padding 없음): metric padding 이 §1.55b-2 에 baked → 이미 정합 (회귀 가드)", () => {
    // box.padding=0 이라 이중 가산이 애초에 없음 — 기본 origin 은 fix 전후 동일(50/28).
    expect(
      enrichedHeight(
        makeItem("ListBoxItem", {
          children: "Aardvark",
          description: "mammal",
        }),
      ),
    ).toBe(50);
    expect(
      enrichedHeight(makeItem("ListBoxItem", { children: "Aardvark" })),
    ).toBe(28);
  });

  it("explicit padding 4/4 행(커스텀/편집 origin): enrich 가 padding 재가산 안 함 (58/36 아니라 50/28)", () => {
    const style = { paddingTop: 4, paddingBottom: 4 };
    expect(
      enrichedHeight(
        makeItem(
          "ListBoxItem",
          { children: "Aardvark", description: "mammal" },
          style,
        ),
      ),
    ).toBe(50);
    expect(
      enrichedHeight(makeItem("ListBoxItem", { children: "Aardvark" }, style)),
    ).toBe(28);
  });

  it("explicit padding 행: enrich 높이 == calculateContentHeight(§1.55b-2 padding-box)", () => {
    const style = { paddingTop: 4, paddingBottom: 4 };
    const props = { children: "Cat", description: "carnivore" };
    const raw = calculateContentHeight(makeItem("ListBoxItem", props, style));
    expect(enrichedHeight(makeItem("ListBoxItem", props, style))).toBe(raw);
  });

  it("box-model 비대칭 존중: explicit padding 시 ListBoxItem enriched==raw(padding-box), GridListItem enriched>raw(content-box)", () => {
    const style = { paddingTop: 12, paddingBottom: 12 };
    const props = { children: "Cat", description: "carnivore" };
    const lbiRaw = calculateContentHeight(
      makeItem("ListBoxItem", props, style),
    );
    const gliRaw = calculateContentHeight(
      makeItem("GridListItem", props, style),
    );
    // ListBoxItem: padding-box → enrich 가 padding 재가산 안 함.
    expect(enrichedHeight(makeItem("ListBoxItem", props, style))).toBe(lbiRaw);
    // GridListItem: content-box → enrich 가 padding 재가산 (행 시각 잘림 방지).
    expect(
      enrichedHeight(makeItem("GridListItem", props, style)),
    ).toBeGreaterThan(gliRaw);
  });
});
