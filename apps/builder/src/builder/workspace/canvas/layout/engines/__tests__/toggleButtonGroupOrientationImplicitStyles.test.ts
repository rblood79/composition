import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 회귀 방지 — ToggleButtonGroup orientation 이 flexDirection 의 SSOT (2026-06-28).
 *
 * **버그**: orientation 을 vertical 로 바꿔도 CSS/Skia 둘 다 가로 유지(미동작). 근본 원인은
 *   element.props.style 에 박힌 stale inline `flexDirection:"row"`(과거 factory 잔재)였다.
 *   - CSS: inline 이 @layer `[data-orientation="vertical"]`(flex-direction:column) 를 이김.
 *   - Skia applyImplicitStyles: `parentStyle.flexDirection ?? orientation` 이라 inline row 가
 *     orientation=vertical 을 이겨 가로 고정.
 *
 * **수정**: applyImplicitStyles 의 togglebuttongroup 분기를 orientation 우선으로 변경 —
 *   orientation 이 horizontal/vertical 이면 그에 맞는 flexDirection 을 강제하고 inline 무시.
 *   (buildNodeStyle self-node 경로 + CSS [data-orientation] 도 동일 기준 정렬.)
 *
 * 검증: inline flexDirection 이 있어도 orientation 이 effectiveParent.flexDirection 을 결정한다.
 */

function makeChild(id: string): Element {
  return {
    id,
    type: "ToggleButton",
    props: { children: `t-${id}`, style: {} },
    childrenIds: [],
  } as Element;
}

function applyGroup(
  props: Record<string, unknown>,
): ReturnType<typeof applyImplicitStyles> {
  const containerId = "tbg-1";
  const children = [makeChild("a"), makeChild("b")].map((c) => ({
    ...c,
    parent_id: containerId,
  })) as Element[];
  const container = {
    id: containerId,
    type: "ToggleButtonGroup",
    props,
    childrenIds: children.map((c) => c.id),
  } as Element;
  const byId = new Map<string, Element>([
    [container.id, container],
    ...children.map((c) => [c.id, c] as const),
  ]);
  return applyImplicitStyles(container, children, () => [], byId);
}

function parentFlexDir(
  result: ReturnType<typeof applyImplicitStyles>,
): unknown {
  return (
    (result.effectiveParent.props?.style ?? {}) as Record<string, unknown>
  ).flexDirection;
}

describe("ToggleButtonGroup orientation = flexDirection SSOT (2026-06-28)", () => {
  it("orientation=vertical → flexDirection:column", () => {
    expect(parentFlexDir(applyGroup({ orientation: "vertical" }))).toBe(
      "column",
    );
  });

  it("orientation=horizontal → flexDirection:row", () => {
    expect(parentFlexDir(applyGroup({ orientation: "horizontal" }))).toBe(
      "row",
    );
  });

  it("inline flexDirection:row 가 있어도 orientation=vertical 이 이긴다 (stale inline 무시)", () => {
    const result = applyGroup({
      orientation: "vertical",
      style: { display: "flex", flexDirection: "row" },
    });
    expect(
      parentFlexDir(result),
      "orientation 이 SSOT — stale inline flexDirection:row 를 무시하고 column 강제",
    ).toBe("column");
  });

  it("orientation 미지정 시 inline flexDirection 보존 (fallback)", () => {
    const result = applyGroup({
      style: { display: "flex", flexDirection: "column" },
    });
    expect(parentFlexDir(result)).toBe("column");
  });
});
